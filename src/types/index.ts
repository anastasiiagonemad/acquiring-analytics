/** Статус аномалии по дневному балансу */
export type AnomalyStatus = 'NONE' | 'OVERPAYMENT' | 'UNDERPAYMENT'

/** Подневная строка оборотов */
export interface DailyRow {
  date: string
  debit: number
  credit: number
  balance: number
  status: AnomalyStatus
}

/** Договор / салон с подневными оборотами */
export interface Contract {
  name: string
  openingBalance: number
  days: DailyRow[]
  totalDebit: number
  totalCredit: number
  lastBalance: number
  hasGlobalError: boolean
  overpaymentCount: number
  underpaymentCount: number
  firstProblemDate: string | null
}

/** Результат парсинга ОСВ */
export interface ParseResult {
  contracts: Contract[]
  fileName: string
}
