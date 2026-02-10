import { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletConfig';

export default function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.4093, 49.8671]);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const response = await adminAPI.getDashboardStats();
      if (response.data) {
        setData(response.data);

        const points = response.data.servicePoints || [];
        if (points.length > 0) {
          const pointsWithCoords = points.filter((p: any) => p.latitude && p.longitude);
          if (pointsWithCoords.length > 0) {
            const avgLat = pointsWithCoords.reduce((sum: number, p: any) => sum + p.latitude, 0) / pointsWithCoords.length;
            const avgLng = pointsWithCoords.reduce((sum: number, p: any) => sum + p.longitude, 0) / pointsWithCoords.length;
            setMapCenter([avgLat, avgLng]);
          }
        }
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  if (loading || !data) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operational Dashboard</h1>
          <p className="text-gray-600">Today's status overview</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-500">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Points</h3>
            <MapPin className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.stats?.totalPoints || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tasks Today</h3>
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.stats?.todayTotalTasks || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Completed</h3>
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-green-600">{data.stats?.todayCompletedTasks || 0}</p>
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-gray-800">Status Map</h2>
          <div className="flex space-x-4 text-xs">
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#10b981] mr-1"></span> Cleaned</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#ef4444] mr-1"></span> Pending</div>
          </div>
        </div>
        <div className="h-[425px]">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {(data.servicePoints || []).map((point: any) => (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={createCustomIcon(point.status === 'COMPLETED' ? '#10b981' : '#ef4444')}
              >
                <Popup>
                  <div className="p-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 uppercase">{point.type}</span>
                      <span className="font-bold">{point.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{point.address}</p>
                    <div className="border-t pt-2">
                      <p className="text-xs">Status: <span className={point.status === 'COMPLETED' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{point.status}</span></p>
                      {point.assignedCleaners && point.assignedCleaners.length > 0 && (
                        <p className="text-xs mt-1">
                          Assigned Cleaner{point.assignedCleaners.length > 1 ? 's' : ''}: <b>{point.assignedCleaners.map((c: any) => c.username).join(', ')}</b>
                        </p>
                      )}
                      {point.todayTask?.cleaner && (
                        <p className="text-xs mt-1">Today's Task: <b>{point.todayTask.cleaner.username}</b></p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Cleaner Shifts Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-bold text-gray-800">Cleaner Shifts & Progress</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cleaner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(data.cleaners || []).map((cleaner: any) => {
                const total = cleaner.todayTasks?.length || 0;
                const completed = (cleaner.todayTasks || []).filter((t: any) => t.status === 'COMPLETED').length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <tr key={cleaner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-primary-dark font-bold">
                          {cleaner.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{cleaner.username}</div>
                          <div className="text-xs text-gray-500">{cleaner.company?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(cleaner.todayTasks || []).map((task: any) => (
                          <div key={task.id} className={`flex items-center px-2 py-0.5 rounded text-[10px] border ${
                            task.status === 'COMPLETED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {task.status === 'COMPLETED' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {task.servicePoint?.name}
                          </div>
                        ))}
                        {total === 0 && <span className="text-xs text-gray-400 italic">No tasks scheduled for today</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 w-24">
                        <div className={`h-2.5 rounded-full ${percent === 100 ? 'bg-green-600' : 'bg-primary'}`} style={{ width: `${percent}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{completed}/{total} completed ({percent}%)</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="space-y-1">
                        {(cleaner.todayTasks || []).filter((t: any) => t.status === 'COMPLETED').map((t: any) => (
                          <div key={t.id} className="flex items-center text-[10px] text-gray-500">
                            <span className="font-bold mr-1">{t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span>{t.servicePoint?.name}</span>
                            {t.photos && (
                              <button
                                onClick={() => {
                                  try {
                                    const photos = JSON.parse(t.photos);
                                    if (photos.length > 0) window.open(photos[0].startsWith('http') ? photos[0] : `/feedbackatm/api${photos[0]}`, '_blank');
                                  } catch (e) {}
                                }}
                                className="ml-2 text-primary hover:underline"
                              >
                                [Photo]
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
