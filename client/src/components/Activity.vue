<template>
  <v-container class="py-6">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h2 class="text-h5 font-weight-bold">Activity</h2>
        <div class="text-medium-emphasis">Everything you've done across all groups</div>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="load" :loading="loading">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-row dense>
      <v-col cols="12" md="6">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-receipt-text</v-icon>
            Recent expenses
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-list density="comfortable" v-if="recentExpenses.length">
              <v-list-item
                v-for="e in recentExpenses"
                :key="e.id"
                :title="e.description"
                :subtitle="formatExpenseSub(e)"
              >
                <template #prepend>
                  <v-avatar size="32" color="primary" variant="tonal">
                    <v-icon>mdi-cash</v-icon>
                  </v-avatar>
                </template>
                <template #append>
                  <div class="text-right">
                    <div class="font-weight-bold">{{ money(e.amount_cents) }}</div>
                    <div class="text-caption text-medium-emphasis">{{ formatDate(e.created_at) }}</div>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-medium-emphasis">No expenses yet.</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-swap-horizontal</v-icon>
            Recent transactions
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-list density="comfortable" v-if="recentTransactions.length">
              <v-list-item
                v-for="t in recentTransactions"
                :key="t.id"
                :title="transactionTitle(t)"
                :subtitle="transactionSub(t)"
              >
                <template #prepend>
                  <v-avatar size="32" color="secondary" variant="tonal">
                    <v-icon>mdi-credit-card</v-icon>
                  </v-avatar>
                </template>
                <template #append>
                  <div class="text-right">
                    <div class="font-weight-bold">{{ money(t.amount_cents) }}</div>
                    <div class="text-caption text-medium-emphasis">{{ formatDate(t.created_at) }}</div>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-medium-emphasis">No transactions yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import axios from 'axios'
import { ref, computed, onMounted, watch } from 'vue'
import { refreshKey } from '../refresh.js'

const loading = ref(false)
const error = ref('')

const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
})

const recentExpenses = ref([])
const recentTransactions = ref([])

onMounted(load)

// Reload when refresh key triggers
watch(refreshKey, () => {
  load();
})

async function load() {
  error.value = ''
  loading.value = true
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/dashboard/user/${user.value?.id}`)
    recentExpenses.value = res.data.recentExpenses || []
    recentTransactions.value = res.data.recentTransactions || []
  } catch (e) {
    error.value = 'Could not load activity.'
  } finally {
    loading.value = false
  }
}

function money(cents) {
  const n = Number(cents || 0) / 100
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString()
}

function formatExpenseSub(e) {
  const group = e.group_name ? `in ${e.group_name}` : ''
  const payer = e.paid_by_name ? `Paid by ${e.paid_by_name}` : ''
  return [payer, group].filter(Boolean).join(' • ')
}

function transactionTitle(t) {
  if (t.provider === 'manual') return 'Settle-up'
  return 'Payment'
}

function transactionSub(t) {
  const group = t.group_name ? `in ${t.group_name}` : ''
  const flow = t.from_name && t.to_name ? `${t.from_name} → ${t.to_name}` : ''
  return [flow, group].filter(Boolean).join(' • ')
}
</script>
