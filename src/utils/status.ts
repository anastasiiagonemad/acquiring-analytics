import type { AnomalyStatus } from '../types'

const OVERPAYMENT_THRESHOLD = -100
const UNDERPAYMENT_THRESHOLD = 400_000

/** Определяет статус аномалии по скользящему балансу */
export function classifyBalance(balance: number): AnomalyStatus {
  if (balance < OVERPAYMENT_THRESHOLD) return 'OVERPAYMENT'
  if (balance > UNDERPAYMENT_THRESHOLD) return 'UNDERPAYMENT'
  return 'NONE'
}

export { OVERPAYMENT_THRESHOLD, UNDERPAYMENT_THRESHOLD }
