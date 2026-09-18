/**
 * Парсер ОСВ 57.03 из 1С (xlsx).
 *
 * Эвристика колонок (типичная выгрузка 1С «Оборотно-сальдовая ведомость»):
 * - nameCol: ранняя колонка с наименованием (обычно 0 или 1) — ищем первую
 *   текстовую ячейку в строке, похожую на название/договор/обороты.
 * - openingDebitCol: колонка «Сальдо на начало периода» Дебет
 * - periodDebitCol: колонка «Обороты за период» Дебет (касса)
 * - periodCreditCol: колонка «Обороты за период» Кредит (банк)
 *
 * Порядок колонок в 1С часто: [Счёт/Наименование][Сальдо нач. Д][Сальдо нач. К]
 * [Обороты Д][Обороты К][Сальдо кон. Д][Сальдо кон. К] — либо с пустой первой колонкой.
 * Детектируем индексы по заголовкам или по ширине строки (минимум 5 числовых зон).
 */
import * as XLSX from 'xlsx'
import type { Contract, DailyRow, ParseResult } from '../types'
import { normalizeNumber } from './normalize'
import { classifyBalance } from './status'

const PARENT_RE = /^(Дог\.?\s*экв\.|Договор\s+эквайринга|Салон)/i
const CHILD_RE = /^Обороты\s+за\s+(.+)$/i

interface ColumnMap {
  name: number
  openingDebit: number
  periodDebit: number
  periodCredit: number
}

function detectColumns(rows: unknown[][]): ColumnMap {
  // Ищем строку заголовка с «Дебет» / «Кредит» / «Сальдо»
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] ?? []
    const texts = row.map((c) => String(c ?? '').toLowerCase())
    const joined = texts.join(' | ')
    if (
      joined.includes('дебет') &&
      joined.includes('кредит') &&
      (joined.includes('сальдо') || joined.includes('оборот'))
    ) {
      // Типичная раскладка: name | openD | openC | perD | perC | closeD | closeC
      // Ищем первую колонку с текстом «дебет» после наименования
      let name = 0
      for (let i = 0; i < row.length; i++) {
        const t = texts[i]
        if (t.includes('наименование') || t.includes('счет') || t.includes('счёт')) {
          name = i
          break
        }
      }
      // Собираем индексы «Дебет» и «Кредит» по порядку
      const debitIdx: number[] = []
      const creditIdx: number[] = []
      for (let i = 0; i < row.length; i++) {
        if (texts[i].includes('дебет')) debitIdx.push(i)
        if (texts[i].includes('кредит')) creditIdx.push(i)
      }
      // Если заголовки на двух строках (Сальдо / Обороты сверху, Дебет/Кредит снизу)
      if (debitIdx.length >= 2 && creditIdx.length >= 2) {
        return {
          name,
          openingDebit: debitIdx[0],
          periodDebit: debitIdx[1],
          periodCredit: creditIdx[1],
        }
      }
      if (debitIdx.length >= 1 && creditIdx.length >= 1) {
        // Одна пара — считаем это обороты; сальдо в соседней левой дебет-колонке
        return {
          name,
          openingDebit: debitIdx[0],
          periodDebit: debitIdx[Math.min(1, debitIdx.length - 1)],
          periodCredit: creditIdx[Math.min(1, creditIdx.length - 1)],
        }
      }
    }
  }

  // Fallback: стандартная раскладка 1С без объединённых ячеек
  // col0 = name (или col1 если col0 пустой/номер), затем openD, openC, perD, perC
  return { name: 0, openingDebit: 1, periodDebit: 3, periodCredit: 4 }
}

function cell(row: unknown[], idx: number): unknown {
  return row[idx]
}

function findNameCol(row: unknown[], preferred: number): { text: string; col: number } {
  // Сначала preferred, потом соседние ранние колонки
  const candidates = [preferred, 0, 1, 2].filter((v, i, a) => a.indexOf(v) === i)
  for (const c of candidates) {
    const v = row[c]
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      return { text: String(v).trim(), col: c }
    }
  }
  return { text: '', col: preferred }
}

function buildContract(name: string, openingBalance: number, rawDays: { date: string; debit: number; credit: number }[]): Contract {
  let balance = openingBalance
  let totalDebit = 0
  let totalCredit = 0
  let overpaymentCount = 0
  let underpaymentCount = 0
  let firstProblemDate: string | null = null

  const days: DailyRow[] = rawDays.map((d) => {
    balance = balance + d.debit - d.credit
    totalDebit += d.debit
    totalCredit += d.credit
    const status = classifyBalance(balance)
    if (status !== 'NONE' && firstProblemDate === null) {
      firstProblemDate = d.date
    }
    if (status === 'OVERPAYMENT') overpaymentCount++
    if (status === 'UNDERPAYMENT') underpaymentCount++
    return {
      date: d.date,
      debit: d.debit,
      credit: d.credit,
      balance,
      status,
    }
  })

  const hasGlobalError = totalDebit === 0 && totalCredit > 0

  return {
    name,
    openingBalance,
    days,
    totalDebit,
    totalCredit,
    lastBalance: balance,
    hasGlobalError,
    overpaymentCount,
    underpaymentCount,
    firstProblemDate: hasGlobalError && rawDays.length ? rawDays[0].date : firstProblemDate,
  }
}

/**
 * Парсит ArrayBuffer Excel ОСВ 57.03 → список договоров с подневными оборотами.
 */
export function parseOsvWorkbook(data: ArrayBuffer, fileName: string): ParseResult {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  const cols = detectColumns(rows)
  const contracts: Contract[] = []

  let currentName: string | null = null
  let currentOpening = 0
  let currentDays: { date: string; debit: number; credit: number }[] = []

  const flush = () => {
    if (currentName !== null) {
      contracts.push(buildContract(currentName, currentOpening, currentDays))
    }
    currentName = null
    currentOpening = 0
    currentDays = []
  }

  for (const row of rows) {
    if (!row || row.length === 0) continue
    const { text } = findNameCol(row, cols.name)
    if (!text) continue

    // Пропускаем чисто технические заголовки (ИП, период и т.п.)
    if (/^ип\b/i.test(text) || /^период/i.test(text) || /^оборотно/i.test(text)) {
      continue
    }

    if (PARENT_RE.test(text)) {
      flush()
      currentName = text
      currentOpening = normalizeNumber(cell(row, cols.openingDebit))
      currentDays = []
      continue
    }

    const childMatch = text.match(CHILD_RE)
    if (childMatch && currentName !== null) {
      const dateRaw = childMatch[1].trim()
      const debit = normalizeNumber(cell(row, cols.periodDebit))
      const credit = normalizeNumber(cell(row, cols.periodCredit))
      currentDays.push({ date: dateRaw, debit, credit })
    }
  }
  flush()

  return { contracts, fileName }
}

/** Удобная обёртка для File из dropzone */
export async function parseOsvFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  return parseOsvWorkbook(buf, file.name)
}

export { buildContract, detectColumns, PARENT_RE, CHILD_RE }
