import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ADMIN_ROLES = ['ADMIN', 'PROJECT_LEAD'];
const MANAGER_ROLES = ['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR', 'OBSERVER'];

function redirectPathForRole(role: string | undefined): string {
  if (!role) return '/';
  const r = role.toUpperCase();
  if (ADMIN_ROLES.includes(r) || r.includes('ADMIN') || r.includes('LEAD')) return '/admin';
  if (MANAGER_ROLES.includes(r) || r.includes('MANAGER') || r.includes('SUPERVISOR') || r.includes('OBSERVER')) return '/manager';
  if (r === 'CLEANER' || r.includes('CLEANER')) return '/cleaner';
  return '/';
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** @deprecated use requiredRoles */
  requiredRole?: string;
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const roles = requiredRoles ?? (requiredRole ? [requiredRole] : undefined);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && user?.role) {
    const normalizedUserRole = user.role.toUpperCase();
    const allowed = roles.some((r) => r.toUpperCase() === normalizedUserRole);
    if (!allowed) {
      return <Navigate to={redirectPathForRole(user.role)} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
