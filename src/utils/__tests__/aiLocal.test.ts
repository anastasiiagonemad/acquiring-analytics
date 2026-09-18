import { describe, it, expect } from 'vitest'
import { buildAnomalySummary, buildLocalAnswer } from '../aiLocal'
import type { Contract } from '../../types'

const fixture: Contract = {
  name: 'Дог.экв. Салон Центр',
  openingBalance: 0,
  days: [
    {
      date: '01.03.2025',
      debit: 10_000,
      credit: 10_000,
      balance: 0,
      status: 'NONE',
    },
    {
      date: '02.03.2025',
      debit: 5_000,
      credit: 20_000,
      balance: -15_000,
      status: 'OVERPAYMENT',
    },
    {
      date: '03.03.2025',
      debit: 500_000,
      credit: 0,
      balance: 485_000,
      status: 'UNDERPAYMENT',
    },
  ],
  totalDebit: 515_000,
  totalCredit: 30_000,
  lastBalance: 485_000,
  hasGlobalError: false,
  overpaymentCount: 1,
  underpaymentCount: 1,
  firstProblemDate: '02.03.2025',
}

const globalErrorContract: Contract = {
  name: 'Мобильный склад',
  openingBalance: 0,
  days: [],
  totalDebit: 0,
  totalCredit: 12_345.67,
  lastBalance: -12_345.67,
  hasGlobalError: true,
  overpaymentCount: 0,
  underpaymentCount: 0,
  firstProblemDate: null,
}

describe('buildAnomalySummary', () => {
  it('включает салон, даты и статусы', () => {
    const s = buildAnomalySummary([fixture], fixture, 'osv.xlsx')
    expect(s).toContain('osv.xlsx')
    expect(s).toContain('Дог.экв. Салон Центр')
    expect(s).toContain('02.03.2025')
    expect(s).toContain('OVERPAYMENT')
    expect(s).toContain('03.03.2025')
    expect(s).toContain('UNDERPAYMENT')
  })
})

describe('buildLocalAnswer', () => {
  it('просит загрузить файл, если данных нет', () => {
    const a = buildLocalAnswer('Где излишки?', [], null)
    expect(a).toMatch(/загрузите файл/i)
  })

  it('отвечает на «Где излишки?» с датой и советом про слип-чеки', () => {
    const a = buildLocalAnswer('Где излишки?', [fixture], fixture)
    expect(a).toContain('02.03.2025')
    expect(a).toMatch(/слип/i)
    expect(a).not.toContain('03.03.2025') // underpayment date not required in over-only answer listing... actually listDays only overs
  })

  it('отвечает на «Что делать с недостачей?» с датой и банком', () => {
    const a = buildLocalAnswer('Что делать с недостачей?', [fixture], fixture)
    expect(a).toContain('03.03.2025')
    expect(a).toMatch(/банк/i)
  })

  it('отвечает на «Какие даты смотреть?» обеими проблемами', () => {
    const a = buildLocalAnswer('Какие даты смотреть?', [fixture], fixture)
    expect(a).toContain('02.03.2025')
    expect(a).toContain('03.03.2025')
  })

  it('даёт краткий итог по файлу', () => {
    const a = buildLocalAnswer('Краткий итог по файлу', [fixture], fixture, 'test.xlsx')
    expect(a).toContain('test.xlsx')
    expect(a).toContain('Салон Центр')
    expect(a).toMatch(/излиш/i)
  })

  it('упоминает глобальный перекос', () => {
    const a = buildLocalAnswer('Краткий итог', [globalErrorContract], globalErrorContract)
    expect(a).toMatch(/перекос|разнесен/i)
  })
})
