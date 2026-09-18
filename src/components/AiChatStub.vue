<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <div class="ai-stub">
    <button type="button" class="ai-toggle" @click="open = !open">
      {{ open ? 'Скрыть AI-помощник' : 'AI-помощник (скоро)' }}
    </button>
    <div v-if="open" class="ai-panel">
      <p>
        Чат с AI-помощником по сверке эквайринга появится на следующем этапе.
        Сейчас все расчёты выполняются локально в браузере без отправки данных.
      </p>
    </div>
  </div>
</template>

<style scoped>
.ai-stub {
  margin-top: 24px;
}

.ai-toggle {
  background: #e7f5ff;
  border: 1px solid #74c0fc;
  color: #1864ab;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
}

.ai-toggle:hover {
  background: #d0ebff;
}

.ai-panel {
  margin-top: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 14px 16px;
  color: #495057;
  font-size: 0.95rem;
}
</style>
