import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI, managerAPI } from '../../services/api';
import type { ServicePoint } from './types';

export default function RoutesManagement() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeCleaners, setRouteCleaners] = useState<{ id: string; username: string }[]>([]);
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [routeForm, setRouteForm] = useState({ name: '', cleanerId: '', servicePointIds: [] as string[] });
  const [routePointsSearch, setRoutePointsSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [routesRes, cleanersRes, pointsRes] = await Promise.all([
        managerAPI.getRoutes().catch(() => ({ data: { routes: [] } })),
        managerAPI.getCleaners().catch(() => ({ data: { cleaners: [] } })),
        adminAPI.getServicePoints().catch(() => ({ data: [] }))
      ]);
      setRoutes(Array.isArray(routesRes.data?.routes) ? routesRes.data.routes : []);
      setRouteCleaners(Array.isArray(cleanersRes.data?.cleaners) ? cleanersRes.data.cleaners : []);
      const points = pointsRes.data;
      setServicePoints(Array.isArray(points) ? points : (points?.servicePoints || []));
    } catch (e) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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
          Нет маршрутов. Создайте маршрут и добавьте объекты с назначением клинера. Если вы админ без компании, назначьте себя компании в разделе Users.
        </div>
      )}

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
    </div>
  );
}
