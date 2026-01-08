<template>
  <v-app>
    <v-layout>
      <v-navigation-drawer v-model="drawer" :rail="rail" app>
        <v-list density="comfortable" nav>
          <v-list-item to="/dashboard" title="RoomieConnect" subtitle="Expense sharing" prepend-icon="mdi-home" />

          <v-divider class="my-2" />
          <v-list-item to="/dashboard" title="Dashboard" prepend-icon="mdi-view-dashboard" />
          <v-list-item to="/activity" title="Activity" prepend-icon="mdi-format-list-bulleted" />
          <v-list-item to="/friends" title="Friends" prepend-icon="mdi-account-multiple" />
          <v-list-item to="/groups" title="Groups" prepend-icon="mdi-account-group" />
        </v-list>
        <v-divider class="my-2" />
        <div class="px-4 py-2 text-caption text-medium-emphasis">
          Built by Surya &amp; Rachana
        </div>

        <template #append>
          <div class="pa-2">
            <v-btn block variant="tonal" prepend-icon="mdi-logout" @click="logout">
              Logout
            </v-btn>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar app elevation="1">
        <v-btn icon variant="text" @click="drawer = !drawer">
          <v-icon icon="mdi-menu" />
        </v-btn>

        <v-btn icon variant="text" title="Home" @click="goHome">
          <v-icon icon="mdi-home-variant" />
        </v-btn>

        <v-btn icon variant="text" @click="rail = !rail" :title="rail ? 'Expand' : 'Collapse'">
          <v-icon :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'" />
        </v-btn>

        <v-spacer />

        <div v-if="user" class="d-none d-sm-flex align-center mr-2 text-body-2">
          <v-icon icon="mdi-account" class="mr-1" />
          <span class="font-weight-medium">{{ user.name }}</span>
        </div>

        <v-btn
          icon
          variant="text"
          :title="themeName === 'dark' ? 'Switch to light' : 'Switch to dark'"
          @click="toggleTheme"
        >
          <v-icon :icon="themeName === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
        </v-btn>
      </v-app-bar>

      <v-main>
        <v-container class="py-6" fluid>
          <slot />
        </v-container>
      </v-main>
    </v-layout>
  </v-app>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'

const router = useRouter()
const theme = useTheme()

const drawer = ref(true)
const rail = ref(false)

const user = computed(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})

const themeName = computed(() => theme.global.name.value)

function toggleTheme() {
  const next = theme.global.name.value === 'dark' ? 'light' : 'dark'
  theme.global.name.value = next
  try {
    localStorage.setItem('rc_theme', next)
  } catch {
    // ignore
  }
}

function logout() {
  localStorage.removeItem('user')
  router.push('/login')
}

function goHome() {
  router.push('/dashboard')
}

</script>

<style scoped>
/* Keep the main content readable on very wide screens */
.v-container {
  max-width: 1200px;
}
</style>
