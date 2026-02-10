import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  TrendingUp,
  Filter,
  Menu,
  Image as ImageIcon,
  Route,
  User,
  Trash2,
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { managerAPI, adminAPI } from '../services/api';
// @ts-ignore - shared-components находится вне проекта, но Vite разрешает путь корректно
import Header from '../../shared-components/Header';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Task {
  id: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  notes?: string;
  managerNotes?: string;
  photos?: string;
  createdAt?: string;
  updatedAt?: string;
  servicePoint: {
    id: string;
    name: string;
    type: 'ATM' | 'BUS_STOP';
    address: string;
  };
  cleaner: {
    id: string;
    username: string;
  };
}

interface ServicePoint {
  id: string;
  name: string;
  type: 'ATM' | 'BUS_STOP';
  address: string;
  latitude?: number;
  longitude?: number;
  _count: {
    cleaningTasks: number;
  };
}

const ManagerDashboard = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'points' | 'routes'>('overview');
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.4093, 49.8671]); // Default to Baku
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    servicePointId: '',
    cleanerId: '',
    scheduledAt: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<ServicePoint[]>([]);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState({
    servicePointId: '',
    cleanerId: '',
    scheduledAt: '',
    status: 'PENDING'
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cleanerFilter, setCleanerFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Маршруты
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeCleaners, setRouteCleaners] = useState<{ id: string; username: string }[]>([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [routeForm, setRouteForm] = useState({ name: '', cleanerId: '', servicePointIds: [] as string[] });
  const [routePointsSearch, setRoutePointsSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, pointsRes, statsRes, usersRes, routesRes, cleanersRes] = await Promise.all([
        managerAPI.getTasks(),
        managerAPI.getServicePoints(),
        managerAPI.getStats(),
        adminAPI.getUsers(),
        managerAPI.getRoutes().catch(() => ({ data: { routes: [] } })),
        managerAPI.getCleaners().catch(() => ({ data: { cleaners: [] } }))
      ]);

      // Ensure arrays are always arrays, even if API returns null/undefined
      setTasks(Array.isArray(tasksRes.data?.tasks) ? tasksRes.data.tasks : []);
      const pointsData = Array.isArray(pointsRes.data?.servicePoints) ? pointsRes.data.servicePoints : [];
      setServicePoints(pointsData);
      setFilteredPoints(pointsData);
      setStats(statsRes.data?.stats || null);
      
      // Calculate map center based on points with coordinates
      if (pointsData.length > 0) {
        const pointsWithCoords = pointsData.filter((p: ServicePoint) => p.latitude && p.longitude);
        if (pointsWithCoords.length > 0) {
          const avgLat = pointsWithCoords.reduce((sum: number, p: ServicePoint) => sum + (p.latitude || 0), 0) / pointsWithCoords.length;
          const avgLng = pointsWithCoords.reduce((sum: number, p: ServicePoint) => sum + (p.longitude || 0), 0) / pointsWithCoords.length;
          setMapCenter([avgLat, avgLng]);
        }
      }
      const users = Array.isArray(usersRes.data?.users) ? usersRes.data.users : [];
      const cleaners = users.filter((u: any) => u.role === 'CLEANER');
      setUsers(cleaners);
      setRoutes(Array.isArray(routesRes.data?.routes) ? routesRes.data.routes : []);
      setRouteCleaners(Array.isArray(cleanersRes.data?.cleaners) ? cleanersRes.data.cleaners : cleaners);
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to load dashboard data';
      toast.error(errorMessage);
      console.error('Load data error:', error);
      // Set empty arrays on error to prevent filter errors
      setTasks([]);
      setServicePoints([]);
      setFilteredPoints([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter points based on selected cleaner
  const handleCleanerChange = (cleanerId: string) => {
    setNewTask({ ...newTask, cleanerId, servicePointId: '' }); // Reset point selection
    
    if (!cleanerId) {
      setFilteredPoints(servicePoints);
      return;
    }

    // Find selected cleaner with assigned points
    const cleaner = users.find((u: any) => u.id === cleanerId);
    if (cleaner && cleaner.assignedPoints) {
      const assignedPointIds = cleaner.assignedPoints.map((a: any) => a.servicePoint.id);
      const filtered = servicePoints.filter((p: ServicePoint) => assignedPointIds.includes(p.id));
      setFilteredPoints(filtered);
      
      if (filtered.length === 0) {
        toast.error('No points assigned to this cleaner. Please assign points first.');
      }
    } else {
      setFilteredPoints([]);
      toast.error('No points assigned to this cleaner. Please assign points first.');
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await managerAPI.createTask({
        ...newTask,
        scheduledAt: newTask.scheduledAt || undefined
      });
      toast.success('Task created successfully');
      setShowCreateTaskModal(false);
      setNewTask({ servicePointId: '', cleanerId: '', scheduledAt: '' });
      loadData();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to create task';
      toast.error(errorMessage);
      console.error('Create task error:', error);
    }
  };

  const addComment = async (taskId: string, comment: string) => {
    try {
      await managerAPI.addComment(taskId, comment);
      toast.success('Comment added successfully');
      loadData(); // Refresh data
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to add comment';
      toast.error(errorMessage);
      console.error('Add comment error:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditTask({
      servicePointId: task.servicePoint.id,
      cleanerId: task.cleaner.id,
      scheduledAt: task.scheduledAt ? new Date(task.scheduledAt).toISOString().slice(0, 16) : '',
      status: task.status
    });
    handleCleanerChange(task.cleaner.id);
    setShowEditTaskModal(true);
  };

  const updateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    
    // Frontend validation
    if (!editTask.servicePointId || !editTask.cleanerId) {
      toast.error('Please select both Point and Cleaner');
      return;
    }

    if (editTask.scheduledAt) {
      const scheduledDate = new Date(editTask.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        toast.error('Invalid date format');
        return;
      }
    }
    
    try {
      await managerAPI.updateTask(selectedTask.id, {
        ...editTask,
        scheduledAt: editTask.scheduledAt || undefined
      });
      toast.success('Task updated successfully');
      setShowEditTaskModal(false);
      setSelectedTask(null);
      setFilteredPoints(servicePoints);
      loadData();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to update task';
      toast.error(errorMessage);
      console.error('Update task error:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    
    try {
      await managerAPI.deleteTask(taskId);
      toast.success('Task deleted successfully');
      loadData();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to delete task';
      toast.error(errorMessage);
      console.error('Delete task error:', error);
    }
  };

  const getFilteredTasks = () => {
    // Ensure tasks is always an array
    if (!Array.isArray(tasks)) {
      return [];
    }
    
    let filtered = tasks;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }
    
    if (cleanerFilter !== 'all') {
      filtered = filtered.filter(task => task.cleaner?.id === cleanerFilter);
    }
    
    // Sort by scheduled date (earliest first) or by status
    filtered.sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      // Sort by status priority: OVERDUE > IN_PROGRESS > PENDING > COMPLETED
      const statusOrder: { [key: string]: number } = { OVERDUE: 0, IN_PROGRESS: 1, PENDING: 2, COMPLETED: 3 };
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });
    
    return filtered;
  };

  const exportTasks = async (format: 'csv' | 'excel' = 'csv') => {
    try {
      // Use backend export endpoint for better data consistency
      const response = await managerAPI.exportTasks(format);
      
      // Create blob from response
      const blob = new Blob(
        [response.data],
        { 
          type: format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv;charset=utf-8;'
        }
      );
      
      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tasks_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Tasks exported to ${format.toUpperCase()} successfully`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export tasks');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      case 'IN_PROGRESS':
        return 'text-blue-600 bg-blue-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      case 'OVERDUE':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get marker color based on status
  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '#10b981'; // green
      case 'IN_PROGRESS':
        return '#3b82f6'; // blue
      case 'PENDING':
        return '#eab308'; // yellow
      case 'OVERDUE':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  // Get status for Service Point (last task status)
  const getPointStatus = (pointId: string): string => {
    const pointTasks = tasks.filter(t => t.servicePoint.id === pointId);
    if (pointTasks.length === 0) return 'NONE';
    // Sort by updatedAt descending and get the latest task
    const sortedTasks = [...pointTasks].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    return sortedTasks[0].status;
  };

  // Get tasks for today
  const getTodayTasks = (): Task[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      const taskDate = task.completedAt 
        ? new Date(task.completedAt)
        : task.scheduledAt 
          ? new Date(task.scheduledAt)
          : new Date(task.createdAt || 0);
      
      taskDate.setHours(0, 0, 0, 0);
      return taskDate >= today && taskDate < tomorrow;
    }).sort((a, b) => {
      // Sort by completedAt or scheduledAt descending
      const dateA = new Date(a.completedAt || a.scheduledAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.completedAt || b.scheduledAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  };

  // Create custom icon for map markers
  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        currentProject="feedbackatm"
        projectName="FeedbackATM - Manager Dashboard"
        mobileMenuButton={
          <button
            className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Меню"
            disabled
          >
            <Menu className="h-5 w-5" />
          </button>
        }
        user={user ? { 
          username: user.username, 
          role: user.role
        } : null}
        logout={logout}
        showProfile={true}
        showBackButton={true}
        showLanguageSwitcher={true}
        showProjectSwitcher={true}
        navigate={navigate}
        currentPath={location.pathname}
        logoutText="Выйти"
        languages={[
          { code: 'ru', label: 'Русский' },
          { code: 'az', label: 'Azərbaycan' },
          { code: 'en', label: 'English' },
        ]}
        onLanguageChange={(code: string) => {
          localStorage.setItem('language', code);
          i18n.changeLanguage(code);
        }}
      />
      
      {/* Map Link for Desktop */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex justify-end">
          <Link
            to="/map"
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
          >
            <MapPin className="h-4 w-4 mr-2" />
            {t('dashboard.viewMap')}
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: t('dashboard.overview'), icon: LayoutDashboard },
              { id: 'tasks', name: t('dashboard.tasks'), icon: CheckCircle },
              { id: 'points', name: t('dashboard.servicePoints'), icon: MapPin },
              { id: 'routes', name: 'Маршруты', icon: Route }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <MapPin className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{t('dashboard.totalPoints')}</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPoints}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{t('dashboard.completedTasks')}</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.completedTasks}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{t('dashboard.pendingTasks')}</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingTasks}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{t('dashboard.completionRate')}</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map with Points */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">{t('dashboard.serviceLocations')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('dashboard.showingPoints', { count: servicePoints.filter(p => p.latitude && p.longitude).length })}</p>
              </div>
              <div className="h-96 w-full">
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  className="leaflet-container"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {servicePoints
                    .filter(p => p.latitude && p.longitude)
                    .map((p) => {
                      const status = getPointStatus(p.id);
                      const color = getMarkerColor(status);
                      return (
                        <Marker
                          key={p.id}
                          position={[p.latitude!, p.longitude!]}
                          icon={createCustomIcon(color)}
                        >
                          <Popup>
                            <div className="p-2">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 uppercase">
                                  {p.type}
                                </span>
                                <h3 className="font-semibold text-lg">{p.name}</h3>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{p.address}</p>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                                {status === 'NONE' ? '-' : status.replace('_', ' ')}
                              </span>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                </MapContainer>
              </div>
            </div>

            {/* Today's Tasks Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">{t('dashboard.todayTasks')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('dashboard.employee')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('dashboard.location')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('dashboard.time')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('dashboard.photo')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('dashboard.cleaningStatus')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getTodayTasks().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          {t('dashboard.noTasksToday')}
                        </td>
                      </tr>
                    ) : (
                      getTodayTasks().map((task) => {
                        const photoUrls = task.photos ? (typeof task.photos === 'string' ? JSON.parse(task.photos) : task.photos) : [];
                        const displayTime = task.completedAt 
                          ? new Date(task.completedAt).toLocaleTimeString()
                          : task.scheduledAt 
                            ? new Date(task.scheduledAt).toLocaleTimeString()
                            : '-';
                        
                        return (
                          <tr key={task.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{task.cleaner.username}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{task.servicePoint.name}</div>
                              <div className="text-xs text-gray-500 uppercase font-bold">{task.servicePoint.type}</div>
                              <div className="text-sm text-gray-500">{task.servicePoint.address}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{displayTime}</div>
                            </td>
                            <td className="px-6 py-4">
                              {photoUrls.length > 0 ? (
                                <div className="flex space-x-2">
                                  {photoUrls.slice(0, 3).map((url: string, idx: number) => (
                                    <img
                                      key={idx}
                                      src={url.startsWith('http') ? url : `/feedbackatm/api${url}`}
                                      alt={`Photo ${idx + 1}`}
                                      className="h-12 w-12 object-cover rounded cursor-pointer hover:opacity-75"
                                      onClick={() => window.open(url.startsWith('http') ? url : `/feedbackatm/api${url}`, '_blank')}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400 flex items-center">
                                  <ImageIcon className="h-4 w-4 mr-1" />
                                  {t('common.no')}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                                {task.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">{t('dashboard.tasks')} ({getFilteredTasks().length})</h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => exportTasks('csv')}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  {t('dashboard.exportCSV')}
                </button>
                <button
                  onClick={() => exportTasks('excel')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                  {t('dashboard.exportExcel')}
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {t('dashboard.filters')}
                </button>
                <button
                  onClick={() => setShowCreateTaskModal(true)}
                  className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('dashboard.createTask')}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">{t('dashboard.allStatuses')}</option>
                    <option value="PENDING">{t('dashboard.pending')}</option>
                    <option value="IN_PROGRESS">{t('dashboard.inProgress')}</option>
                    <option value="COMPLETED">{t('dashboard.completed')}</option>
                    <option value="OVERDUE">{t('dashboard.overdue')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.cleaner')}</label>
                  <select
                    value={cleanerFilter}
                    onChange={(e) => setCleanerFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">{t('dashboard.allCleaners')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
              {getFilteredTasks().map((task) => (
                <div key={task.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 uppercase">{task.servicePoint.type}</span>
                        <h3 className="text-lg font-medium text-gray-900">{task.servicePoint.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{task.servicePoint.address}</p>
                      <p className="text-sm text-gray-500">Cleaner: {task.cleaner.username}</p>
                    </div>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mt-4">
                    {task.status === 'COMPLETED' && !task.managerNotes && (
                      <button
                        onClick={() => {
                          const comment = prompt(`${t('dashboard.addComment')}:`);
                          if (comment?.trim()) addComment(task.id, comment.trim());
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        {t('dashboard.addComment')}
                      </button>
                    )}
                    <button
                      onClick={() => handleEditTask(task)}
                      className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700"
                    >
                      Edit
                    </button>
                    {(task.status === 'PENDING' || task.status === 'OVERDUE') && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points Tab */}
        {activeTab === 'points' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('dashboard.servicePoints')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicePoints.map((p) => (
                <div key={p.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 uppercase">{p.type}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                  </div>
                  <p className="text-gray-600 mb-3">{p.address}</p>
                  <div className="text-sm text-gray-500">
                    {p._count.cleaningTasks} {t('dashboard.cleaningTasks')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Маршруты Tab */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Маршруты</h2>
              <button
                onClick={() => { setEditingRoute(null); setRouteForm({ name: '', cleanerId: '', servicePointIds: [] }); setRoutePointsSearch(''); setShowRouteModal(true); }}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать маршрут
              </button>
            </div>
            <p className="text-sm text-gray-600">Группируйте объекты и назначайте клинера на маршрут. При сохранении маршрута назначения клинера обновляются.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routes.map((route) => (
                <div key={route.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{route.name}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingRoute(route);
                          setRouteForm({
                            name: route.name,
                            cleanerId: route.cleanerId,
                            servicePointIds: (route.routePoints || []).map((rp: any) => rp.servicePointId)
                          });
                          setRoutePointsSearch('');
                          setShowRouteModal(true);
                        }}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Удалить маршрут?')) return;
                          try {
                            await managerAPI.deleteRoute(route.id);
                            toast.success('Маршрут удалён');
                            loadData();
                          } catch (e: any) {
                            toast.error(e.response?.data?.error || 'Ошибка удаления');
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <User className="h-4 w-4 mr-1" />
                    {route.cleaner?.username || '-'}
                  </div>
                  <div className="text-sm text-gray-500">
                    Объектов: {(route.routePoints || []).length}
                  </div>
                  {(route.routePoints || []).length > 0 && (
                    <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                      {(route.routePoints || []).slice(0, 5).map((rp: any) => (
                        <li key={rp.id}>{rp.servicePoint?.name}</li>
                      ))}
                      {(route.routePoints || []).length > 5 && <li>...</li>}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {routes.length === 0 && (
              <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                Нет маршрутов. Создайте маршрут и добавьте объекты с назначением клинера.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Route Create/Edit Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{editingRoute ? 'Редактировать маршрут' : 'Новый маршрут'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input
                  type="text"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Например: Маршрут 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Клинер</label>
                <select
                  value={routeForm.cleanerId}
                  onChange={(e) => setRouteForm({ ...routeForm, cleanerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Выберите клинера</option>
                  {routeCleaners.map((c) => (
                    <option key={c.id} value={c.id}>{c.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Объекты (порядок = порядок в маршруте)</label>
                <input
                  type="text"
                  value={routePointsSearch}
                  onChange={(e) => setRoutePointsSearch(e.target.value)}
                  placeholder="Поиск по названию или адресу..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 text-sm"
                />
                <select
                  multiple
                  value={routeForm.servicePointIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setRouteForm({ ...routeForm, servicePointIds: selected });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-40"
                >
                  {servicePoints
                    .filter((p) => {
                      const q = routePointsSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (p.name && p.name.toLowerCase().includes(q)) || (p.address && p.address.toLowerCase().includes(q));
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Удерживайте Ctrl/Cmd для выбора нескольких</p>
                {routeForm.servicePointIds.length > 0 && (
                  <div className="mt-2 text-sm text-gray-700">
                    <span className="font-medium">Порядок:</span>
                    <ol className="list-decimal list-inside mt-0.5 space-y-0.5">
                      {routeForm.servicePointIds.map((id) => {
                        const p = servicePoints.find((x) => x.id === id);
                        return <li key={id}>{p ? `${p.name}${p.address ? ` — ${p.address}` : ''}` : id}</li>;
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4 mt-4 border-t">
              <button type="button" onClick={() => { setShowRouteModal(false); setEditingRoute(null); setRoutePointsSearch(''); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Отмена</button>
              <button
                type="button"
                onClick={async () => {
                  if (!routeForm.name.trim() || !routeForm.cleanerId) {
                    toast.error('Укажите название и клинера');
                    return;
                  }
                  try {
                    if (editingRoute) {
                      await managerAPI.updateRoute(editingRoute.id, {
                        name: routeForm.name,
                        cleanerId: routeForm.cleanerId,
                        servicePointIds: routeForm.servicePointIds
                      });
                      toast.success('Маршрут обновлён');
                    } else {
                      await managerAPI.createRoute({
                        name: routeForm.name,
                        cleanerId: routeForm.cleanerId,
                        servicePointIds: routeForm.servicePointIds
                      });
                      toast.success('Маршрут создан');
                    }
                    setShowRouteModal(false);
                    setEditingRoute(null);
                    loadData();
                  } catch (e: any) {
                    toast.error(e.response?.data?.error || 'Ошибка сохранения');
                  }
                }}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
              >
                {editingRoute ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.createNewTask')}</h3>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.cleaner')}</label>
                <select
                  required
                  value={newTask.cleanerId}
                  onChange={(e) => handleCleanerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">{t('dashboard.selectCleaner')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} {user.assignedPoints?.length ? `(${user.assignedPoints.length})` : `(No points)`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.location')}</label>
                <select
                  required
                  value={newTask.servicePointId}
                  onChange={(e) => setNewTask({...newTask, servicePointId: e.target.value})}
                  disabled={!newTask.cleanerId || filteredPoints.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="">
                    {!newTask.cleanerId ? t('dashboard.selectCleanerFirst') : filteredPoints.length === 0 ? t('dashboard.noPointsAssigned') : t('dashboard.selectPoint')}
                  </option>
                  {filteredPoints.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} - {p.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.scheduledDate')}</label>
                <input
                  type="datetime-local"
                  value={newTask.scheduledAt}
                  onChange={(e) => setNewTask({...newTask, scheduledAt: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateTaskModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">{t('common.cancel')}</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">{t('dashboard.createTask')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.editTask')}</h3>
            <form onSubmit={updateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.cleaner')}</label>
                <select
                  required
                  value={editTask.cleanerId}
                  onChange={(e) => {
                    handleCleanerChange(e.target.value);
                    setEditTask({...editTask, cleanerId: e.target.value, servicePointId: ''});
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">{t('dashboard.selectCleaner')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.location')}</label>
                <select
                  required
                  value={editTask.servicePointId}
                  onChange={(e) => setEditTask({...editTask, servicePointId: e.target.value})}
                  disabled={!editTask.cleanerId || filteredPoints.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                >
                  <option value="">{t('dashboard.selectPoint')}</option>
                  {filteredPoints.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} - {p.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.scheduledDate')}</label>
                <input
                  type="datetime-local"
                  value={editTask.scheduledAt}
                  onChange={(e) => setEditTask({...editTask, scheduledAt: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.status')}</label>
                <select
                  value={editTask.status}
                  onChange={(e) => setEditTask({...editTask, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="PENDING">{t('dashboard.pending')}</option>
                  <option value="IN_PROGRESS">{t('dashboard.inProgress')}</option>
                  <option value="COMPLETED">{t('dashboard.completed')}</option>
                  <option value="OVERDUE">{t('dashboard.overdue')}</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowEditTaskModal(false); setSelectedTask(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">{t('common.cancel')}</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">{t('dashboard.editTask')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
