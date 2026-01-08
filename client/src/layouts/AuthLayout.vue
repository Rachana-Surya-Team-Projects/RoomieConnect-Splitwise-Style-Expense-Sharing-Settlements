<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="5" lg="4">
            <v-card elevation="8" class="pa-6">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="text-h5 font-weight-semibold">RoomieConnect</div>
                <v-btn
                  icon
                  variant="text"
                  :title="themeName === 'dark' ? 'Switch to light' : 'Switch to dark'"
                  @click="toggleTheme"
                >
                  <v-icon :icon="themeName === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
                </v-btn>
              </div>

              <slot />
            </v-card>
            <div class="text-center mt-4 text-medium-emphasis text-caption">
              Built with Vue + Vuetify + PostgreSQL
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()

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
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
