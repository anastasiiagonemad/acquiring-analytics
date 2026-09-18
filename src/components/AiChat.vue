<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import type { Contract } from '../types'
import type { ChatMode } from '../utils/aiLocal'
import { buildAnomalySummary, buildLocalAnswer } from '../utils/aiLocal'
import {
  askDeepseek,
  clearDeepseekKey,
  loadDeepseekKey,
  saveDeepseekKey,
} from '../utils/aiDeepseek'

const props = defineProps<{
  contracts: Contract[]
  selected: Contract | null
  fileName?: string
}>()

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const open = ref(true)
const settingsOpen = ref(false)
const mode = ref<ChatMode>('local')
const deepseekKeyInput = ref(loadDeepseekKey())
const deepseekKeySaved = ref(!!loadDeepseekKey())
const input = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const messages = ref<ChatMessage[]>([
  {
    id: 1,
    role: 'assistant',
    text: 'Здравствуйте! Я локальный помощник по сверке эквайринга. Спросите про излишки, даты или недостачу — данные не уходят из браузера.',
  },
])
const listEl = ref<HTMLElement | null>(null)
let nextId = 2

const QUICK = [
  'Где излишки?',
  'Какие даты смотреть?',
  'Что делать с недостачей?',
  'Краткий итог по файлу',
] as const

const modeLabel = computed(() =>
  mode.value === 'local' ? 'Локальный помощник' : 'DeepSeek',
)

watch(mode, (m) => {
  if (m === 'deepseek' && !deepseekKeySaved.value) {
    settingsOpen.value = true
  }
})

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight
    }
  })
}

function saveKey() {
  const key = deepseekKeyInput.value.trim()
  saveDeepseekKey(key)
  deepseekKeySaved.value = !!key
  deepseekKeyInput.value = key
  error.value = key ? null : 'Вставьте API-ключ DeepSeek, чтобы включить облачный режим.'
}

function clearKey() {
  clearDeepseekKey()
  deepseekKeyInput.value = ''
  deepseekKeySaved.value = false
  if (mode.value === 'deepseek') {
    mode.value = 'local'
  }
}

async function sendText(text: string) {
  const q = text.trim()
  if (!q || loading.value) return

  error.value = null
  messages.value.push({ id: nextId++, role: 'user', text: q })
  input.value = ''
  scrollToBottom()
  loading.value = true

  try {
    let answer: string
    if (mode.value === 'local') {
      answer = buildLocalAnswer(q, props.contracts, props.selected, props.fileName)
    } else {
      const key = loadDeepseekKey()
      if (!key) {
        throw new Error('Сначала сохраните API-ключ DeepSeek в настройках.')
      }
      const summary = buildAnomalySummary(
        props.contracts,
        props.selected,
        props.fileName,
      )
      answer = await askDeepseek(key, q, summary)
    }
    messages.value.push({ id: nextId++, role: 'assistant', text: answer })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg
    messages.value.push({
      id: nextId++,
      role: 'assistant',
      text: `Не удалось получить ответ: ${msg}`,
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function onSubmit() {
  void sendText(input.value)
}

function onQuick(q: string) {
  void sendText(q)
}
</script>

<template>
  <div class="ai-chat">
    <button type="button" class="ai-toggle" @click="open = !open">
      {{ open ? 'Скрыть AI-помощник' : 'AI-помощник' }}
      <span class="mode-badge">{{ modeLabel }}</span>
    </button>

    <div v-if="open" class="ai-panel">
      <div class="privacy-note" :class="{ warn: mode === 'deepseek' }">
        <template v-if="mode === 'local'">
          Режим «Локальный помощник»: ответы строятся по уже разобранному файлу в браузере.
          Ничего никуда не отправляется.
        </template>
        <template v-else>
          Режим DeepSeek: в DeepSeek уходит только сводка аномалий
          (названия салонов, даты, статусы, суммы) — не исходный Excel. Не включайте,
          если не хотите делиться сводкой.
        </template>
      </div>

      <button
        type="button"
        class="settings-toggle"
        @click="settingsOpen = !settingsOpen"
      >
        {{ settingsOpen ? '▾ Настройки' : '▸ Настройки (ключ DeepSeek, режим)' }}
      </button>

      <div v-if="settingsOpen" class="settings">
        <fieldset class="mode-field">
          <legend>Режим ответа</legend>
          <label class="radio">
            <input v-model="mode" type="radio" value="local" />
            Локальный помощник (по умолчанию, без ключа)
          </label>
          <label class="radio">
            <input v-model="mode" type="radio" value="deepseek" :disabled="!deepseekKeySaved" />
            DeepSeek
            <span v-if="!deepseekKeySaved" class="hint"> — сначала сохраните ключ</span>
          </label>
        </fieldset>

        <label class="key-label" for="deepseek-key">API-ключ DeepSeek</label>
        <div class="key-row">
          <input
            id="deepseek-key"
            v-model="deepseekKeyInput"
            type="password"
            autocomplete="off"
            placeholder="Вставьте ключ с platform.deepseek.com/api_keys"
            class="key-input"
          />
          <button type="button" class="btn-save" @click="saveKey">Сохранить</button>
          <button type="button" class="btn-clear" @click="clearKey">Очистить</button>
        </div>
        <p class="key-status">
          <template v-if="deepseekKeySaved">Ключ сохранён в браузере (localStorage).</template>
          <template v-else>
            Ключ не задан.
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener"
              >https://platform.deepseek.com/api_keys</a
            >
          </template>
        </p>
      </div>

      <div ref="listEl" class="messages" aria-live="polite">
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg"
          :class="m.role === 'user' ? 'msg-user' : 'msg-assistant'"
        >
          <div class="msg-role">{{ m.role === 'user' ? 'Вы' : 'Помощник' }}</div>
          <pre class="msg-text">{{ m.text }}</pre>
        </div>
        <div v-if="loading" class="msg msg-assistant loading">
          <div class="msg-role">Помощник</div>
          <p class="msg-text">Думаю…</p>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="chips">
        <button
          v-for="q in QUICK"
          :key="q"
          type="button"
          class="chip"
          :disabled="loading"
          @click="onQuick(q)"
        >
          {{ q }}
        </button>
      </div>

      <form class="composer" @submit.prevent="onSubmit">
        <input
          v-model="input"
          type="text"
          class="composer-input"
          placeholder="Задайте вопрос по сверке…"
          :disabled="loading"
          autocomplete="off"
        />
        <button type="submit" class="btn-send" :disabled="loading || !input.trim()">
          Отправить
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.ai-chat {
  margin-top: 28px;
  font-size: 1.05rem;
}

.ai-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #e7f5ff;
  border: 1px solid #74c0fc;
  color: #1864ab;
  border-radius: 8px;
  padding: 12px 18px;
  font-weight: 600;
  font-size: 1.05rem;
  cursor: pointer;
}

.ai-toggle:hover {
  background: #d0ebff;
}

.mode-badge {
  background: #fff;
  border: 1px solid #a5d8ff;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1971c2;
}

.ai-panel {
  margin-top: 12px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 16px 18px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.privacy-note {
  background: #ebfbee;
  border: 1px solid #8ce99a;
  color: #2b8a3e;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
  line-height: 1.45;
  font-size: 1rem;
}

.privacy-note.warn {
  background: #fff9db;
  border-color: #ffe066;
  color: #925310;
}

.settings-toggle {
  background: transparent;
  border: none;
  color: #495057;
  font-size: 1rem;
  font-weight: 600;
  padding: 4px 0 10px;
  cursor: pointer;
}

.settings {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 14px;
}

.mode-field {
  border: none;
  margin: 0 0 12px;
  padding: 0;
}

.mode-field legend {
  font-weight: 700;
  margin-bottom: 8px;
  font-size: 1rem;
}

.radio {
  display: block;
  margin-bottom: 8px;
  font-size: 1.02rem;
  cursor: pointer;
}

.hint {
  color: #868e96;
  font-weight: 400;
}

.key-label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}

.key-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.key-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
}

.btn-save,
.btn-clear,
.btn-send {
  border-radius: 8px;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-save {
  background: #339af0;
  color: #fff;
  border-color: #228be6;
}

.btn-save:hover {
  background: #228be6;
}

.btn-clear {
  background: #fff;
  border-color: #ced4da;
  color: #495057;
}

.btn-clear:hover {
  background: #f1f3f5;
}

.key-status {
  margin: 8px 0 0;
  font-size: 0.95rem;
  color: #868e96;
}

.messages {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 4px 12px;
  margin-bottom: 10px;
  border-top: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
}

.msg {
  max-width: 95%;
}

.msg-user {
  align-self: flex-end;
}

.msg-assistant {
  align-self: flex-start;
}

.msg-role {
  font-size: 0.8rem;
  font-weight: 700;
  color: #868e96;
  margin-bottom: 4px;
}

.msg-user .msg-role {
  text-align: right;
}

.msg-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 1.08rem;
  line-height: 1.5;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f1f3f5;
  color: #212529;
}

.msg-user .msg-text {
  background: #e7f5ff;
  color: #1864ab;
}

.loading .msg-text {
  color: #868e96;
  font-style: italic;
}

.error {
  color: #c92a2a;
  font-weight: 600;
  margin: 0 0 10px;
  font-size: 1rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  background: #fff;
  border: 1px solid #74c0fc;
  color: #1864ab;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
}

.chip:hover:not(:disabled) {
  background: #e7f5ff;
}

.chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.composer {
  display: flex;
  gap: 10px;
}

.composer-input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1.08rem;
}

.btn-send {
  background: #1c7ed6;
  color: #fff;
  border-color: #1971c2;
  min-width: 120px;
}

.btn-send:hover:not(:disabled) {
  background: #1971c2;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .composer {
    flex-direction: column;
  }

  .btn-send {
    width: 100%;
  }
}
</style>
