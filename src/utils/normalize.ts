/**
 * Нормализация числовых значений из ячеек 1С Excel:
 * - удаляет пробелы-разделители тысяч
 * - дефис / пустая строка → 0
 * - запятая как десятичный разделитель → точка
 */
export function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  let s = String(value).trim()
  if (s === '' || s === '-' || s === '—' || s === '–') return 0
  s = s.replace(/\s/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
