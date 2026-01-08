<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-3">
      <div class="text-subtitle-1 font-weight-medium">Transaction history</div>

      <div class="d-flex align-center ga-2">
        <v-btn
          variant="tonal"
          color="primary"
          prepend-icon="mdi-cash-sync"
          @click="emit('settle')"
        >
          Settle up
        </v-btn>

        <v-progress-circular v-if="loading" indeterminate size="20" />
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">
      {{ error }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="items"
      :loading="loading"
      item-key="id"
      density="comfortable"
      hover
      class="rounded-lg"
      :items-per-page="8"
    >
      <template #item.amount="{ item }">
        <v-chip :color="item.provider === 'stripe' ? 'primary' : 'secondary'" variant="tonal">
          ${{ formatMoney(item.amount) }}
        </v-chip>
      </template>

      <template #item.provider="{ item }">
        <v-chip :color="item.provider === 'stripe' ? 'primary' : 'grey'" variant="tonal">
          {{ item.provider }}
        </v-chip>
      </template>

      <template #item.status="{ item }">
        <v-chip :color="item.status === 'succeeded' ? 'success' : 'error'" variant="tonal">
          {{ item.status }}
        </v-chip>
      </template>

      <template #item.created_at="{ item }">
        {{ formatDate(item.created_at) }}
      </template>
    </v-data-table>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";

const props = defineProps({
  groupId: { type: [String, Number], required: true }
});

// ✅ NEW: allow parent to handle settle-up dialog
const emit = defineEmits(["settle"]);

const items = ref([]);
const loading = ref(true);
const error = ref("");

const headers = [
  { title: "Provider", key: "provider" },
  { title: "From", key: "from_name" },
  { title: "To", key: "to_name" },
  { title: "Amount", key: "amount" },
  { title: "Status", key: "status" },
  { title: "Note", key: "note" },
  { title: "Date", key: "created_at" },
];

function apiUrl(path) {
  return `${import.meta.env.VITE_API_URL}${path}`;
}

function formatMoney(v) {
  return Number(v || 0).toFixed(2);
}

function formatDate(v) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

async function load() {
  error.value = "";
  loading.value = true;
  try {
    const res = await fetch(apiUrl(`/groups/${props.groupId}/transactions`));
    if (!res.ok) throw new Error("Failed to load transactions");
    items.value = await res.json();
  } catch (e) {
    error.value = e.message || "Error";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.groupId, load);
</script>
