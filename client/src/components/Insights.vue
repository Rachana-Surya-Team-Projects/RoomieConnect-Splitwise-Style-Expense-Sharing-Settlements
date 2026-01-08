<template>
  <v-container fluid class="pa-0">
    <!-- KPI cards -->
    <v-row class="mb-4" dense>
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="primary">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">This month</div>
            <div class="text-h6 font-weight-bold">${{ formatMoney(thisMonthTotal) }}</div>
            <div class="text-caption text-medium-emphasis">
              vs avg ${{ formatMoney(avgMonthlyTotal) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="secondary">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Best month</div>
            <div class="text-h6 font-weight-bold">
              {{ bestMonthLabel }}
            </div>
            <div class="text-caption text-medium-emphasis">
              ${{ formatMoney(bestMonthTotal) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="rounded-xl" variant="tonal" color="success">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Top payer</div>
            <div class="text-h6 font-weight-bold">{{ topPayerName }}</div>
            <div class="text-caption text-medium-emphasis">
              ${{ formatMoney(topPayerTotal) }} total
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts -->
    <v-row dense>
      <v-col cols="12" lg="8">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-chart-bar" />
            Monthly spend
          </v-card-title>
          <v-card-text>
            <div style="height: 320px">
              <canvas ref="monthlyCanvas" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-chart-donut" />
            Spend by payer
          </v-card-title>
          <v-card-text>
            <div style="height: 320px">
              <canvas ref="payerCanvas" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Insights table -->
    <v-row class="mt-4" dense>
      <v-col cols="12">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-lightbulb-on-outline" />
            Monthly insights
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="insightHeaders"
              :items="monthlyRows"
              item-key="month"
              density="comfortable"
              class="rounded-lg"
            >
              <template #item.total="{ item }">
                <span class="font-weight-medium">${{ formatMoney(item.total) }}</span>
              </template>

              <template #item.delta="{ item }">
                <v-chip :color="item.delta >= 0 ? 'success' : 'error'" variant="tonal" size="small">
                  {{ item.delta >= 0 ? '+' : '' }}${{ formatMoney(item.delta) }}
                </v-chip>
              </template>

              <template #no-data>
                <div class="py-6 text-center text-medium-emphasis">
                  Add some expenses to see insights.
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps({
  expenses: { type: Array, default: () => [] }
});

const monthlyCanvas = ref(null);
const payerCanvas = ref(null);
let monthlyChart = null;
let payerChart = null;

function formatMoney(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const monthlyTotals = computed(() => {
  const map = new Map();
  for (const e of props.expenses || []) {
    const k = monthKey(e.created_at);
    const amt = Number(e.amount || 0);
    map.set(k, (map.get(k) || 0) + amt);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
});

const payerTotals = computed(() => {
  const map = new Map();
  for (const e of props.expenses || []) {
    const name = e.paid_by_name || e.created_by_name || "Unknown";
    const amt = Number(e.amount || 0);
    map.set(name, (map.get(name) || 0) + amt);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
});

const avgMonthlyTotal = computed(() => {
  const arr = monthlyTotals.value.map(([, v]) => v);
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
});

const thisMonthTotal = computed(() => {
  const now = new Date();
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const found = monthlyTotals.value.find(([m]) => m === k);
  return found ? found[1] : 0;
});

const bestMonth = computed(() => {
  if (!monthlyTotals.value.length) return null;
  return monthlyTotals.value.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
});

const bestMonthLabel = computed(() => (bestMonth.value ? bestMonth.value[0] : "—"));
const bestMonthTotal = computed(() => (bestMonth.value ? bestMonth.value[1] : 0));

const topPayer = computed(() => (payerTotals.value.length ? payerTotals.value[0] : ["—", 0]));
const topPayerName = computed(() => topPayer.value[0]);
const topPayerTotal = computed(() => topPayer.value[1]);

const monthlyRows = computed(() => {
  const rows = monthlyTotals.value.map(([month, total]) => ({ month, total }));
  return rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].total : 0;
    return { ...r, delta: r.total - prev };
  });
});

const insightHeaders = [
  { title: "Month", key: "month", sortable: true },
  { title: "Total spend", key: "total", sortable: true, align: "end" },
  { title: "Change", key: "delta", sortable: true, align: "end" }
];

function renderCharts() {
  if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; }
  if (payerChart) { payerChart.destroy(); payerChart = null; }

  const mLabels = monthlyTotals.value.map(([k]) => k);
  const mData = monthlyTotals.value.map(([, v]) => Number(v || 0));
  if (monthlyCanvas.value && mLabels.length) {
    monthlyChart = new Chart(monthlyCanvas.value.getContext("2d"), {
      type: "bar",
      data: { labels: mLabels, datasets: [{ label: "Total ($)", data: mData }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: (val) => `$${val}` } }
        }
      }
    });
  }

  const pLabels = payerTotals.value.slice(0, 6).map(([k]) => k);
  const pData = payerTotals.value.slice(0, 6).map(([, v]) => Number(v || 0));
  if (payerCanvas.value && pLabels.length) {
    payerChart = new Chart(payerCanvas.value.getContext("2d"), {
      type: "doughnut",
      data: { labels: pLabels, datasets: [{ data: pData }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

onMounted(renderCharts);
watch(() => props.expenses, renderCharts, { deep: true });
onBeforeUnmount(() => {
  if (monthlyChart) monthlyChart.destroy();
  if (payerChart) payerChart.destroy();
});
</script>
