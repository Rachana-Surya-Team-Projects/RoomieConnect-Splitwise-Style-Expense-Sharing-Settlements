<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <div class="text-h5 font-weight-semibold">Groups</div>
        <div class="text-body-2 text-medium-emphasis">Create or join groups to start splitting expenses.</div>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="reload" :loading="loading">
        Refresh
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-row>
      <v-col cols="12" md="7">
        <v-skeleton-loader v-if="loading" type="list-item-two-line, list-item-two-line, list-item-two-line" />

        <v-card v-else elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Your groups</span>
            <v-chip v-if="groups.length" size="small" color="primary" variant="tonal">
              {{ groups.length }}
            </v-chip>
          </v-card-title>
          <v-divider />

          <v-list v-if="groups.length" density="comfortable">
            <v-list-item
              v-for="group in groups"
              :key="group.id"
              :to="`/groups/${group.id}`"
              prepend-icon="mdi-account-group"
            >
              <v-list-item-title class="font-weight-medium">{{ group.name }}</v-list-item-title>
              <v-list-item-subtitle>
                Code: <span class="font-weight-medium">{{ group.join_code }}</span>
                <span v-if="group.members?.length"> · {{ group.members.length }} members</span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-card-text v-else class="text-center py-10 text-medium-emphasis">
            No groups yet.
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card elevation="2" class="mb-4">
          <v-card-title>Create group</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="createGroup">
              <v-text-field
                v-model="newGroup"
                label="Group name"
                prepend-inner-icon="mdi-pencil-outline"
                :disabled="creating"
                required
              />
              <v-btn type="submit" block :loading="creating" :disabled="!newGroup">
                Create
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-card elevation="2">
          <v-card-title>Join group</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="joinGroup">
              <v-text-field
                v-model="joinCode"
                label="Join code"
                prepend-inner-icon="mdi-key-outline"
                :disabled="joining"
                required
              />
              <v-btn type="submit" block variant="tonal" :loading="joining" :disabled="!joinCode">
                Join
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const user = (() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()

const groups = ref([])
const loading = ref(true)
const creating = ref(false)
const joining = ref(false)
const error = ref('')

const newGroup = ref('')
const joinCode = ref('')

onMounted(async () => {
  await loadGroups()
})

async function reload() {
  loading.value = true
  await loadGroups()
}

async function loadGroups() {
  error.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/groups?user_id=${user?.id}`)
    if (!res.ok) throw new Error('Failed to fetch groups')
    groups.value = await res.json()
  } catch (err) {
    console.error('❌ Failed to fetch groups:', err)
    error.value = 'Could not load groups. Please try again.'
  } finally {
    loading.value = false
  }
}

async function createGroup() {
  if (!newGroup.value) return
  error.value = ''
  creating.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroup.value,
        owner_id: user?.id
      })
    })

    if (!res.ok) throw new Error('Failed to create group')
    const saved = await res.json()
    saved.members = [{ id: user.id, name: user.name }]
    groups.value.unshift(saved)
    newGroup.value = ''
  } catch (err) {
    console.error('❌ Error creating group:', err)
    error.value = 'Could not create group.'
  } finally {
    creating.value = false
  }
}

async function joinGroup() {
  if (!joinCode.value) return
  error.value = ''
  joining.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/groups/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: joinCode.value,
        user_id: user?.id
      })
    })
    if (!res.ok) throw new Error('Failed to join group')
    const joined = await res.json()

    const existing = groups.value.find(g => g.id === joined.id)
    if (existing) {
      existing.members = joined.members
    } else {
      groups.value.unshift(joined)
    }
    joinCode.value = ''
  } catch (err) {
    console.error('❌ Error joining group:', err)
    error.value = 'Invalid join code or unable to join group.'
  } finally {
    joining.value = false
  }
}
</script>

<style scoped>
a {
  text-decoration: none;
}
</style>
