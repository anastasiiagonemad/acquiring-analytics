<script setup lang="ts">
import type { Contract } from '../types'
import { formatMoney } from '../utils/format'

defineProps<{
  contract: Contract
}>()

function rowClass(status: string): string {
  if (status === 'OVERPAYMENT') return 'row-overpayment'
  if (status === 'UNDERPAYMENT') return 'row-warning'
  return 'row-normal'
}

function statusLabel(status: string): string {
  if (status === 'OVERPAYMENT') return 'Излишек'
  if (status === 'UNDERPAYMENT') return 'Задержка'
  return 'ОК'
}

function tooltipText(status: string): string {
  if (status === 'OVERPAYMENT') {
    return 'На РС пришло больше, чем по кассе. Сверьте слип-чеки терминала — возможно, кассир не пробил чек ККМ.'
  }
  if (status === 'UNDERPAYMENT') {
    return 'Банк задерживает крупную сумму. Запросите статус транзакций в службе поддержки банка.'
  }
  return 'Штатная ситуация: деньги в пути или уже зачислены.'
}
</script>

<template>
  <div class="table-wrap">
    <div v-if="contract.hasGlobalError" class="global-alert" role="alert">
      Ошибка разнесения! По кассе 1С продаж нет, но в банк пришло
      {{ formatMoney(contract.totalCredit) }}
    </div>

    <table class="daily-table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Касса (Дебет)</th>
          <th>Банк (Кредит)</th>
          <th>Баланс 57.03</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(day, i) in contract.days"
          :key="i"
          :class="rowClass(day.status)"
        >
          <td>{{ day.date }}</td>
          <td class="num">{{ formatMoney(day.debit) }}</td>
          <td class="num">{{ formatMoney(day.credit) }}</td>
          <td class="num">{{ formatMoney(day.balance) }}</td>
          <td>
            <span class="tooltip-container">
              {{ statusLabel(day.status) }}
              <span class="tooltip-text">{{ tooltipText(day.status) }}</span>
            </span>
          </td>
        </tr>
        <tr v-if="contract.days.length === 0">
          <td colspan="5" class="empty">Нет подневных оборотов</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}

.global-alert {
  background: #fff5f5;
  border: 2px solid #fa5252;
  color: #c92a2a;
  border-radius: 10px;
  padding: 14px 18px;
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 16px;
}

.daily-table {
  width: 100%;
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.daily-table th {
  background: #e9ecef;
  text-align: left;
  padding: 12px 14px;
  font-size: 0.95rem;
  color: #495057;
  white-space: nowrap;
}

.daily-table td {
  padding: 12px 14px;
  border-top: 1px solid #f1f3f5;
  font-size: 1rem;
}

.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.row-normal:hover {
  background-color: #f8f9fa;
}

.row-overpayment {
  background-color: #fff5f5;
  color: #c92a2a;
}

.row-overpayment:hover {
  background-color: #ffe3e3;
}

.row-warning {
  background-color: #fff9db;
  color: #925310;
}

.row-warning:hover {
  background-color: #fff3bf;
}

.empty {
  text-align: center;
  color: #868e96;
  padding: 24px !important;
}

.tooltip-container {
  position: relative;
  display: inline-block;
  cursor: help;
  font-weight: 600;
  border-bottom: 1px dotted currentColor;
}

.tooltip-text {
  visibility: hidden;
  width: 260px;
  background-color: #343a40;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 8px;
  position: absolute;
  bottom: 125%;
  left: 50%;
  margin-left: -130px;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 10;
  font-weight: 400;
  font-size: 0.85rem;
  line-height: 1.35;
  pointer-events: none;
}

.tooltip-container:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}
</style>
