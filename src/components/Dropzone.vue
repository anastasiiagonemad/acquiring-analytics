<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'file', file: File): void
}>()

const active = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function isExcel(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.xlsx') || n.endsWith('.xls')
}

function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  const file = files[0]
  if (!isExcel(file)) {
    alert('Нужен файл Excel (.xlsx или .xls) — ОСВ по счёту 57.03 из 1С.')
    return
  }
  emit('file', file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  active.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  active.value = true
}

function onDragLeave() {
  active.value = false
}

function onClick() {
  inputRef.value?.click()
}

function onChange(e: Event) {
  const t = e.target as HTMLInputElement
  handleFiles(t.files)
  t.value = ''
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone-active': active }"
    role="button"
    tabindex="0"
    @click="onClick"
    @keydown.enter="onClick"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
  >
    <div class="dropzone-icon">📊</div>
    <h2 class="dropzone-title">Загрузите ОСВ 57.03</h2>
    <p class="dropzone-hint">
      Перетащите файл Excel из 1С сюда<br />
      или нажмите, чтобы выбрать (.xlsx / .xls)
    </p>
    <input
      ref="inputRef"
      type="file"
      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
      class="dropzone-input"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.dropzone {
  border: 3px dashed #ced4da;
  border-radius: 12px;
  padding: 60px;
  text-align: center;
  background: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  max-width: 640px;
  margin: 0 auto;
}

.dropzone-active {
  border-color: #339af0;
  background-color: #e7f5ff;
}

.dropzone-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.dropzone-title {
  margin: 0 0 12px;
  font-size: 1.5rem;
  font-weight: 600;
  color: #212529;
}

.dropzone-hint {
  margin: 0;
  color: #868e96;
  font-size: 1.05rem;
}

.dropzone-input {
  display: none;
}
</style>
