import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Building, MapPin, Menu, X, LogOut, Route as RouteIcon } from 'lucide-react';
// @ts-ignore - shared-components находится вне проекта, но Vite разрешает путь корректно
import Header from '../../shared-components/Header';
import AdminOverview from './admin/AdminOverview';
import UsersManagement from './admin/UsersManagement';
import CompaniesManagement from './admin/CompaniesManagement';
import ServicePointsManagement from './admin/ServicePointsManagement';
import RoutesManagement from './admin/RoutesManagement';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: t('dashboard.admin.nav.dashboard'), href: '/admin', icon: LayoutDashboard },
    { name: t('dashboard.admin.nav.users'), href: '/admin/users', icon: Users },
    { name: t('dashboard.admin.nav.companies'), href: '/admin/companies', icon: Building },
    { name: t('dashboard.admin.nav.servicePoints'), href: '/admin/service-points', icon: MapPin },
    { name: t('dashboard.admin.nav.routes'), href: '/admin/routes', icon: RouteIcon },
  ];

  const handleLogout = () => {
    logout();
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">FeedbackATM Admin</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary-lightest text-primary-dark'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-gray-400 hover:text-gray-500"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <Header
          currentProject="feedbackatm"
          projectName="FeedbackATM Admin"
          mobileMenuButton={
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>
          }
          user={user}
          logout={handleLogout}
          showProfile={true}
          showBackButton={true}
          showLanguageSwitcher={true}
          showProjectSwitcher={true}
          navigate={navigate}
          currentPath={location.pathname}
          logoutText="Выйти"
          languages={[
            { code: 'ru', label: 'Русский' },
            { code: 'en', label: 'English' },
          ]}
          onLanguageChange={(code: string) => {
            localStorage.setItem('language', code);
          }}
        />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/companies" element={<CompaniesManagement />} />
            <Route path="/service-points" element={<ServicePointsManagement />} />
            <Route path="/routes" element={<RoutesManagement />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
