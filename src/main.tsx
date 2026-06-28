import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import KeyboardViewport from '@/components/KeyboardViewport'
import { AuthProvider } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { migrateLegacyStorageKeys } from '@/lib/localStorageMigrate'
import { registerBackgroundPrivacyShield } from '@/lib/backgroundPrivacyShield'
import { setupPwaUpdates } from '@/lib/pwaUpdate'
import { syncPerfFlagFromUrl } from '@/lib/perfTiming'
import './index.css'

syncPerfFlagFromUrl()
migrateLegacyStorageKeys()
registerBackgroundPrivacyShield()
setupPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <KeyboardViewport />
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
