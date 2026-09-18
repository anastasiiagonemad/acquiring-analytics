import { describe, it, expect } from 'vitest'
import { buildContract, PARENT_RE, CHILD_RE } from '../parser'
import * as XLSX from 'xlsx'
import { parseOsvWorkbook } from '../parser'

describe('регулярки родителей/детей', () => {
  it('распознаёт родительские строки', () => {
    expect(PARENT_RE.test('Дог.экв. №123 Салон Центр')).toBe(true)
    expect(PARENT_RE.test('Договор эквайринга Сбер')).toBe(true)
    expect(PARENT_RE.test('Салон Красота')).toBe(true)
    expect(PARENT_RE.test('Обороты за 01.01.2024')).toBe(false)
  })

  it('распознаёт дочерние обороты', () => {
    expect(CHILD_RE.test('Обороты за 15.03.2024')).toBe(true)
    const m = 'Обороты за 15.03.2024'.match(CHILD_RE)
    expect(m?.[1].trim()).toBe('15.03.2024')
  })
})

describe('buildContract — скользящий баланс', () => {
  it('считает баланс = prev + debit - credit', () => {
    const c = buildContract('Дог.экв. Тест', 1000, [
      { date: '01.01.2024', debit: 5000, credit: 3000 },
      { date: '02.01.2024', debit: 2000, credit: 4000 },
    ])
    expect(c.days[0].balance).toBe(1000 + 5000 - 3000) // 3000
    expect(c.days[1].balance).toBe(3000 + 2000 - 4000) // 1000
    expect(c.lastBalance).toBe(1000)
    expect(c.totalDebit).toBe(7000)
    expect(c.totalCredit).toBe(7000)
  })

  it('ставит OVERPAYMENT при отрицательном балансе', () => {
    const c = buildContract('Дог.экв. A', 0, [
      { date: '01.01.2024', debit: 100, credit: 5000 },
    ])
    expect(c.days[0].status).toBe('OVERPAYMENT')
    expect(c.overpaymentCount).toBe(1)
    expect(c.firstProblemDate).toBe('01.01.2024')
  })

  it('ставит UNDERPAYMENT при большом балансе', () => {
    const c = buildContract('Салон X', 0, [
      { date: '01.01.2024', debit: 500000, credit: 0 },
    ])
    expect(c.days[0].status).toBe('UNDERPAYMENT')
    expect(c.underpaymentCount).toBe(1)
  })

  it('глобальная ошибка: нет кассы, есть банк', () => {
    const c = buildContract('Договор эквайринга M', 0, [
      { date: '01.01.2024', debit: 0, credit: 15000 },
      { date: '02.01.2024', debit: 0, credit: 5000 },
    ])
    expect(c.hasGlobalError).toBe(true)
    expect(c.totalDebit).toBe(0)
    expect(c.totalCredit).toBe(20000)
  })

  it('нет глобальной ошибки если есть касса', () => {
    const c = buildContract('Салон Y', 0, [
      { date: '01.01.2024', debit: 100, credit: 5000 },
    ])
    expect(c.hasGlobalError).toBe(false)
  })
})

describe('parseOsvWorkbook', () => {
  it('парсит минимальный лист ОСВ', () => {
    const aoa = [
      ['ИП Иванова', '', '', '', ''],
      ['Период: январь 2024', '', '', '', ''],
      ['Наименование', 'Дебет', 'Кредит', 'Дебет', 'Кредит'],
      ['Дог.экв. Салон Центр', 500, '', '', ''],
      ['Обороты за 10.01.2024', '', '', 10000, 8000],
      ['Обороты за 11.01.2024', '', '', 5000, 12000],
      ['Салон Север', 0, '', '', ''],
      ['Обороты за 10.01.2024', '', '', 0, 3000],
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ОСВ')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = parseOsvWorkbook(buf, 'test.xlsx')
    expect(result.contracts.length).toBe(2)

    const first = result.contracts[0]
    expect(first.name).toMatch(/Дог\.экв/)
    expect(first.openingBalance).toBe(500)
    expect(first.days.length).toBe(2)
    expect(first.days[0].debit).toBe(10000)
    expect(first.days[0].credit).toBe(8000)
    // 500 + 10000 - 8000 = 2500
    expect(first.days[0].balance).toBe(2500)
    // 2500 + 5000 - 12000 = -4500 → OVERPAYMENT
    expect(first.days[1].status).toBe('OVERPAYMENT')

    const second = result.contracts[1]
    expect(second.hasGlobalError).toBe(true)
    expect(second.totalCredit).toBe(3000)
  })
})
