<template>
  <div>
    <div class="text-h6 font-weight-semibold mb-1">Create account</div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      Start sharing expenses with your roommates.
    </div>

    <v-form @submit.prevent="registerUser" validate-on="submit">
      <v-text-field
        v-model="name"
        label="Name"
        prepend-inner-icon="mdi-account-outline"
        autocomplete="name"
        required
      />

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
        autocomplete="new-password"
        required
      />

      <v-btn type="submit" block size="large" class="mt-2" :loading="loading">
        Create account
      </v-btn>
    </v-form>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
      {{ error }}
    </v-alert>

    <div class="text-body-2 mt-6">
      Already have an account?
      <router-link to="/login">Sign in</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function registerUser() {
  error.value = ''
  loading.value = true
  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, {
      name: name.value,
      email: email.value,
      password: password.value
    })

    localStorage.setItem('user', JSON.stringify(res.data))
    router.push('/groups')
  } catch (err) {
    // If backend returns duplicate email (23505), show a friendly message.
    const msg = err?.response?.data?.error || ''
    error.value = msg.toLowerCase().includes('exists')
      ? 'That email is already registered. Try signing in.'
      : 'Registration failed. Please try again.'
    console.error('Registration failed:', err)
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
