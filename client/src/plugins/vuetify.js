// client/src/plugins/vuetify.js

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

// Persisted theme ("light" | "dark")
const savedTheme = (() => {
  try {
    return localStorage.getItem('rc_theme') || 'dark'
  } catch {
    return 'dark'
  }
})()

export const vuetify = createVuetify({
  theme: {
    defaultTheme: savedTheme,
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F7F7FB',
          surface: '#FFFFFF',
          primary: '#3F51B5',
          secondary: '#00BCD4',
          error: '#D32F2F',
          info: '#0288D1',
          success: '#2E7D32',
          warning: '#ED6C02'
        }
      },
      dark: {
        dark: true,
        colors: {
          background: '#0F1220',
          surface: '#171A2B',
          primary: '#90CAF9',
          secondary: '#80DEEA',
          error: '#EF9A9A',
          info: '#81D4FA',
          success: '#A5D6A7',
          warning: '#FFCC80'
        }
      }
    }
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi }
  },
  defaults: {
    VBtn: {
      rounded: 'lg'
    },
    VCard: {
      rounded: 'xl'
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable'
    }
  }
})
