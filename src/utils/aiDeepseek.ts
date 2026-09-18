const DEEPSEEK_KEY_STORAGE = 'acquiring-analytics-deepseek-key'

const SYSTEM_PROMPT = [
  'Ты помощник бухгалтера по сверке эквайринга (счёт 57.03).',
  'Отвечай кратко на русском языке.',
  'OVERPAYMENT (баланс < -100 ₽) — излишек: сверить слип-чеки терминала с чеками ККМ.',
  'UNDERPAYMENT (баланс > 400 000 ₽) — задержка банка: уточнить у банка.',
  'Ниже — компактная сводка аномалий (не весь Excel). Не выдумывай даты, которых нет в сводке.',
].join('\n')

export function loadDeepseekKey(): string {
  try {
    return localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveDeepseekKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(DEEPSEEK_KEY_STORAGE, key.trim())
    } else {
      localStorage.removeItem(DEEPSEEK_KEY_STORAGE)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearDeepseekKey(): void {
  saveDeepseekKey('')
}

function apiBase(): string {
  return import.meta.env.DEV ? '/deepseek-api' : 'https://api.deepseek.com'
}

function extractText(data: unknown): string {
  const d = data as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  if (d.error?.message) {
    throw new Error(d.error.message)
  }
  const text = d.choices?.[0]?.message?.content ?? ''
  if (!text.trim()) {
    throw new Error('Пустой ответ от DeepSeek')
  }
  return text.trim()
}

/** Вызов DeepSeek Chat из браузера (в DEV — через Vite-прокси из‑за CORS) */
export async function askDeepseek(
  apiKey: string,
  question: string,
  anomalySummary: string,
): Promise<string> {
  const userContent = [
    '=== СВОДКА ===',
    anomalySummary,
    '',
    '=== ВОПРОС ===',
    question,
  ].join('\n')

  const url = `${apiBase()}/v1/chat/completions`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!import.meta.env.DEV && /failed to fetch|networkerror|cors/i.test(msg)) {
      throw new Error(
        'DeepSeek блокирует запросы из браузера (CORS). Локально используйте npm run dev, или оставайтесь в локальном режиме.',
      )
    }
    throw new Error(
      msg.includes('Failed to fetch') || /network|cors/i.test(msg)
        ? 'DeepSeek блокирует запросы из браузера (CORS). Локально используйте npm run dev, или оставайтесь в локальном режиме.'
        : `Не удалось связаться с DeepSeek: ${msg}`,
    )
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const apiMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${res.status}`
    throw new Error(`Ошибка DeepSeek: ${apiMsg}`)
  }
  return extractText(data)
}

export { DEEPSEEK_KEY_STORAGE }
