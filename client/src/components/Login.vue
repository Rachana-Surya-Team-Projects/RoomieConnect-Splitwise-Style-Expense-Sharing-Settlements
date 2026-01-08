<template>
  <div>
    <div class="text-h6 font-weight-semibold mb-1">Sign in</div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      Use your email to access your groups and expenses.
    </div>

    <v-form @submit.prevent="loginUser" validate-on="submit">
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email-outline"
        autocomplete="email"
        required
      />

      <v-text-field
        v-model="password"
        label="Password"
        :type="showPassword ? 'text' : 'password'"
        prepend-inner-icon="mdi-lock-outline"
        :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        @click:append-inner="showPassword = !showPassword"
        autocomplete="current-password"
        required
      />

      <v-btn type="submit" block size="large" class="mt-2" :loading="loading">
        Login
      </v-btn>
    </v-form>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
      {{ error }}
    </v-alert>

    <div class="text-body-2 mt-6">
      Don’t have an account?
      <router-link to="/register">Create one</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function loginUser() {
  error.value = ''
  loading.value = true
  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
      email: email.value,
      password: password.value
    })

    localStorage.setItem('user', JSON.stringify(res.data))
    router.push('/groups')
  } catch (err) {
    error.value = 'Invalid email or password.'
    console.error('Login failed:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
a {
  text-decoration: none;
}
</style>
