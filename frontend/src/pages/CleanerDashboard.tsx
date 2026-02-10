import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  CheckCircle,
  MapPin,
  Calendar,
  History,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanerAPI } from '../services/api';
// @ts-ignore - shared-components находится вне проекта, но Vite разрешает путь корректно
import Header from '../../shared-components/Header';

interface Task {
  id: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  notes?: string;
  photos?: string;
  photoBefore?: string | null;
  photoAfter?: string | null;
  photoDamage?: string | null;
  servicePoint: {
    id: string;
    name: string;
    type: 'ATM' | 'BUS_STOP';
    address: string;
  };
}

const CleanerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'history' | 'atms'>('tasks');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [photoDamage, setPhotoDamage] = useState<File | null>(null);
  const [assignedATMs, setAssignedATMs] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    console.log('🔄 Loading cleaner dashboard data...');
    
    try {
      console.log('📡 Making API requests...');
      const [tasksRes, historyRes, atmsRes] = await Promise.all([
        cleanerAPI.getTasks().catch(err => {
          console.error('❌ Tasks API error:', err);
          return { data: { tasks: [] } };
        }),
        cleanerAPI.getHistory().catch(err => {
          console.error('❌ History API error:', err);
          return { data: { tasks: [] } };
        }),
        cleanerAPI.getAssignedATMs().catch(err => {
          console.error('❌ Assigned ATMs API error:', err);
          return { data: { servicePoints: [], atms: [] } };
        })
      ]);

      console.log('✅ Tasks response:', tasksRes?.data);
      console.log('✅ History response:', historyRes?.data);
      console.log('✅ ATMs response (full):', JSON.stringify(atmsRes?.data, null, 2));

      const tasksData = tasksRes?.data?.tasks || [];
      setTasks(tasksData);
      setHistory(historyRes?.data?.tasks || []);
      
      // Handle both servicePoints and atms for backwards compatibility
      const assignedPoints = atmsRes?.data?.servicePoints || atmsRes?.data?.atms || [];
      console.log('✅ Assigned points (extracted):', assignedPoints);
      console.log('✅ Assigned points count:', assignedPoints.length);
      console.log('✅ Setting assignedATMs state with:', assignedPoints);
      setAssignedATMs(assignedPoints);
      
      // Force re-render check
      setTimeout(() => {
        console.log('✅ State check after 100ms - assignedATMs:', assignedPoints);
      }, 100);
      
      if (assignedPoints.length === 0) {
        console.warn('⚠️ No assigned points found! Check if admin assigned points to this cleaner.');
      } else {
        console.log('✅ Successfully loaded', assignedPoints.length, 'assigned points');
      }
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to load data';
      console.error('❌ Load data error:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      console.log('✅ Loading complete');
    }
  };


  const completeTask = async () => {
    if (!selectedTask) return;

    try {
      await cleanerAPI.completeTask(selectedTask.id, {
        notes: completionNotes,
        photoBefore: photoBefore || undefined,
        photoAfter: photoAfter || undefined,
        photoDamage: photoDamage || undefined
      });

      toast.success('Task completed successfully');
      setSelectedTask(null);
      setCompletionNotes('');
      setPhotoBefore(null);
      setPhotoAfter(null);
      setPhotoDamage(null);
      loadData();
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.error || 'Failed to complete task';
      toast.error(errorMessage);
      console.error('Complete task error:', error);
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const handleSinglePhoto = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void,
    label: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`${label}: только JPEG, PNG, WebP`);
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${label}: файл до 5 МБ`);
      event.target.value = '';
      return;
    }
    setter(file);
    toast.success(`${label}: файл выбран`);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString();
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
        projectName="FeedbackATM - Cleaner Dashboard"
        mobileMenuButton={
          <button
            className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Меню"
            disabled
          >
            <Menu className="h-5 w-5" />
          </button>
        }
        user={user ? { username: user.username, role: user.role } : null}
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
          { code: 'en', label: 'English' },
        ]}
        onLanguageChange={(code: string) => {
          localStorage.setItem('language', code);
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
            View Map
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'tasks', name: 'My Tasks', icon: CheckCircle },
              { id: 'history', name: 'History', icon: History },
              { id: 'atms', name: 'My ATMs', icon: MapPin }
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

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Assigned Tasks</h2>

            {tasks.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks assigned</h3>
                <p className="mt-1 text-sm text-gray-500">You don't have any cleaning tasks at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Show tasks with actions */}
                {tasks.map((task) => (
                  <div key={task.id} className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{task.servicePoint.name}</h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-gray-600 mb-4">{task.servicePoint.address}</p>

                    <div className="flex items-center text-sm text-gray-500 mb-4">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(task.scheduledAt)}
                    </div>

                    {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Task
                      </button>
                    )}
                  </div>
                ))}
                
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Task History</h2>

            <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
              {history.map((task) => (
                <div key={task.id} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{task.servicePoint.name}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-2">{task.servicePoint.address}</p>

                  <div className="text-sm text-gray-500">
                    {task.completedAt ? `Completed: ${new Date(task.completedAt).toLocaleDateString()}` : 'Not completed'}
                  </div>

                  {task.notes && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Notes:</strong> {task.notes}
                    </div>
                  )}

                  {(task.photoBefore || task.photoAfter || task.photoDamage) && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Фото:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {task.photoBefore && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">До уборки</p>
                            <img
                              src={task.photoBefore.startsWith('http') ? task.photoBefore : `/feedbackatm/api${task.photoBefore}`}
                              alt="До уборки"
                              className="w-full h-28 object-cover rounded cursor-pointer hover:opacity-75"
                              onClick={() => window.open(task.photoBefore!.startsWith('http') ? task.photoBefore! : `/feedbackatm/api${task.photoBefore}`, '_blank')}
                            />
                          </div>
                        )}
                        {task.photoAfter && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">После уборки</p>
                            <img
                              src={task.photoAfter.startsWith('http') ? task.photoAfter : `/feedbackatm/api${task.photoAfter}`}
                              alt="После уборки"
                              className="w-full h-28 object-cover rounded cursor-pointer hover:opacity-75"
                              onClick={() => window.open(task.photoAfter!.startsWith('http') ? task.photoAfter! : `/feedbackatm/api${task.photoAfter}`, '_blank')}
                            />
                          </div>
                        )}
                        {task.photoDamage && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Повреждения</p>
                            <img
                              src={task.photoDamage.startsWith('http') ? task.photoDamage : `/feedbackatm/api${task.photoDamage}`}
                              alt="Повреждения"
                              className="w-full h-28 object-cover rounded cursor-pointer hover:opacity-75"
                              onClick={() => window.open(task.photoDamage!.startsWith('http') ? task.photoDamage! : `/feedbackatm/api${task.photoDamage}`, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {task.photos && !task.photoBefore && !task.photoAfter && (() => {
                    try {
                      const photoUrls = typeof task.photos === 'string' ? JSON.parse(task.photos) : task.photos;
                      if (Array.isArray(photoUrls) && photoUrls.length > 0) {
                        return (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Photos:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {photoUrls.map((url: string, idx: number) => (
                                <img
                                  key={idx}
                                  src={url.startsWith('http') ? url : `/feedbackatm/api${url}`}
                                  alt={`Task photo ${idx + 1}`}
                                  className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-75"
                                  onClick={() => window.open(url.startsWith('http') ? url : `/feedbackatm/api${url}`, '_blank')}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch (e) {
                      return null;
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned ATMs Tab */}
        {activeTab === 'atms' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">My Assigned ATMs</h2>
            {(() => {
              console.log('🔍 Rendering ATMs tab - assignedATMs:', assignedATMs);
              console.log('🔍 assignedATMs.length:', assignedATMs.length);
              console.log('🔍 assignedATMs type:', typeof assignedATMs);
              console.log('🔍 assignedATMs is array:', Array.isArray(assignedATMs));
              
              if (assignedATMs.length === 0) {
                console.warn('⚠️ assignedATMs is empty in render');
                return (
                  <div className="bg-white p-8 rounded-lg shadow text-center">
                    <MapPin className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No ATMs assigned</h3>
                    <p className="mt-1 text-sm text-gray-500">You don't have any ATMs assigned yet. Contact your manager.</p>
                    <p className="mt-2 text-xs text-gray-400">Debug: assignedATMs.length = {assignedATMs.length}</p>
                  </div>
                );
              }
              
              console.log('✅ Rendering', assignedATMs.length, 'ATMs');
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedATMs.map((atm: any, index: number) => {
                    console.log(`🔍 Rendering ATM ${index}:`, atm);
                    return (
                      <div key={atm.id || index} className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{atm.name || 'Unnamed ATM'}</h3>
                        <p className="text-gray-600 mb-3">{atm.address || 'No address'}</p>
                        {atm.company && (
                          <p className="text-sm text-gray-500">Company: {atm.company.name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Task Completion Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Complete Task: {selectedTask.servicePoint.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Add any notes about the cleaning..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">До уборки (фото)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => handleSinglePhoto(e, setPhotoBefore, 'До уборки')}
                  className="w-full text-sm"
                />
                {photoBefore && <p className="text-xs text-gray-500 mt-0.5">{photoBefore.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">После уборки (фото)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => handleSinglePhoto(e, setPhotoAfter, 'После уборки')}
                  className="w-full text-sm"
                />
                {photoAfter && <p className="text-xs text-gray-500 mt-0.5">{photoAfter.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Повреждения (фото, при наличии)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => handleSinglePhoto(e, setPhotoDamage, 'Повреждения')}
                  className="w-full text-sm"
                />
                {photoDamage && <p className="text-xs text-gray-500 mt-0.5">{photoDamage.name}</p>}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setCompletionNotes('');
                  setPhotoBefore(null);
                  setPhotoAfter(null);
                  setPhotoDamage(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={completeTask}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanerDashboard;
