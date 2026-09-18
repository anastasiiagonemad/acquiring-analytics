import type { Contract, DailyRow } from '../types'
import { formatMoney } from './format'

export type ChatMode = 'local' | 'gemini'

const STATUS_RU: Record<string, string> = {
  OVERPAYMENT: 'излишек (OVERPAYMENT)',
  UNDERPAYMENT: 'недостача / задержка банка (UNDERPAYMENT)',
}

/** Компактная текстовая сводка аномалий для промпта / локальных ответов */
export function buildAnomalySummary(
  contracts: Contract[],
  selected: Contract | null,
  fileName?: string,
): string {
  const lines: string[] = []
  if (fileName) lines.push(`Файл: ${fileName}`)
  if (selected) lines.push(`Выбранный салон: ${selected.name}`)
  lines.push(`Договоров в файле: ${contracts.length}`)
  lines.push('')

  const list = contracts.length > 0 ? contracts : selected ? [selected] : []

  for (const c of list) {
    lines.push(`=== ${c.name} ===`)
    lines.push(
      `Нач.сальдо: ${formatMoney(c.openingBalance)}; итого дебет: ${formatMoney(c.totalDebit)}; итого кредит: ${formatMoney(c.totalCredit)}; конечный баланс: ${formatMoney(c.lastBalance)}`,
    )
    if (c.hasGlobalError) {
      lines.push(
        `⚠ Глобальный перекос: по кассе продаж нет (дебет 0), но в банк пришло ${formatMoney(c.totalCredit)}.`,
      )
    }
    lines.push(
      `Излишков: ${c.overpaymentCount}; задержек банка: ${c.underpaymentCount}; первая проблема: ${c.firstProblemDate ?? 'нет'}`,
    )
    const anomalies = c.days.filter((d) => d.status !== 'NONE')
    if (anomalies.length === 0) {
      lines.push('Аномалий по дням нет.')
    } else {
      lines.push('Проблемные дни:')
      for (const d of anomalies) {
        lines.push(
          `  ${d.date}: ${STATUS_RU[d.status] ?? d.status}; дебет ${formatMoney(d.debit)}; кредит ${formatMoney(d.credit)}; баланс ${formatMoney(d.balance)}`,
        )
      }
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

function focusContracts(contracts: Contract[], selected: Contract | null): Contract[] {
  if (selected) return [selected]
  return contracts
}

function listDays(days: DailyRow[], status: 'OVERPAYMENT' | 'UNDERPAYMENT'): string {
  const rows = days.filter((d) => d.status === status)
  if (rows.length === 0) return 'не найдены'
  return rows
    .map((d) => `${d.date} (баланс ${formatMoney(d.balance)})`)
    .join(', ')
}

function nextStepsOverpayment(): string {
  return [
    'Что делать с излишками (OVERPAYMENT):',
    '• На расчётный счёт пришло больше, чем проведено по кассе — часто кассир забыл пробить чек, но терминал карту принял.',
    '• Сверьте слип-чеки терминала с чеками ККМ за указанные даты.',
    '• Найдите непробитые операции и оформите чеки / исправьте разнесение в 1С.',
  ].join('\n')
}

function nextStepsUnderpayment(): string {
  return [
    'Что делать с недостачей / задержкой банка (UNDERPAYMENT):',
    '• Банк задерживает выплату крупной суммы или транзакции «зависли» (баланс > 400 000 ₽).',
    '• Проверьте реестры эквайринга за эти даты.',
    '• При необходимости обратитесь в службу поддержки банка с датами и суммами.',
  ].join('\n')
}

function summaryForContract(c: Contract): string {
  const parts: string[] = []
  parts.push(`Салон «${c.name}»`)
  parts.push(
    `Дней: ${c.days.length}; излишков: ${c.overpaymentCount}; задержек банка: ${c.underpaymentCount}.`,
  )
  parts.push(`Конечный баланс: ${formatMoney(c.lastBalance)}.`)
  if (c.hasGlobalError) {
    parts.push(
      `⚠ Ошибка разнесения: по кассе продаж нет, но в банк пришло ${formatMoney(c.totalCredit)}.`,
    )
  }
  if (c.firstProblemDate) {
    parts.push(`Первая проблемная дата: ${c.firstProblemDate}.`)
  }
  const overs = c.days.filter((d) => d.status === 'OVERPAYMENT')
  const unders = c.days.filter((d) => d.status === 'UNDERPAYMENT')
  if (overs.length) {
    parts.push(`Даты излишков: ${listDays(c.days, 'OVERPAYMENT')}.`)
  }
  if (unders.length) {
    parts.push(`Даты задержек: ${listDays(c.days, 'UNDERPAYMENT')}.`)
  }
  if (!overs.length && !unders.length && !c.hasGlobalError) {
    parts.push('По выбранному договору аномалий нет — всё в норме.')
  }
  return parts.join('\n')
}

/**
 * Локальный ответчик: эвристики по ключевым словам + структурированный ответ на русском.
 * Не ходит в сеть.
 */
export function buildLocalAnswer(
  question: string,
  contracts: Contract[],
  selected: Contract | null,
  fileName?: string,
): string {
  const q = question.trim().toLowerCase()
  const focus = focusContracts(contracts, selected)

  if (contracts.length === 0 && !selected) {
    return 'Сначала загрузите файл ОСВ — тогда я смогу показать излишки, даты и подсказать следующие шаги.'
  }

  const isOver =
    /излиш|overpayment|пробит|слип|непробит|лишн/i.test(q) ||
    q.includes('где излишки')
  const isUnder =
    /недостач|underpayment|задерж|банк|завис/i.test(q) ||
    q.includes('что делать с недостачей')
  const isDates = /дат|смотр|когда|какой день|какие даты/i.test(q)
  const isSummary =
    /итог|сводк|кратко|обзор|файл|резюме|summary/i.test(q) ||
    q.includes('краткий итог')
  const isHelp = /что делать|как исправ|помощ|шаг/i.test(q)

  // Quick chips / combined intents
  if (isOver && !isUnder) {
    const blocks: string[] = []
    for (const c of focus) {
      const dates = listDays(c.days, 'OVERPAYMENT')
      blocks.push(`«${c.name}»: излишки — ${dates}.`)
      if (c.hasGlobalError) {
        blocks.push(
          `Также глобальный перекос: дебет 0, кредит ${formatMoney(c.totalCredit)}.`,
        )
      }
    }
    blocks.push('')
    blocks.push(nextStepsOverpayment())
    return blocks.join('\n')
  }

  if (isUnder && !isOver) {
    const blocks: string[] = []
    for (const c of focus) {
      blocks.push(`«${c.name}»: задержки банка — ${listDays(c.days, 'UNDERPAYMENT')}.`)
    }
    blocks.push('')
    blocks.push(nextStepsUnderpayment())
    return blocks.join('\n')
  }

  if (isDates) {
    const blocks: string[] = ['Даты, на которые стоит обратить внимание:']
    for (const c of focus) {
      const anomalies = c.days.filter((d) => d.status !== 'NONE')
      if (anomalies.length === 0 && !c.hasGlobalError) {
        blocks.push(`«${c.name}»: проблемных дат нет.`)
        continue
      }
      blocks.push(`«${c.name}»:`)
      for (const d of anomalies) {
        const tip =
          d.status === 'OVERPAYMENT'
            ? '→ сверить слип-чеки'
            : '→ уточнить у банка'
        blocks.push(
          `  • ${d.date}: ${STATUS_RU[d.status]} , баланс ${formatMoney(d.balance)} ${tip}`,
        )
      }
      if (c.firstProblemDate) {
        blocks.push(`  Первая проблема: ${c.firstProblemDate}.`)
      }
    }
    return blocks.join('\n')
  }

  if (isSummary) {
    const header = fileName ? `Краткий итог по файлу «${fileName}»:\n` : 'Краткий итог:\n'
    if (selected) {
      return header + summaryForContract(selected)
    }
    const all = contracts.map(summaryForContract).join('\n\n')
    const totalOver = contracts.reduce((s, c) => s + c.overpaymentCount, 0)
    const totalUnder = contracts.reduce((s, c) => s + c.underpaymentCount, 0)
    return (
      header +
      `Салонов: ${contracts.length}; всего излишков: ${totalOver}; всего задержек: ${totalUnder}.\n\n` +
      all
    )
  }

  if (isHelp) {
    return [
      selected ? summaryForContract(selected) : 'Выберите салон слева или задайте вопрос по файлу.',
      '',
      nextStepsOverpayment(),
      '',
      nextStepsUnderpayment(),
    ].join('\n')
  }

  // Default: short structured overview of focus
  if (selected) {
    return [
      summaryForContract(selected),
      '',
      'Можете спросить: «Где излишки?», «Какие даты смотреть?», «Что делать с недостачей?», «Краткий итог по файлу».',
    ].join('\n')
  }

  return (
    buildAnomalySummary(contracts, selected, fileName) +
    '\n\nЗадайте вопрос или нажмите подсказку ниже.'
  )
}
