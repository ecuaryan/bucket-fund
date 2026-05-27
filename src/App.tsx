import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from '@/components/RequireAuth'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/features/auth/LoginPage'
import FamilyLoginPage from '@/features/auth/FamilyLoginPage'
import JoinPage from '@/features/auth/JoinPage'
import HomePage from '@/features/buckets/HomePage'
import BucketsPage from '@/features/buckets/BucketsPage'
import SendPage from '@/features/sends/SendPage'
import HistoryPage from '@/features/history/HistoryPage'
import AdminPage from '@/features/admin/AdminPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/family" element={<FamilyLoginPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/buckets" element={<BucketsPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
