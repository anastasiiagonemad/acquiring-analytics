import { describe, it, expect } from 'vitest'
import { classifyBalance } from '../status'

describe('classifyBalance', () => {
  it('NONE в допустимом диапазоне', () => {
    expect(classifyBalance(0)).toBe('NONE')
    expect(classifyBalance(-100)).toBe('NONE')
    expect(classifyBalance(400000)).toBe('NONE')
    expect(classifyBalance(15000)).toBe('NONE')
  })

  it('OVERPAYMENT при балансе < -100', () => {
    expect(classifyBalance(-100.01)).toBe('OVERPAYMENT')
    expect(classifyBalance(-5000)).toBe('OVERPAYMENT')
  })

  it('UNDERPAYMENT при балансе > 400000', () => {
    expect(classifyBalance(400000.01)).toBe('UNDERPAYMENT')
    expect(classifyBalance(1_000_000)).toBe('UNDERPAYMENT')
  })
})
