import { describe, it, expect } from 'vitest'
import { normalizeNumber } from '../normalize'

describe('normalizeNumber', () => {
  it('парсит обычное число', () => {
    expect(normalizeNumber(1234.5)).toBe(1234.5)
  })

  it('убирает пробелы-разделители тысяч', () => {
    expect(normalizeNumber('1 234 567,89')).toBe(1234567.89)
    expect(normalizeNumber('12 000')).toBe(12000)
  })

  it('дефис и пустая строка → 0', () => {
    expect(normalizeNumber('-')).toBe(0)
    expect(normalizeNumber('—')).toBe(0)
    expect(normalizeNumber('')).toBe(0)
    expect(normalizeNumber(null)).toBe(0)
    expect(normalizeNumber(undefined)).toBe(0)
  })

  it('запятая как десятичный разделитель', () => {
    expect(normalizeNumber('100,50')).toBe(100.5)
  })
})
