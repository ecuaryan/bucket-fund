import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import KeyboardViewport from '@/components/KeyboardViewport'
import { AuthProvider } from '@/lib/auth'
import { migrateLegacyStorageKeys } from '@/lib/localStorageMigrate'
import { registerPwaUpdateChecks } from '@/lib/pwaUpdate'
import './index.css'

migrateLegacyStorageKeys()
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registerPwaUpdateChecks(registration)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <KeyboardViewport />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
