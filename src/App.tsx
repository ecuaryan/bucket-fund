import { Route, Routes } from 'react-router-dom'
import LoginPage from '@/features/auth/LoginPage'
import HomePage from '@/features/buckets/HomePage'
import BucketsPage from '@/features/buckets/BucketsPage'
import SendPage from '@/features/sends/SendPage'
import HistoryPage from '@/features/history/HistoryPage'
import AdminPage from '@/features/admin/AdminPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/buckets" element={<BucketsPage />} />
      <Route path="/send" element={<SendPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}
