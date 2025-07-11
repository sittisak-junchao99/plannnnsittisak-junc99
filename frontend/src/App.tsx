import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AuthProvider } from '@/lib/auth-context'

// Layout Components
import Layout from '@/components/layout/Layout'
import AuthLayout from '@/components/layout/AuthLayout'

// Auth Pages
import LoginPage from '@/pages/auth/LoginPage'
import SignUpPage from '@/pages/auth/SignUpPage'

// Main Pages
import DashboardPage from '@/pages/DashboardPage'
import DriversPage from '@/pages/drivers/DriversPage'
import VehiclesPage from '@/pages/vehicles/VehiclesPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import RoutesPage from '@/pages/routes/RoutesPage'
import SchedulesPage from '@/pages/schedules/SchedulesPage'
import InstancesPage from '@/pages/instances/InstancesPage'
import ConflictsPage from '@/pages/conflicts/ConflictsPage'
import SuggestionsPage from '@/pages/suggestions/SuggestionsPage'
import AlertsPage from '@/pages/alerts/AlertsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SettingsPage from '@/pages/settings/SettingsPage'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth/*" element={
          <PublicRoute>
            <AuthLayout>
              <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignUpPage />} />
                <Route path="*" element={<Navigate to="/auth/login" replace />} />
              </Routes>
            </AuthLayout>
          </PublicRoute>
        } />

        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/drivers/*" element={<DriversPage />} />
                <Route path="/vehicles/*" element={<VehiclesPage />} />
                <Route path="/customers/*" element={<CustomersPage />} />
                <Route path="/routes/*" element={<RoutesPage />} />
                <Route path="/schedules/*" element={<SchedulesPage />} />
                <Route path="/instances/*" element={<InstancesPage />} />
                <Route path="/conflicts" element={<ConflictsPage />} />
                <Route path="/suggestions" element={<SuggestionsPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}

export default App