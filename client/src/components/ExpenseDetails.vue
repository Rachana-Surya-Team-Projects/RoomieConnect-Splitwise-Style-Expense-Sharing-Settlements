<template>
  <v-container class="py-6">
    <!-- Header with back link and title -->
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap ga-2">
      <div class="d-flex align-center ga-2">
        <v-btn
          variant="text"
          icon="mdi-arrow-left"
          aria-label="Back to Group"
          @click="goBack"
        />
        <div>
          <div class="text-h5 font-weight-bold">{{ expense?.description || 'Expense' }}</div>
          <div class="text-body-2 text-medium-emphasis">View expense details</div>
        </div>
      </div>
    </div>

    <!-- Error alert -->
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <!-- Expense details card -->
    <v-card v-if="expense" class="rounded-xl">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="6">
            <div class="font-weight-medium mb-1">Amount</div>
            <div class="text-h6">${{ formatMoney(expense.amount) }}</div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="font-weight-medium mb-1">Added By</div>
            <div class="text-h6">{{ expense.paid_by_name || 'Unknown' }}</div>
          </v-col>
          <v-col cols="12" md="6">
            <div class="font-weight-medium mb-1">Date</div>
            <div class="text-h6">{{ formatDate(expense.created_at) }}</div>
          </v-col>
        </v-row>

        <v-divider class="my-4" />

        <div class="text-subtitle-1 font-weight-medium mb-2">Split Details</div>
        <v-list density="comfortable" v-if="splits.length">
          <v-list-item
            v-for="s in splits"
            :key="s.user_id"
            :title="s.name"
            :subtitle="`$${formatMoney(s.share)}`"
          />
        </v-list>
        <div v-else class="text-medium-emphasis">No split details found</div>

        <v-btn
          v-if="expense.created_by === user?.id"
          color="primary"
          variant="outlined"
          prepend-icon="mdi-pencil"
          class="mt-4 mr-2"
          @click="editExpense"
        >
          Edit Expense
        </v-btn>
        <v-btn
          v-if="expense.created_by === user?.id"
          color="error"
          variant="tonal"
          prepend-icon="mdi-delete"
          class="mt-4"
          @click="deleteExpense"
        >
          Delete Expense
        </v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
// Extract route params: id (expense id) and optional groupId
const { id } = route.params
const groupIdParam = route.params.groupId
// Local reactive group id.  If groupId is undefined from the route,
// we will update this after loading the expense.
const groupIdLocal = ref(groupIdParam || null)
const expense = ref(null)
const splits = ref([])
const error = ref('')
const user = (() => {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
})()

onMounted(async () => {
  await loadExpense()
  await loadSplits()
})

function apiUrl(path) {
  return `${import.meta.env.VITE_API_URL}${path}`
}

async function loadExpense() {
  try {
    const res = await fetch(apiUrl(`/expenses/${id}`))
    if (!res.ok) throw new Error('Failed to load expense')
    const data = await res.json()
    expense.value = data
    // Set group id from expense data if not provided in route
    if (!groupIdLocal.value && data.group_id) {
      groupIdLocal.value = data.group_id
    }
  } catch (err) {
    error.value = 'Could not load expense'
  }
}

async function loadSplits() {
  try {
    const res = await fetch(apiUrl(`/expenses/${id}/splits`))
    if (!res.ok) throw new Error('Failed to load splits')
    const data = await res.json()
    // Transform splits to include user name and share amount in dollars
    splits.value = data.map((s) => ({
      user_id: s.user_id,
      name: s.user_name || s.name || '',
      share: Number(s.share_cents) / 100
    }))
  } catch (err) {
    error.value = 'Could not load split info'
  }
}

function formatMoney(v) {
  const n = Number(v || 0)
  return n.toFixed(2)
}

function formatDate(v) {
  try { return new Date(v).toLocaleString() } catch { return v }
}

function goBack() {
  if (groupIdLocal.value) {
    router.push(`/groups/${groupIdLocal.value}`)
  } else {
    router.push('/groups')
  }
}

function editExpense() {
  router.push(`/expenses/${id}/edit`)
}

async function deleteExpense() {
  if (!confirm('Are you sure you want to delete this expense?')) return
  try {
    const res = await fetch(apiUrl(`/expenses/${id}`), {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to delete')
    // Redirect back to the group details page using the resolved group id
    if (groupIdLocal.value) {
      router.push(`/groups/${groupIdLocal.value}`)
    } else {
      router.push('/groups')
    }
  } catch (err) {
    error.value = 'Could not delete expense'
  }
}
</script>

<style scoped>
/* Additional spacing helpers */
.ga-2 { gap: 8px; }
</style>