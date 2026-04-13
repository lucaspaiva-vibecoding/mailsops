import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute, PublicOnlyRoute } from './routes'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ProfilePage } from './pages/settings/ProfilePage'
import { ContactsPage } from './pages/contacts/ContactsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { CampaignsPage } from './pages/campaigns/CampaignsPage'
import { CampaignBuilderPage } from './pages/campaigns/CampaignBuilderPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public only */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/campaigns/new" element={<CampaignBuilderPage />} />
                <Route path="/campaigns/:id/edit" element={<CampaignBuilderPage />} />
                <Route path="/templates" element={<PlaceholderPage title="Templates" />} />
                <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
                <Route path="/settings/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            {/* Default */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
