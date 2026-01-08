<template>
  <v-container fluid class="pa-4">
    <v-breadcrumbs class="px-0 mb-2" :items="breadcrumbs" />

    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <div class="text-h6 font-weight-bold">
            {{ group?.name || 'Group Expenses' }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Manage and review all expenses
          </div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-text-field
          v-model="search"
          density="comfortable"
          variant="solo-filled"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search expenses..."
          hide-details
          style="min-width: 260px"
        />
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDialog">
          Add expense
        </v-btn>
      </div>
    </div>

    <v-card class="rounded-xl">
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="expenses"
          :search="search"
          :loading="loading"
          item-key="id"
          density="comfortable"
          hover
          class="rounded-lg"
        >
          <template #item.amount="{ item }">
            <span class="font-weight-medium">${{ Number(item.amount).toFixed(2) }}</span>
          </template>

          <template #item.created_at="{ item }">
            <span class="text-caption">{{ formatDate(item.created_at) }}</span>
          </template>

          <template #item.created_by_name="{ item }">
            <v-chip size="small" variant="tonal" color="primary">
              {{ item.created_by_name || 'Unknown' }}
            </v-chip>
          </template>

          <template #item.actions="{ item }">
            <v-btn size="small" variant="text" color="primary" @click="openExpense(item)">
              Details
            </v-btn>
          </template>

          <template #no-data>
            <div class="py-8 text-center text-medium-emphasis">
              No expenses yet.
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add Expense Dialog -->
    <v-dialog v-model="addDialog" max-width="680">
      <v-card class="rounded-xl">
        <v-card-title class="d-flex align-center justify-space-between">
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-plus-circle" />
            <span>Add expense</span>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="addDialog=false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">
            {{ formError }}
          </v-alert>

          <v-row>
            <v-col cols="12" md="7">
              <v-text-field
                v-model="form.description"
                label="Description"
                density="comfortable"
                prepend-inner-icon="mdi-text"
              />
            </v-col>
            <v-col cols="12" md="5">
              <v-text-field
                v-model="form.amount"
                label="Amount"
                type="number"
                density="comfortable"
                prepend-inner-icon="mdi-currency-usd"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.created_by"
                :items="payerOptions"
                label="Paid by"
                density="comfortable"
                prepend-inner-icon="mdi-account-cash"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.members"
                :items="memberOptions"
                label="Split between"
                multiple
                chips
                closable-chips
                density="comfortable"
                prepend-inner-icon="mdi-account-multiple"
              />
            </v-col>
          </v-row>

          <div class="text-caption text-medium-emphasis">
            Tip: choose the members who should share this expense.
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="addDialog=false">Cancel</v-btn>
          <v-btn :loading="saving" color="primary" variant="flat" @click="submit">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snack.show" :timeout="4000">
      {{ snack.text }}
      <template #actions>
        <v-btn variant="text" @click="snack.show=false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const groupId = route.params.id

const group = ref(null)
const expenses = ref([])
const loading = ref(false)
const search = ref('')

const addDialog = ref(false)
const saving = ref(false)
const formError = ref('')
const user = safeParse(localStorage.getItem('user'))

const form = ref({
  description: '',
  amount: '',
  created_by: user?.id || null,
  members: []
})

const snack = ref({ show: false, text: '' })

const headers = [
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Paid by', key: 'created_by_name', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true },
  { title: 'Date', key: 'created_at', sortable: true },
  { title: '', key: 'actions', sortable: false }
]

const memberOptions = computed(() =>
  (group.value?.members || []).map((m) => ({ title: m.name, value: m.id }))
)
const payerOptions = memberOptions

const breadcrumbs = computed(() => ([
  { title: 'Groups', to: '/groups' },
  { title: group.value?.name || 'Group', to: `/groups/${groupId}` },
  { title: 'Expenses', disabled: true }
]))

function exportPdf() {
  try {
    const doc = new jsPDF()
    const title = `RoomieConnect - ${group.value?.name || 'Group'} Expenses`
    doc.setFontSize(14)
    doc.text(title, 14, 16)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)

    const rows = (expenses.value || []).map(e => ([
      e.description || '',
      e.paid_by_name || '',
      `$${Number(e.amount || 0).toFixed(2)}`,
      new Date(e.created_at).toLocaleDateString()
    ]))

    autoTable(doc, {
      startY: 28,
      head: [['Description', 'Paid by', 'Amount', 'Date']],
      body: rows
    })

    doc.save(`RoomieConnect_${(group.value?.name || 'group').replace(/\s+/g,'_')}_expenses.pdf`)
  } catch (e) {
    console.error(e)
    snackbar('PDF export failed', 'error')
  }
}

onMounted(async () => {
  await loadAll()
})

function apiUrl(p) {
  return `${import.meta.env.VITE_API_URL}${p}`
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

async function safeReadJson(res) {
  try { return await res.json() } catch { return null }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString()
}

function goBack() {
  router.push(`/groups/${groupId}`)
}

function openExpense(item) {
  router.push(`/expenses/${item.id}`)
}

function openAddDialog() {
  formError.value = ''
  form.value = {
    description: '',
    amount: '',
    created_by: user?.id || (group.value?.members?.[0]?.id ?? null),
    members: []
  }
  addDialog.value = true
}

async function loadAll() {
  loading.value = true
  try {
    const [g, e] = await Promise.all([loadGroup(), loadExpenses()])
    return [g, e]
  } finally {
    loading.value = false
  }
}

async function loadGroup() {
  const res = await fetch(apiUrl(`/groups/${groupId}`))
  if (!res.ok) throw new Error('Failed to load group')
  group.value = await res.json()
  return group.value
}

async function loadExpenses() {
  const res = await fetch(apiUrl(`/groups/${groupId}/expenses`))
  if (!res.ok) throw new Error('Failed to load expenses')
  expenses.value = await res.json()
  return expenses.value
}

async function submit() {
  formError.value = ''
  const amt = Number(form.value.amount)
  if (!form.value.description?.trim()) {
    formError.value = 'Enter a description.'
    return
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    formError.value = 'Enter a valid amount.'
    return
  }
  if (!form.value.created_by) {
    formError.value = 'Select who paid.'
    return
  }

  saving.value = true
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}/expenses`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.value.description.trim(),
        amount: amt,
        created_by: form.value.created_by,
        members: Array.isArray(form.value.members) ? form.value.members : []
      })
    })
    if (!res.ok) {
      const payload = await safeReadJson(res)
      throw new Error(payload?.error || 'Failed to add expense')
    }
    addDialog.value = false
    snack.value = { show: true, text: 'Expense added' }
    await loadAll()
    // Trigger global refresh so dashboard/activity/friends update
    ;(await import('../refresh.js')).triggerRefresh()
  } catch (e) {
    formError.value = e?.message || 'Failed to add expense'
  } finally {
    saving.value = false
  }
}
</script>
