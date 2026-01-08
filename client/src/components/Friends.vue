<template>
  <v-container class="py-6">
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h2 class="text-h5 font-weight-bold">Friends</h2>
        <div class="text-medium-emphasis">Who owes whom, across all groups</div>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="load" :loading="loading">Refresh</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-card class="rounded-xl" elevation="2">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-multiple</v-icon>
        Net balances
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-list v-if="friends.length" density="comfortable">
          <v-list-item
            v-for="f in friends"
            :key="f.user_id"
            :title="f.name"
            :subtitle="subtitle(f.net_cents)"
          >
            <template #prepend>
              <v-avatar size="36" color="primary" variant="tonal">
                <span class="font-weight-bold">{{ initials(f.name) }}</span>
              </v-avatar>
            </template>
            <template #append>
              <div
                class="font-weight-bold"
                :class="Number(f.net_cents) >= 0 ? 'text-success' : 'text-error'"
              >
                {{ money(Math.abs(Number(f.net_cents))) }}
              </div>
            </template>
          </v-list-item>
        </v-list>
        <div v-else class="text-medium-emphasis">No friends balances yet. Add a few shared expenses first.</div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import axios from 'axios'
import { ref, computed, onMounted, watch } from 'vue'
import { refreshKey } from '../refresh.js'

const loading = ref(false)
const error = ref('')
const friends = ref([])

const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
})

onMounted(load)

// Reload when refresh key changes
watch(refreshKey, () => {
  load();
})

async function load() {
  error.value = ''
  loading.value = true
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/dashboard/friends/${user.value?.id}`)
    friends.value = res.data || []
  } catch (e) {
    error.value = 'Could not load friends balances.'
  } finally {
    loading.value = false
  }
}

function money(cents) {
  const n = Number(cents || 0) / 100
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function subtitle(netCents) {
  const v = Number(netCents || 0)
  if (v === 0) return 'Settled up'
  return v > 0 ? 'Owes you' : 'You owe'
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')
}
</script>
