<template>
    <header class="app-header">
      <h2 class="logo">🛋 RoomieConnect</h2>
      <div class="user-controls">
        <span v-if="user">Welcome, {{ user.name }} 👋</span>
        <Logout />
      </div>
    </header>
  </template>
  
  <script setup>
  import Logout from "./Logout.vue"
  
  const user = JSON.parse(localStorage.getItem("user"))
  </script>
  
  <style scoped>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
    padding: 12px 20px;
    border-bottom: 1px solid #ddd;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .logo {
    margin: 0;
    color: #007bff;
  }
  
  .user-controls {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 14px;
  }
  
  .user-controls span {
    font-weight: 500;
    color: #333;
  }
  </style>
  