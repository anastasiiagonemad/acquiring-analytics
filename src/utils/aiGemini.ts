const GEMINI_KEY_STORAGE = 'acquiring-analytics-gemini-key'

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const

export function loadGeminiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveGeminiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim())
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGeminiKey(): void {
  saveGeminiKey('')
}

function extractText(data: unknown): string {
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (d.error?.message) {
    throw new Error(d.error.message)
  }
  const parts = d.candidates?.[0]?.content?.parts
  const text = parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) {
    throw new Error('Пустой ответ от Gemini')
  }
  return text.trim()
}

async function callModel(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return extractText(data)
}

/** Вызов Gemini Flash из браузера; при ошибке 2.0 пробует 1.5 */
export async function askGemini(
  apiKey: string,
  question: string,
  anomalySummary: string,
): Promise<string> {
  const prompt = [
    'Ты помощник бухгалтера по сверке эквайринга (счёт 57.03).',
    'Отвечай кратко на русском языке.',
    'OVERPAYMENT (баланс < -100 ₽) — излишек: сверить слип-чеки терминала с чеками ККМ.',
    'UNDERPAYMENT (баланс > 400 000 ₽) — задержка банка: уточнить у банка.',
    'Ниже — компактная сводка аномалий (не весь Excel). Не выдумывай даты, которых нет в сводке.',
    '',
    '=== СВОДКА ===',
    anomalySummary,
    '',
    '=== ВОПРОС ===',
    question,
  ].join('\n')

  let lastError: Error | null = null
  for (const model of MODELS) {
    try {
      return await callModel(model, apiKey, prompt)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError ?? new Error('Не удалось вызвать Gemini')
}

export { GEMINI_KEY_STORAGE }
