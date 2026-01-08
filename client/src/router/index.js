// src/router/index.js
import { createRouter, createWebHistory } from "vue-router"
import Login from "../components/Login.vue"
import Register from "../components/Register.vue"
import Groups from "../components/Groups.vue"
import GroupDetails from "../components/GroupDetails.vue"
import Expenses from "../components/Expenses.vue"
import ExpenseDetails from "../components/ExpenseDetails.vue"
import EditExpense from "../components/EditExpense.vue"
import Dashboard from "../components/Dashboard.vue"
import Activity from "../components/Activity.vue"
import Friends from "../components/Friends.vue"

const routes = [
  // Smart home: go to groups if logged in
  { path: "/", redirect: () => (localStorage.getItem("user") ? "/groups" : "/login") },

  // Auth
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { guestOnly: true, layout: "auth" }
  },
  {
    path: "/register",
    name: "Register",
    component: Register,
    meta: { guestOnly: true, layout: "auth" }
  },

  // App
  {
    path: "/groups",
    name: "Groups",
    component: Groups,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/activity",
    name: "Activity",
    component: Activity,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/friends",
    name: "Friends",
    component: Friends,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/groups/:id",
    name: "GroupDetails",
    component: GroupDetails,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/groups/:id/expenses",
    name: "GroupExpenses",
    component: Expenses,
    meta: { requiresAuth: true, layout: "app" }
  },
  {
    path: "/expenses/:id",
    name: "ExpenseDetails",
    component: ExpenseDetails,
    meta: { requiresAuth: true, layout: "app" }
  },

  {
    path: "/expenses/:id/edit",
    name: "EditExpense",
    component: EditExpense,
    meta: { requiresAuth: true, layout: "app" }
  },

  // Catch-all
  { path: "/:pathMatch(.*)*", redirect: () => (localStorage.getItem("user") ? "/groups" : "/login") }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const user = localStorage.getItem("user")

  if (to.meta.requiresAuth && !user) {
    next("/login")
  } else if (to.meta.guestOnly && user) {
    next("/groups")
  } else {
    next()
  }
})

export default router
