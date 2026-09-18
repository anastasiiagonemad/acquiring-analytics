<script setup lang="ts">
import type { Contract } from '../types'
import { formatMoney } from '../utils/format'

defineProps<{
  contract: Contract
  selected: boolean
}>()

defineEmits<{
  (e: 'select'): void
}>()
</script>

<template>
  <button
    type="button"
    class="salon-card"
    :class="{
      selected,
      danger: contract.hasGlobalError || contract.overpaymentCount > 0,
    }"
    @click="$emit('select')"
  >
    <div class="salon-name">{{ contract.name }}</div>
    <div class="salon-meta">
      <span>Баланс: {{ formatMoney(contract.lastBalance) }}</span>
    </div>
    <div v-if="contract.hasGlobalError" class="salon-badge error">Ошибка разнесения</div>
    <div v-else-if="contract.overpaymentCount > 0" class="salon-badge error">
      Излишек: {{ contract.overpaymentCount }} дн.
    </div>
    <div v-else-if="contract.underpaymentCount > 0" class="salon-badge warn">
      Задержка: {{ contract.underpaymentCount }} дн.
    </div>
    <div v-else class="salon-badge ok">В норме</div>
  </button>
</template>

<style scoped>
.salon-card {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 14px 16px;
  background: #fff;
  margin-bottom: 10px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.salon-card:hover {
  border-color: #adb5bd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.salon-card.selected {
  border-color: #339af0;
  box-shadow: 0 0 0 2px rgba(51, 154, 240, 0.25);
}

.salon-card.danger {
  background: #fff5f5;
  border-color: #ffa8a8;
}

.salon-card.danger.selected {
  border-color: #fa5252;
  box-shadow: 0 0 0 2px rgba(250, 82, 82, 0.25);
}

.salon-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 6px;
  word-break: break-word;
}

.salon-meta {
  font-size: 0.9rem;
  color: #495057;
  margin-bottom: 8px;
}

.salon-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.salon-badge.ok {
  background: #ebfbee;
  color: #2b8a3e;
}

.salon-badge.error {
  background: #ffe3e3;
  color: #c92a2a;
}

.salon-badge.warn {
  background: #fff3bf;
  color: #925310;
}
</style>
