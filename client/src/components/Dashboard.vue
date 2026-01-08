<template>
  <v-container fluid class="py-6">
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
      <div>
        <div class="text-h5 font-weight-bold">Dashboard</div>
        <div class="text-body-2 text-medium-emphasis">Insights across all your groups</div>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="loadAll" :loading="loading">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-row dense class="mb-4">
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="primary">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">This month spent</div>
            <div class="text-h6 font-weight-bold">${{ formatMoney(kpis.month_total) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="secondary">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Expenses count (this month)</div>
            <div class="text-h6 font-weight-bold">{{ kpis.month_count }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="success">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">All-time spent</div>
            <div class="text-h6 font-weight-bold">${{ formatMoney(kpis.all_time_total) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Removed the monthly spend chart. The Top groups card now spans the full width to avoid empty space. -->
    <v-row dense>
      <v-col cols="12">
        <v-card class="rounded-xl">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-trophy" />
            <span>Top groups (this month)</span>
          </v-card-title>
          <v-card-text>
            <v-list density="comfortable">
              <v-list-item
                v-for="g in topGroups"
                :key="g.id"
                :title="g.name"
                :subtitle="`$${formatMoney(g.total)}`"
                prepend-icon="mdi-account-group"
                @click="$router.push(`/groups/${g.id}`)"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row dense class="mt-2">
      <v-col cols="12" lg="6">
        <v-card class="rounded-xl">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-clock-outline" />
            <span>Recent expenses</span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="expenseHeaders"
              :items="recentExpenses"
              density="comfortable"
              class="rounded-lg"
              :items-per-page="5"
            >
              <template #item.amount="{ item }">
                ${{ formatMoney(item.amount) }}
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="rounded-xl">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-swap-horizontal" />
            <span>Recent transactions</span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="txHeaders"
              :items="recentTransactions"
              density="comfortable"
              class="rounded-lg"
              :items-per-page="5"
            >
              <template #item.amount="{ item }">
                ${{ formatMoney(item.amount) }}
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  </v-container>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
// Listen for global refresh triggers
import { refreshKey } from "../refresh.js";


const user = safeParse(localStorage.getItem("user"));
const loading = ref(false);
const error = ref("");

const kpis = ref({ month_total: 0, month_count: 0, all_time_total: 0 });
const monthly = ref([]);
const topGroups = ref([]);
const recentExpenses = ref([]);
const recentTransactions = ref([]);

// monthlyCanvas and chart variables are unused since the chart has been removed
const monthlyCanvas = ref(null);

const expenseHeaders = [
  { title: "Group", key: "group_name" },
  { title: "Description", key: "description" },
  { title: "Paid by", key: "paid_by_name" },
  { title: "Amount", key: "amount" },
  { title: "Date", key: "created_at" },
];

const txHeaders = [
  { title: "Group", key: "group_name" },
  { title: "From", key: "from_name" },
  { title: "To", key: "to_name" },
  { title: "Amount", key: "amount" },
  { title: "Date", key: "created_at" },
];

function apiUrl(path) {
  return `${import.meta.env.VITE_API_URL}${path}`;
}

function safeParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

function formatMoney(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

function formatDate(v) {
  try { return new Date(v).toLocaleString(); } catch { return v; }
}

async function loadAll() {
  error.value = "";
  loading.value = true;
  try {
    if (!user?.id) throw new Error("Not logged in");
    const res = await fetch(apiUrl(`/dashboard/user/${user.id}`));
    if (!res.ok) throw new Error("Failed to load dashboard");
    const data = await res.json();
    kpis.value = data.kpis || kpis.value;
    monthly.value = data.monthly || [];
    topGroups.value = data.topGroups || [];
    recentExpenses.value = data.recentExpenses || [];
    recentTransactions.value = data.recentTransactions || [];
    renderMonthly();
  } catch (e) {
    error.value = e.message || "Error";
  } finally {
    loading.value = false;
  }
}

function renderMonthly() {
  // Chart rendering removed. No-op.
}

onMounted(loadAll);
watch(monthly, () => renderMonthly());

// When refreshKey changes, reload dashboard data
watch(refreshKey, () => {
  loadAll();
});
</script>
