<script setup lang="ts">
import type { Contract } from '../types'
import { formatMoney } from '../utils/format'
import { computed } from 'vue'

const props = defineProps<{
  contract: Contract
}>()

const summary = computed(() => {
  const c = props.contract
  return {
    lastBalance: formatMoney(c.lastBalance),
    overpaymentCount: c.overpaymentCount,
    underpaymentCount: c.underpaymentCount,
    firstProblemDate: c.firstProblemDate,
    days: c.days.length,
  }
})
</script>

<template>
  <div class="summary">
    <div class="summary-item">
      <span class="label">Последний баланс</span>
      <span class="value">{{ summary.lastBalance }}</span>
    </div>
    <div class="summary-item">
      <span class="label">Дней в периоде</span>
      <span class="value">{{ summary.days }}</span>
    </div>
    <div class="summary-item">
      <span class="label">Излишков</span>
      <span class="value" :class="{ bad: summary.overpaymentCount > 0 }">
        {{ summary.overpaymentCount }}
      </span>
    </div>
    <div class="summary-item">
      <span class="label">Задержек банка</span>
      <span class="value" :class="{ warn: summary.underpaymentCount > 0 }">
        {{ summary.underpaymentCount }}
      </span>
    </div>
    <div class="summary-item">
      <span class="label">Первая проблема</span>
      <span class="value">{{ summary.firstProblemDate ?? '—' }}</span>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.summary-item {
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 140px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  flex: 1;
}

.label {
  display: block;
  font-size: 0.85rem;
  color: #868e96;
  margin-bottom: 4px;
}

.value {
  font-size: 1.15rem;
  font-weight: 700;
  color: #212529;
}

.value.bad {
  color: #c92a2a;
}

.value.warn {
  color: #925310;
}
</style>
