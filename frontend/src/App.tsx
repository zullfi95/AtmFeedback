import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './i18n';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import CleanerDashboard from './pages/CleanerDashboard';
import LoginPage from './pages/LoginPage';
import MapView from './pages/MapView';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router basename="/feedbackatm">
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } />

            {/* Role-specific routes (роли совпадают с бэкендом) */}
            <Route path="/admin/*" element={
              <ProtectedRoute requiredRoles={['ADMIN', 'PROJECT_LEAD']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/manager/*" element={
              <ProtectedRoute requiredRoles={['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR', 'OBSERVER']}>
                <ManagerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/cleaner/*" element={
              <ProtectedRoute requiredRoles={['CLEANER']}>
                <CleanerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/map" element={
              <ProtectedRoute>
                <MapView />
              </ProtectedRoute>
            } />
          </Routes>

          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Component to route to appropriate dashboard based on user role
function DashboardRouter() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  // Normalize role to uppercase for comparison
  const role = user.role?.toUpperCase() || '';

  switch (role) {
    case 'ADMIN':
    case 'PROJECT_LEAD':
      return <AdminDashboard />;
    case 'MANAGER':
    case 'OPERATIONS_MANAGER':
    case 'SUPERVISOR':
      return <ManagerDashboard />;
    case 'CLEANER':
    case 'OBSERVER':
      return <CleanerDashboard />;
    default:
      // Fallback: try to determine role from role name
      if (role.includes('ADMIN') || role.includes('LEAD')) {
        return <AdminDashboard />;
      }
      if (role.includes('MANAGER') || role.includes('SUPERVISOR')) {
        return <ManagerDashboard />;
      }
      if (role.includes('CLEANER') || role.includes('OBSERVER')) {
        return <CleanerDashboard />;
      }
      // Last resort: show error with role info for debugging
      return (
        <div className="p-4">
          <h2 className="text-xl font-bold text-red-600 mb-2">Unknown role</h2>
          <p className="text-gray-600">Your role: <strong>{user.role || 'undefined'}</strong></p>
          <p className="text-sm text-gray-500 mt-2">Please contact administrator to assign a valid role.</p>
        </div>
      );
  }
}

export default App;
