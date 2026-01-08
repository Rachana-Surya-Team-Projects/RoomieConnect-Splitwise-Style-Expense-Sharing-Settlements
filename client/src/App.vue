<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from './layouts/AuthLayout.vue'
import AppShell from './layouts/AppShell.vue'

const route = useRoute()

const layout = computed(() => {
  return route.meta?.layout === 'auth' ? AuthLayout : AppShell
})
</script>
