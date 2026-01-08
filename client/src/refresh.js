// A simple reactive refresh key used to trigger reloads across components.
// Components can watch `refreshKey` and call their load functions when it changes.

import { ref } from 'vue'

export const refreshKey = ref(0)

export function triggerRefresh() {
  // Increment the key to notify watchers
  refreshKey.value++
}