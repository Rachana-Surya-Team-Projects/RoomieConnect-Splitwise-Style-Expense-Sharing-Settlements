<template>
  <v-container class="py-6">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <div class="text-h5 font-weight-bold">Edit Expense</div>
        <div class="text-body-2 text-medium-emphasis">Modify your expense details</div>
      </div>
    </div>

    <!-- Error alert -->
    <v-alert v-if="error" type="error" variant="tonal" class="mb-3">
      {{ error }}
    </v-alert>

    <!-- Loading indicator while fetching initial data -->
    <div v-if="loading" class="d-flex justify-center my-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else>
      <v-form ref="formRef" class="mb-4">
        <v-text-field
          v-model="editForm.description"
          label="Description"
          dense
          required
        />
        <v-text-field
          v-model="editForm.amount"
          type="number"
          label="Amount (USD)"
          prefix="$"
          dense
          required
        />
        <v-select
          v-model="editForm.paid_by"
          :items="payerOptions"
          label="Paid by"
          dense
          item-title="title"
          item-value="value"
          required
        />
        <v-select
          v-model="editForm.members"
          :items="memberOptions"
          label="Split between"
          multiple
          clearable
          chips
          dense
          item-title="title"
          item-value="value"
        />
        <v-select
          v-model="editForm.split_mode"
          :items="splitModeOptions"
          label="Split type"
          dense
          item-title="title"
          item-value="value"
        />

        <!-- Split details when not equal -->
        <div v-if="editForm.split_mode !== 'equal'" class="mt-4">
          <div class="text-body-2 text-medium-emphasis mb-2">
            {{ splitInputs.hint }}
          </div>
          <div v-for="p in selectedMembersForSplit" :key="p.id" class="d-flex align-center mb-2">
            <div style="min-width: 120px" class="mr-2">{{ p.name }}</div>
            <v-text-field
              v-model="editSplitValues[p.id]"
              :label="splitInputs.label"
              type="number"
              dense
              hide-details
            />
          </div>
        </div>
      </v-form>
      <div class="d-flex ga-2 mt-4">
        <v-btn color="primary" :loading="saving" @click="submitEdit">Save</v-btn>
        <v-btn variant="outlined" @click="cancel">Cancel</v-btn>
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { triggerRefresh } from '../refresh.js'

const route = useRoute()
const router = useRouter()

const expenseId = Number(route.params.id)

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const expense = ref(null)
const splits = ref([])
const groupMembers = ref([])

// Edit form state
const editForm = ref({
  description: '',
  amount: '',
  paid_by: null,
  members: [],
  split_mode: 'equal'
})
const editSplitValues = ref({})

// Options
const splitModeOptions = [
  { title: 'Equal split', value: 'equal' },
  { title: 'Unequal amounts', value: 'unequal' },
  { title: 'By percentage', value: 'percent' },
  { title: 'By shares', value: 'shares' }
]

const memberOptions = computed(() =>
  groupMembers.value.map((m) => ({ title: m.name, value: m.id }))
)

const payerOptions = computed(() =>
  groupMembers.value.map((m) => ({ title: m.name, value: m.id }))
)

const selectedMembersForSplit = computed(() => {
  const ids = (editForm.value.members && editForm.value.members.length)
    ? editForm.value.members
    : groupMembers.value.map((m) => m.id)
  // Map for names
  const map = new Map(groupMembers.value.map((m) => [m.id, m.name]))
  return ids.map((id) => ({ id, name: map.get(id) || String(id) }))
})

const splitInputs = computed(() => {
  const mode = editForm.value.split_mode
  let label = ''
  let hint = ''
  if (mode === 'unequal') {
    label = 'Amount ($)'
    hint = 'Amounts should sum to total'
  } else if (mode === 'percent') {
    label = 'Percent (%)'
    hint = 'Percents should sum to 100'
  } else if (mode === 'shares') {
    label = 'Shares'
    hint = 'Any positive numbers'
  }
  return { mode, label, hint }
})

function buildSplitsPayload() {
  const mode = editForm.value.split_mode
  // If equal split, leave splits empty; backend will handle equal distribution
  if (mode === 'equal') return []
  const out = []
  for (const p of selectedMembersForSplit.value) {
    const raw = editSplitValues.value[p.id]
    const num = Number(raw)
    if (!Number.isFinite(num)) continue
    if (mode === 'unequal') {
      out.push({ user_id: p.id, share_cents: Math.round(num * 100) })
    } else if (mode === 'percent') {
      out.push({ user_id: p.id, percent: num })
    } else if (mode === 'shares') {
      out.push({ user_id: p.id, shares: num })
    }
  }
  return out
}

// Load expense and group members
onMounted(async () => {
  try {
    // Fetch expense details
    const eRes = await fetch(`${import.meta.env.VITE_API_URL}/expenses/${expenseId}`)
    if (!eRes.ok) throw new Error('Failed to load expense')
    expense.value = await eRes.json()
    // Fetch splits
    const sRes = await fetch(`${import.meta.env.VITE_API_URL}/expenses/${expenseId}/splits`)
    if (!sRes.ok) throw new Error('Failed to load splits')
    splits.value = await sRes.json()
    // Fetch group members
    const gid = expense.value.group_id
    const gRes = await fetch(`${import.meta.env.VITE_API_URL}/groups/${gid}`)
    if (!gRes.ok) throw new Error('Failed to load group')
    const groupData = await gRes.json()
    groupMembers.value = groupData.members || []
    // Populate edit form
    editForm.value.description = expense.value.description || ''
    editForm.value.amount = (Number(expense.value.amount_cents) / 100).toFixed(2)
    editForm.value.paid_by = expense.value.paid_by || expense.value.created_by || null
    // Participants default to all splits participants
    const participants = splits.value.map((s) => s.user_id)
    editForm.value.members = participants
    // Determine split mode: equal if all shares equal, else default to unequal
    const shareCents = splits.value.map((s) => Number(s.share_cents))
    let mode = 'unequal'
    if (shareCents.length > 0 && shareCents.every((v) => v === shareCents[0])) {
      mode = 'equal'
    }
    editForm.value.split_mode = mode
    // Populate split values
    const totalCents = Number(expense.value.amount_cents)
    for (const s of splits.value) {
      if (mode === 'equal') {
        // equal mode does not need values
        continue
      } else if (mode === 'unequal') {
        editSplitValues.value[s.user_id] = (Number(s.share_cents) / 100).toFixed(2)
      } else if (mode === 'percent') {
        const pct = totalCents > 0 ? (Number(s.share_cents) * 100) / totalCents : 0
        editSplitValues.value[s.user_id] = pct.toFixed(2)
      } else if (mode === 'shares') {
        // Use share_cents directly as shares for editing; original share counts not stored
        editSplitValues.value[s.user_id] = Number(s.share_cents)
      }
    }
  } catch (e) {
    console.error('EditExpense load error:', e)
    error.value = e.message || 'Could not load expense data.'
  } finally {
    loading.value = false
  }
})

async function submitEdit() {
  error.value = ''
  saving.value = true
  try {
    // Validate
    const amtNum = Number(editForm.value.amount)
    if (!editForm.value.description?.trim()) {
      error.value = 'Description is required.'
      return
    }
    if (!amtNum || amtNum <= 0) {
      error.value = 'Enter a valid amount.'
      return
    }
    if (!editForm.value.paid_by) {
      error.value = 'Select who paid.'
      return
    }
    const body = {
      description: editForm.value.description.trim(),
      amount: amtNum,
      paid_by: editForm.value.paid_by,
      participants: Array.isArray(editForm.value.members) ? editForm.value.members : [],
      split_mode: editForm.value.split_mode,
      splits: buildSplitsPayload()
    }
    const res = await fetch(`${import.meta.env.VITE_API_URL}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      throw new Error(payload?.error || 'Failed to update expense')
    }
    // Trigger global refresh so all pages update
    triggerRefresh()
    // Navigate back to expense details
    router.push(`/expenses/${expenseId}`)
  } catch (e) {
    console.error('EditExpense submit error:', e)
    error.value = e.message || 'Error updating expense.'
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push(`/expenses/${expenseId}`)
}
</script>