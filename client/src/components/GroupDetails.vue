<template>
  <v-container class="py-6" fluid>
    <!-- Header row -->
    <v-row class="align-center" no-gutters>
      <v-col cols="12" md="8">
        <div class="d-flex align-center ga-3">
          <v-btn
            icon
            variant="text"
            @click="$router.push('/groups')"
            aria-label="Back to Groups"
          >
            <v-icon icon="mdi-arrow-left" />
          </v-btn>

          <div>
            <div class="text-h5 font-weight-bold">
              {{ group?.name || "Group" }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              <span v-if="group">Join code: <strong>{{ group.join_code }}</strong></span>
              <span v-else>Loading…</span>
            </div>
          </div>
        </div>
      </v-col>

      <v-col cols="12" md="4" class="d-flex justify-end ga-2 mt-3 mt-md-0">
        <v-btn
          prepend-icon="mdi-plus"
          color="primary"
          :disabled="!group"
          @click="addExpenseDialog = true"
        >
          Add expense
        </v-btn>

        <v-btn
          v-if="group && Number(group.created_by) === Number(user?.id)"
          prepend-icon="mdi-delete"
          color="error"
          variant="tonal"
          @click="deleteGroupDialog = true"
        >
          Delete group
        </v-btn>
      </v-col>
    </v-row>

    <!-- Alerts -->
    <v-row class="mt-4" no-gutters>
      <v-col cols="12">
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
      </v-col>
    </v-row>

    <!-- Content -->
    <v-row class="mt-2" no-gutters>
      <v-col cols="12">
        <v-card rounded="lg" elevation="2">
          <v-card-text>
            <!-- Quick stats -->
            <v-row class="mb-4" dense>
              <v-col cols="12" md="4">
                <v-card class="rounded-xl" variant="tonal" color="primary">
                  <v-card-text>
                    <div class="text-caption text-medium-emphasis">Total spent</div>
                    <div class="text-h6 font-weight-bold">${{ formatMoney(totalSpent) }}</div>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="4">
                <v-card class="rounded-xl" variant="tonal" color="success">
                  <v-card-text>
                    <div class="text-caption text-medium-emphasis">You get</div>
                    <div class="text-h6 font-weight-bold">${{ formatMoney(youGet) }}</div>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="4">
                <v-card class="rounded-xl" variant="tonal" color="error">
                  <v-card-text>
                    <div class="text-caption text-medium-emphasis">You owe</div>
                    <div class="text-h6 font-weight-bold">${{ formatMoney(youOwe) }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-tabs v-model="tab" color="primary" density="comfortable" show-arrows class="group-tabs">
              <v-tab value="expenses" prepend-icon="mdi-receipt-text">Expenses</v-tab>
              <v-tab value="balances" prepend-icon="mdi-scale-balance">Balances</v-tab>
              <v-tab value="transactions" prepend-icon="mdi-swap-horizontal">Transactions</v-tab>
              <v-tab value="members" prepend-icon="mdi-account-multiple">Members</v-tab>
            </v-tabs>

            <v-divider class="my-4" />

            <v-window v-model="tab">
              <!-- Expenses tab -->
              <v-window-item value="expenses">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="text-subtitle-1 font-weight-medium">Recent expenses</div>
                  <v-progress-circular
                    v-if="loadingExpenses"
                    indeterminate
                    size="20"
                  />
                </div>

                <v-data-table
                  :headers="expenseHeaders"
                  :items="expenses"
                  :loading="loadingExpenses"
                  item-key="id"
                  density="comfortable"
                  hover
                  class="rounded-lg"
                >
                  <template #item.amount="{ item }">
                    <span class="font-weight-medium">${{ formatMoney(item.amount) }}</span>
                  </template>

                  <template #item.created_at="{ item }">
                    <span class="text-body-2">{{ formatDate(item.created_at) }}</span>
                  </template>

                  <template #item.actions="{ item }">
                    <v-btn
                      size="small"
                      variant="text"
                      prepend-icon="mdi-open-in-new"
                      @click="openExpense(item.id)"
                    >
                      Details
                    </v-btn>
                  </template>

                  <template #no-data>
                    <div class="py-8 text-center text-medium-emphasis">
                      No expenses yet.
                    </div>
                  </template>
                </v-data-table>
              </v-window-item>

              <!-- Transactions tab (Insights tab removed) -->
              <v-window-item value="transactions">
                <Transactions :group-id="groupId" @settle="openSettleUp" />
              </v-window-item>

              <!-- Balances tab -->
              <v-window-item value="balances">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="text-subtitle-1 font-weight-medium">Net balances</div>
                  <div class="d-flex align-center ga-2">
                    <v-btn variant="tonal" color="primary" prepend-icon="mdi-cash-sync" @click="openSettleUp">
                      Settle up
                    </v-btn>
                    <v-progress-circular v-if="loadingBalances" indeterminate size="20" />
                  </div>
                </div>

                <v-row>
                  <v-col cols="12" lg="8">
                    <v-data-table
                      :headers="balanceHeaders"
                      :items="balances"
                      :loading="loadingBalances"
                      item-key="user_id"
                      density="comfortable"
                      hover
                      class="rounded-lg"
                    >
                      <template #item.amount="{ item }">
                        <v-chip
                          :color="balanceColor(item)"
                          variant="tonal"
                          class="font-weight-medium"
                        >
                          {{ balanceLabel(item) }}
                        </v-chip>
                      </template>

                      <template #no-data>
                        <div class="py-8 text-center text-medium-emphasis">
                          No balances to show.
                        </div>
                      </template>
                    </v-data-table>
                  </v-col>

                  <v-col cols="12" lg="4">
                    <v-card variant="tonal" rounded="lg">
                      <v-card-title class="text-subtitle-1">How this works</v-card-title>
                      <v-card-text class="text-body-2 text-medium-emphasis">
                        Positive means the person <strong>gets back</strong> money.
                        Negative means the person <strong>owes</strong> money.
                        <br /><br />
                        This is computed from all expenses and splits in the group.
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-window-item>

              <!-- Members tab -->
              <v-window-item value="members">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="text-subtitle-1 font-weight-medium">Members</div>
                  <v-chip v-if="group" variant="tonal" color="primary">
                    {{ group.members?.length || 0 }} total
                  </v-chip>
                </div>

                <v-row>
                  <v-col
                    v-for="m in (group?.members || [])"
                    :key="m.id"
                    cols="12"
                    md="6"
                  >
                    <v-card rounded="lg" variant="outlined">
                      <v-card-text class="d-flex align-center justify-space-between">
                        <div class="d-flex align-center ga-3">
                          <v-avatar color="primary" variant="tonal">
                            {{ initials(m.name) }}
                          </v-avatar>
                          <div>
                            <div class="font-weight-medium">{{ m.name }}</div>
                            <div class="text-body-2 text-medium-emphasis">{{ m.email }}</div>
                          </div>
                        </div>

                        <v-chip
                          v-if="group && Number(group.created_by) === Number(m.id)"
                          color="secondary"
                          variant="tonal"
                          size="small"
                        >
                          Owner
                        </v-chip>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add expense dialog -->
    <v-dialog v-model="addExpenseDialog" max-width="700">
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Add expense</span>
          <v-btn icon="mdi-close" variant="text" @click="addExpenseDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-form ref="expenseFormRef" @submit.prevent="submitExpense">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="expenseForm.description"
                  label="Description"
                  placeholder="Dinner, groceries, rent…"
                  variant="outlined"
                  :rules="[(v) => !!v || 'Required']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="expenseForm.amount"
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="$"
                  variant="outlined"
                  :rules="[(v) => (v !== null && v !== '' && Number(v) > 0) || 'Enter amount']"
                  required
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseForm.created_by"
                  :items="payerOptions"
                  item-title="title"
                  item-value="value"
                  label="Paid by"
                  variant="outlined"
                  :rules="[(v) => !!v || 'Select payer']"
                  required
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseForm.members"
                  :items="memberOptions"
                  item-title="title"
                  item-value="value"
                  label="Split between"
                  variant="outlined"
                  multiple
                  chips
                  clearable
                  hint="Leave empty to split among everyone"
                  persistent-hint
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseForm.split_mode"
                  :items="splitModeOptions"
                  item-title="title"
                  item-value="value"
                  label="Split type"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" v-if="expenseForm.split_mode !== 'equal'">
                <v-card variant="tonal" class="rounded-xl">
                  <v-card-text>
                    <div class="text-subtitle-2 mb-2">Split details</div>
                    <v-row dense>
                      <v-col
                        v-for="m in splitParticipants"
                        :key="m.user_id"
                        cols="12" md="4"
                      >
                      <v-text-field
                        v-model.number="expenseSplitValues[m.user_id]"
                        :label="splitFieldLabel(m.name)"
                        type="number"
                        step="0.01"
                        variant="outlined"
                      />
                      </v-col>
                    </v-row>
                    <div class="text-caption text-medium-emphasis">
                      Unequal: enter amounts. Percent: enter %. Shares: enter share units.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-alert v-if="expenseFormError" type="error" variant="tonal" class="mt-2">
              {{ expenseFormError }}
            </v-alert>
          </v-form>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-6 py-4">
          <v-spacer />
          <v-btn variant="text" @click="addExpenseDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingExpense" @click="submitExpense">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete group dialog -->
    <v-dialog v-model="deleteGroupDialog" max-width="520">
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon icon="mdi-alert" />
          Delete group
        </v-card-title>
        <v-card-text class="text-body-2 text-medium-emphasis">
          This will permanently delete the group and all its expenses.
          This action cannot be undone.
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="deleteGroupDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingGroup" @click="confirmDeleteGroup">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>

    <!-- Settle Up Dialog -->
    <v-dialog v-model="settleDialog" max-width="560">
      <v-card class="rounded-xl">
        <v-card-title class="d-flex align-center justify-space-between">
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-cash-sync" />
            <span>Settle up</span>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="settleDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert v-if="settleError" type="error" variant="tonal" class="mb-3">
            {{ settleError }}
          </v-alert>
          <v-row dense class="mb-2">
            <v-col cols="12">
              <v-radio-group v-model="settleMethod" inline>
                <v-radio label="Record settlement" value="manual" />
                <v-radio label="Pay with Stripe" value="stripe" />
              </v-radio-group>
              <div v-if="settleMethod === 'stripe'" class="text-caption text-medium-emphasis">
                Stripe will confirm payment via webhook and then update balances.
              </div>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="settleForm.from_user_id"
                :items="members"
                item-title="name"
                item-value="user_id"
                label="From (payer)"
                density="comfortable"
                prepend-inner-icon="mdi-account"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="settleForm.to_user_id"
                :items="members"
                item-title="name"
                item-value="user_id"
                label="To (receiver)"
                density="comfortable"
                prepend-inner-icon="mdi-account-arrow-right"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="settleForm.amount"
                label="Amount"
                type="number"
                density="comfortable"
                prepend-inner-icon="mdi-currency-usd"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="settleForm.note"
                label="Note (optional)"
                density="comfortable"
                prepend-inner-icon="mdi-text"
              />
            </v-col>
          </v-row>

          <div class="text-caption text-medium-emphasis">
            This records a settlement and updates group balances.
          </div>

          <div v-if="settleMethod==='stripe'" class="mt-4">
            <v-alert v-if="stripeError" type="error" variant="tonal" class="mb-3">{{ stripeError }}</v-alert>
            <div v-show="stripeClientSecret" class="pa-3 rounded-lg" style="background: rgba(255,255,255,0.04);">
              <div class="text-subtitle-2 mb-2">Card details</div>
              <div id="payment-element"></div>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="settleDialog = false">Cancel</v-btn>
          <v-btn :loading="settling" color="primary" variant="flat" @click="submitSettleUp">
            {{ settleBtnLabel }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { triggerRefresh } from '../refresh.js'
import Transactions from './Transactions.vue'
import { loadStripe } from '@stripe/stripe-js'

const route = useRoute()
const router = useRouter()

const groupId = route.params.id
const user = safeParse(localStorage.getItem('user'))

const group = ref(null)
const expenses = ref([])
const balances = ref([])
const transactions = ref([])

// dashboard stats
const totalSpent = computed(() =>
  (expenses.value || []).reduce((s, e) => s + Number(e.amount || 0), 0)
)

const myNet = computed(() => {
  const me = (balances.value || []).find((b) => Number(b.user_id) === Number(user?.id))
  return me ? Number(me.amount || 0) : 0
})

const youGet = computed(() => (myNet.value > 0 ? myNet.value : 0))
const youOwe = computed(() => (myNet.value < 0 ? Math.abs(myNet.value) : 0))

const loadingExpenses = ref(true)
const loadingBalances = ref(true)
const error = ref('')

const tab = ref('expenses')

// dialogs
const addExpenseDialog = ref(false)
const deleteGroupDialog = ref(false)

// add expense form
const expenseFormRef = ref(null)
const expenseFormError = ref('')
const savingExpense = ref(false)
const deletingGroup = ref(false)

const expenseForm = ref({
  description: '',
  amount: null,
  created_by: user?.id ?? null,
  members: [],
  split_mode: 'equal'
})

// Split input values keyed by user_id
const expenseSplitValues = ref({})

const splitModeOptions = [
  { title: 'Equal split', value: 'equal' },
  { title: 'Unequal amounts', value: 'unequal' },
  { title: 'By percentage', value: 'percent' },
  { title: 'By shares', value: 'shares' }
]

const selectedMembersForSplit = computed(() => {
  const ids = (expenseForm.value.members || []).length
    ? expenseForm.value.members
    : (group.value?.members || []).map((m) => m.id)
  const map = new Map((group.value?.members || []).map((m) => [m.id, m.name]))
  return ids.map((id) => ({ id, name: map.get(id) || String(id) }))
})

// Convert selected member IDs into objects with user_id and name.  This array
// is used to drive the split detail inputs and payload generation.  When no
// members are explicitly selected, all group members are used.
const splitParticipants = computed(() => {
  return selectedMembersForSplit.value.map(({ id, name }) => ({ user_id: id, name }))
})

// Dynamically build the input label for each participant based on the
// chosen split mode.  For unequal splits we display a dollar sign,
// percentages include a '%' suffix and shares include 'shares'.
function splitFieldLabel(name) {
  const mode = expenseForm.value.split_mode
  if (mode === 'percent') return `${name} (%)`
  if (mode === 'shares') return `${name} shares`
  return `${name} ($)`
}

// Retain a computed that returns meta information about the selected split
// mode.  This was originally used to generate a list of rows but now
// exists solely for the label and hint strings shown in the UI.
const splitInputs = computed(() => {
  const mode = expenseForm.value.split_mode || 'equal'
  const label =
    mode === 'unequal'
      ? 'Amount ($)'
      : mode === 'percent'
      ? 'Percent (%)'
      : mode === 'shares'
      ? 'Shares'
      : ''
  const hint =
    mode === 'unequal'
      ? 'Amounts should sum to total'
      : mode === 'percent'
      ? 'Percents should sum to 100'
      : mode === 'shares'
      ? 'Any positive numbers'
      : ''
  return { mode, label, hint }
})

function buildSplitsPayload() {
  const mode = expenseForm.value.split_mode
  if (mode === 'equal') return []
  // Loop over each selected participant and convert the raw values
  // entered by the user into the appropriate format for the API.
  const out = []
  for (const p of splitParticipants.value) {
    const raw = expenseSplitValues.value[p.user_id]
    const num = Number(raw)
    if (!Number.isFinite(num) || num < 0) continue
    if (mode === 'unequal') {
      // convert dollars to cents and send as share_cents
      out.push({ user_id: p.user_id, share_cents: Math.round(num * 100) })
    } else if (mode === 'percent') {
      out.push({ user_id: p.user_id, percent: num })
    } else if (mode === 'shares') {
      out.push({ user_id: p.user_id, shares: num })
    }
  }
  return out
}

const expenseHeaders = [
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Paid by', key: 'paid_by_name', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true, align: 'end' },
  { title: 'Date', key: 'created_at', sortable: true },
  { title: '', key: 'actions', sortable: false }
]

const balanceHeaders = [
  { title: 'Member', key: 'name', sortable: true },
  { title: 'Balance', key: 'amount', sortable: true }
]

const memberOptions = computed(() =>
  (group.value?.members || []).map((m) => ({ title: m.name, value: m.id }))
)

const payerOptions = computed(() =>
  (group.value?.members || []).map((m) => ({ title: m.name, value: m.id }))
)

const members = computed(() =>
  (group.value?.members || []).map((m) => ({ user_id: m.id, name: m.name }))
)

const settleDialog = ref(false)
const settling = ref(false)
const settleBtnLabel = computed(() => {
  if (settleMethod.value === 'stripe') {
    return stripeClientSecret.value ? 'Pay now' : 'Continue to payment'
  }
  return 'Confirm'
})

const settleError = ref('')
const settleMethod = ref('manual') // 'manual' | 'stripe'
const stripeClientSecret = ref('')
const stripeReady = ref(false)
const stripeError = ref('')
let stripe = null
let elements = null
let paymentElement = null

const settleForm = ref({
  from_user_id: user?.id || null,
  to_user_id: null,
  amount: '',
  note: ''
})

onMounted(async () => {
  await loadGroup()
  await Promise.all([loadExpenses(), loadBalances()])
  // Pre-load transactions so the tab has data on first click
  await loadTransactions()
})

function apiUrl(path) {
  return `${import.meta.env.VITE_API_URL}${path}`
}

async function loadGroup() {
  error.value = ''
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}`))
    if (!res.ok) throw new Error('Failed to load group')
    group.value = await res.json()
    // Default payer to current user if they are in the group
    if (!expenseForm.value.created_by) {
      expenseForm.value.created_by = user?.id ?? null
    }
  } catch (e) {
    error.value = 'Could not load group.'
  }
}

async function loadExpenses() {
  loadingExpenses.value = true
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}/expenses`))
    if (!res.ok) throw new Error('Failed to load expenses')
    expenses.value = await res.json()
  } catch (e) {
    error.value = error.value || 'Could not load expenses.'
  } finally {
    loadingExpenses.value = false
  }
}

async function loadBalances() {
  loadingBalances.value = true
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}/balances`))
    if (!res.ok) throw new Error('Failed to load balances')
    balances.value = await res.json()
  } catch (e) {
    error.value = error.value || 'Could not load balances.'
  } finally {
    loadingBalances.value = false
  }
}

async function loadTransactions() {
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}/transactions`))
    if (!res.ok) throw new Error('Failed to load transactions')
    transactions.value = await res.json()
  } catch (e) {
    // non-fatal
    console.warn('Transactions load:', e)
  }
}

async function setupStripeElement() {
  stripeError.value = ''
  try {
    const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!pk) throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is missing in client/.env')
    stripe = await loadStripe(pk)
    if (!stripe) throw new Error('Failed to initialize Stripe')

    const mountEl = document.getElementById('payment-element')
    if (!mountEl) return

    // cleanup
    mountEl.innerHTML = ''
    elements = stripe.elements({ clientSecret: stripeClientSecret.value })
    paymentElement = elements.create('payment')
    paymentElement.mount('#payment-element')
    stripeReady.value = true
  } catch (e) {
    stripeError.value = e.message || 'Stripe setup error'
  }
}

function openSettleUp() {
  stripeClientSecret.value = ''
  stripeError.value = ''
  settleMethod.value = 'manual'

  settleError.value = ''
  // default payer to current user if present
  settleForm.value = {
    from_user_id: user?.id || (group.value?.members?.[0]?.id ?? null),
    to_user_id: null,
    amount: '',
    note: ''
  }
  settleDialog.value = true
}

async function submitSettleUp() {
  settleError.value = ''
  stripeError.value = ''

  const amt = Number(settleForm.value.amount)
  if (!settleForm.value.from_user_id || !settleForm.value.to_user_id) {
    settleError.value = 'Select both payer and receiver.'
    return
  }
  if (Number(settleForm.value.from_user_id) === Number(settleForm.value.to_user_id)) {
    settleError.value = 'Payer and receiver must be different.'
    return
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    settleError.value = 'Enter a valid amount.'
    return
  }

  settling.value = true
  try {
    if (settleMethod.value === 'manual') {
      const res = await fetch(apiUrl(`/payments/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: Number(groupId),
          from_user_id: Number(settleForm.value.from_user_id),
          to_user_id: Number(settleForm.value.to_user_id),
          amount: amt,
          note: settleForm.value.note || ''
        })
      })
      if (!res.ok) {
        const payload = await safeReadJson(res)
        throw new Error(payload?.error || 'Failed to settle up')
      }
      settleDialog.value = false
      stripeClientSecret.value = ''
      await loadBalances()
      await loadTransactions()
      // Trigger global refresh so dashboard/activity/friends update
      triggerRefresh()
      return
    }

    // Stripe flow: first create intent then show payment element; second click confirms payment
    if (!stripeClientSecret.value) {
      const res = await fetch(apiUrl(`/payments/create-intent`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: Math.round(amt * 100),
          group_id: Number(groupId),
          from_user_id: Number(settleForm.value.from_user_id),
          to_user_id: Number(settleForm.value.to_user_id),
          note: settleForm.value.note || 'Settle up'
        })
      })
      const data = await safeReadJson(res)
      if (!res.ok) {
        throw new Error(data?.error || 'Stripe is not configured')
      }
      stripeClientSecret.value = data.clientSecret
      await setupStripeElement()
      return
    }

    if (!stripe || !elements) {
      await setupStripeElement()
    }

    const { error: payErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    })

    if (payErr) throw new Error(payErr.message || 'Payment failed')

    // Webhook will record settlement so re-fetch balances & transactions
    settleDialog.value = false
    stripeClientSecret.value = ''
    await loadBalances()
    await loadTransactions()
    // Trigger global refresh
    triggerRefresh()
  } catch (e) {
    if (settleMethod.value === 'stripe') stripeError.value = e?.message || 'Stripe error'
    else settleError.value = e?.message || 'Failed to settle up'
  } finally {
    settling.value = false
  }
}

function openExpense(expenseId) {
  // Navigate to global expense details page
  router.push(`/expenses/${expenseId}`)
}

async function submitExpense() {
  expenseFormError.value = ''

  // Basic validation
  if (!expenseForm.value.description?.trim()) {
    expenseFormError.value = 'Description is required.'
    return
  }
  const amt = Number(expenseForm.value.amount)
  if (!amt || amt <= 0) {
    expenseFormError.value = 'Enter a valid amount.'
    return
  }
  if (!expenseForm.value.created_by) {
    expenseFormError.value = 'Select who paid.'
    return
  }

  // Validate split details for non-equal modes.  For unequal splits the sum of
  // entered amounts must match the total expense.  For percent splits the
  // percentages must sum to exactly 100.  For shares there must be at least
  // one positive share.  Errors will be displayed to the user and halt
  // submission.
  const mode = expenseForm.value.split_mode
  if (mode === 'unequal') {
    let sumCents = 0
    let missing = false
    for (const p of splitParticipants.value) {
      const raw = expenseSplitValues.value[p.user_id]
      const num = Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        missing = true
        break
      }
      sumCents += Math.round(num * 100)
    }
    if (missing) {
      expenseFormError.value = 'Enter valid amounts for all participants.'
      return
    }
    const totalCents = Math.round(amt * 100)
    if (sumCents !== totalCents) {
      expenseFormError.value = `Split amounts must sum to $${amt.toFixed(2)}.`
      return
    }
  } else if (mode === 'percent') {
    let sumPct = 0
    let invalid = false
    for (const p of splitParticipants.value) {
      const raw = expenseSplitValues.value[p.user_id]
      const num = Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        invalid = true
        break
      }
      sumPct += num
    }
    if (invalid) {
      expenseFormError.value = 'Enter valid percents for all participants.'
      return
    }
    if (Math.round(sumPct) !== 100) {
      expenseFormError.value = 'Percents should sum to 100.'
      return
    }
  } else if (mode === 'shares') {
    let hasPositive = false
    for (const p of splitParticipants.value) {
      const raw = expenseSplitValues.value[p.user_id]
      const num = Number(raw)
      if (Number.isFinite(num) && num > 0) {
        hasPositive = true
        break
      }
    }
    if (!hasPositive) {
      expenseFormError.value = 'Enter at least one positive share.'
      return
    }
  }

  savingExpense.value = true
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}/expenses`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: expenseForm.value.description.trim(),
        amount: amt,
        created_by: expenseForm.value.created_by,
        members: Array.isArray(expenseForm.value.members) ? expenseForm.value.members : [],
        split_mode: expenseForm.value.split_mode,
        splits: buildSplitsPayload()
      })
    })
    if (!res.ok) {
      const payload = await safeReadJson(res)
      throw new Error(payload?.error || 'Failed to add expense')
    }

    addExpenseDialog.value = false
    // reset but keep payer
    expenseForm.value = {
      description: '',
      amount: null,
      created_by: expenseForm.value.created_by,
      members: [],
      split_mode: 'equal'
    }
    expenseSplitValues.value = {}

    await Promise.all([loadExpenses(), loadBalances()])
    // Trigger global refresh so dashboard/activity/friends update
    triggerRefresh()
  } catch (e) {
    expenseFormError.value = e?.message || 'Error adding expense.'
  } finally {
    savingExpense.value = false
  }
}

async function confirmDeleteGroup() {
  if (!user?.id) {
    error.value = 'You must be logged in to delete a group.'
    return
  }

  deletingGroup.value = true
  try {
    const res = await fetch(apiUrl(`/groups/${groupId}?user_id=${user.id}`), { method: 'DELETE' })
    if (!res.ok) {
      const payload = await safeReadJson(res)
      throw new Error(payload?.error || 'Failed to delete group')
    }
    deleteGroupDialog.value = false
    router.push('/groups')
  } catch (e) {
    error.value = e?.message || 'Error deleting group.'
  } finally {
    deletingGroup.value = false
  }
}

function formatMoney(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

function initials(name) {
  const s = (name || '').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join('')
}

function balanceColor(item) {
  const amt = Number(item.amount)
  if (amt > 0) return 'success'
  if (amt < 0) return 'error'
  return 'secondary'
}

function balanceLabel(item) {
  const amt = Number(item.amount)
  const formatted = `$${Math.abs(amt).toFixed(2)}`
  if (amt > 0) return `Gets ${formatted}`
  if (amt < 0) return `Owes ${formatted}`
  return 'Even'
}

function safeParse(str) {
  try {
    return str ? JSON.parse(str) : null
  } catch {
    return null
  }
}

async function safeReadJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}
</script>

<style scoped>
.ga-2 { gap: 8px; }
.ga-3 { gap: 12px; }

/* group-tabs */
.group-tabs { margin-top: 10px; }
.group-tabs .v-tab { text-transform: none; letter-spacing: .2px; padding: 8px 14px; margin-right: 8px; border-radius: 14px; }
.group-tabs .v-tab--selected { box-shadow: 0 6px 18px rgba(0,0,0,.10); }

</style>
