<template>
    <div class="logout">
      <button @click="logout">🚪 Logout</button>
    </div>
  </template>
  
  <script setup>
  import { useRouter } from "vue-router"
  
  const router = useRouter()
  
  function logout() {
    localStorage.removeItem("user")
    router.push("/login")
  }
  </script>
  
  <style scoped>
  .logout {
    text-align: right;
    margin-bottom: 15px;
  }
  
  button {
    background: #dc3545;
    border: none;
    padding: 8px 14px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  
  button:hover {
    background: #c82333;
  }
  </style>
  