<script setup lang="ts">
import { ref, computed } from 'vue'
import Dropzone from './components/Dropzone.vue'
import SalonCard from './components/SalonCard.vue'
import DailyTable from './components/DailyTable.vue'
import SummaryBar from './components/SummaryBar.vue'
import AiChat from './components/AiChat.vue'
import { parseOsvFile } from './utils/parser'
import type { Contract, ParseResult } from './types'

const result = ref<ParseResult | null>(null)
const selectedIndex = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const selected = computed<Contract | null>(() => {
  if (!result.value || result.value.contracts.length === 0) return null
  return result.value.contracts[selectedIndex.value] ?? result.value.contracts[0]
})

async function onFile(file: File) {
  loading.value = true
  error.value = null
  try {
    const parsed = await parseOsvFile(file)
    if (parsed.contracts.length === 0) {
      error.value =
        'В файле не найдено договоров эквайринга. Проверьте, что это ОСВ по счёту 57.03.'
      result.value = null
      return
    }
    result.value = parsed
    selectedIndex.value = 0
  } catch (e) {
    console.error(e)
    error.value = 'Не удалось прочитать файл. Убедитесь, что это корректный Excel.'
    result.value = null
  } finally {
    loading.value = false
  }
}

function reset() {
  result.value = null
  selectedIndex.value = 0
  error.value = null
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <h1 class="title">Эквайринг-Аналитика</h1>
        <p class="subtitle">Сверка эквайринга по ОСВ 57.03 · данные не покидают браузер</p>
      </div>
      <button v-if="result" type="button" class="btn-reset" @click="reset">
        Загрузить другой файл
      </button>
    </header>

    <main class="main">
      <div v-if="!result" class="upload-screen">
        <Dropzone @file="onFile" />
        <p v-if="loading" class="status">Читаю файл…</p>
        <p v-if="error" class="status error">{{ error }}</p>
      </div>

      <div v-else class="dashboard">
        <aside class="sidebar">
          <h2 class="sidebar-title">Салоны / договоры</h2>
          <p class="file-name">{{ result.fileName }}</p>
          <SalonCard
            v-for="(c, i) in result.contracts"
            :key="i"
            :contract="c"
            :selected="i === selectedIndex"
            @select="selectedIndex = i"
          />
        </aside>

        <section class="content" v-if="selected">
          <h2 class="content-title">{{ selected.name }}</h2>
          <SummaryBar :contract="selected" />
          <DailyTable :contract="selected" />
          <AiChat
            :contracts="result.contracts"
            :selected="selected"
            :file-name="result.fileName"
          />
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #fff;
  border-bottom: 1px solid #dee2e6;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #1c7ed6;
}

.subtitle {
  margin: 4px 0 0;
  color: #868e96;
  font-size: 0.95rem;
}

.btn-reset {
  background: #fff;
  border: 2px solid #339af0;
  color: #1c7ed6;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 600;
}

.btn-reset:hover {
  background: #e7f5ff;
}

.main {
  flex: 1;
  padding: 28px;
}

.upload-screen {
  max-width: 720px;
  margin: 40px auto;
}

.status {
  text-align: center;
  margin-top: 20px;
  font-size: 1.1rem;
  color: #495057;
}

.status.error {
  color: #c92a2a;
  font-weight: 600;
}

.dashboard {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: 1400px;
  margin: 0 auto;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
}

.sidebar-title {
  margin: 0 0 8px;
  font-size: 1.15rem;
}

.file-name {
  margin: 0 0 16px;
  font-size: 0.85rem;
  color: #868e96;
  word-break: break-all;
}

.content {
  flex: 1;
  min-width: 0;
}

.content-title {
  margin: 0 0 16px;
  font-size: 1.35rem;
  word-break: break-word;
}

@media (max-width: 900px) {
  .dashboard {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }
}
</style>
