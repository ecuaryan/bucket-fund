import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PageFallback from '@/components/PageFallback'
import RequireAuth from '@/components/RequireAuth'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/features/auth/LoginPage'

const FamilyLoginPage = lazy(() => import('@/features/auth/FamilyLoginPage'))
const JoinPage = lazy(() => import('@/features/auth/JoinPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const HomePage = lazy(() => import('@/features/buckets/HomePage'))
const SendPage = lazy(() => import('@/features/sends/SendPage'))
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'))
const AdminPage = lazy(() => import('@/features/admin/AdminPage'))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<Navigate to="/login?signup=1" replace />} />
      <Route
        path="/login/family"
        element={
          <Lazy>
            <FamilyLoginPage />
          </Lazy>
        }
      />
      <Route
        path="/login/forgot"
        element={
          <Lazy>
            <ForgotPasswordPage />
          </Lazy>
        }
      />
      <Route
        path="/login/reset"
        element={
          <Lazy>
            <ResetPasswordPage />
          </Lazy>
        }
      />
      <Route
        path="/join"
        element={
          <Lazy>
            <JoinPage />
          </Lazy>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route
          path="/"
          element={
            <Lazy>
              <HomePage />
            </Lazy>
          }
        />
        <Route
          path="/send"
          element={
            <Lazy>
              <SendPage />
            </Lazy>
          }
        />
        <Route
          path="/history"
          element={
            <Lazy>
              <HistoryPage />
            </Lazy>
          }
        />
        <Route
          path="/admin"
          element={
            <Lazy>
              <AdminPage />
            </Lazy>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
