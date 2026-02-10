import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import type { ServicePoint, Company } from './types';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return isMobile;
}

export default function ServicePointsManagement() {
  const isMobile = useIsMobile();
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const mapHeight = isMobile ? '200px' : '300px';
  const [newPoint, setNewPoint] = useState<{
    name: string;
    type: 'ATM' | 'BUS_STOP';
    address: string;
    latitude: string;
    longitude: string;
    companyId: string;
  }>({
    name: '',
    type: 'ATM',
    address: '',
    latitude: '',
    longitude: '',
    companyId: '',
  });
  const [editPoint, setEditPoint] = useState<{
    id: string;
    name: string;
    type: 'ATM' | 'BUS_STOP';
    address: string;
    latitude: string;
    longitude: string;
    companyId: string;
  }>({
    id: '',
    name: '',
    type: 'ATM',
    address: '',
    latitude: '',
    longitude: '',
    companyId: '',
  });

  useEffect(() => {
    loadServicePoints();
    loadCompanies();
  }, []);

  const loadServicePoints = async () => {
    try {
      const response = await adminAPI.getServicePoints();
      const data = response.data;
      setServicePoints(Array.isArray(data?.servicePoints) ? data.servicePoints : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load service points error:', error);
      toast.error('Failed to load service points');
      setServicePoints([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await adminAPI.getCompanies();
      setCompanies(response.data?.companies || []);
    } catch (error) {
      console.error('Failed to load companies');
    }
  };

  const createPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoint.name || !newPoint.address || !newPoint.companyId) {
      toast.error('Please fill in all required fields');
      return;
    }
    const lat = parseFloat(newPoint.latitude);
    const lng = parseFloat(newPoint.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid coordinates');
      return;
    }
    try {
      await adminAPI.createServicePoint({ ...newPoint, latitude: lat, longitude: lng });
      toast.success('Service point created successfully');
      setShowCreateModal(false);
      setNewPoint({ name: '', type: 'ATM', address: '', latitude: '', longitude: '', companyId: '' });
      loadServicePoints();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create service point');
    }
  };

  const handleEditPoint = (point: ServicePoint) => {
    setEditPoint({
      id: point.id,
      name: point.name,
      type: point.type,
      address: point.address,
      latitude: point.latitude.toString(),
      longitude: point.longitude.toString(),
      companyId: point.companyId,
    });
    setShowEditModal(true);
  };

  const updatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPoint.name || !editPoint.address || !editPoint.companyId) {
      toast.error('Please fill in all required fields');
      return;
    }
    const lat = parseFloat(editPoint.latitude);
    const lng = parseFloat(editPoint.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid coordinates');
      return;
    }
    try {
      await adminAPI.updateServicePoint(editPoint.id, { ...editPoint, latitude: lat, longitude: lng });
      toast.success('Service point updated successfully');
      setShowEditModal(false);
      loadServicePoints();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update service point');
    }
  };

  const handleDeletePoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service point?')) return;
    try {
      await adminAPI.deleteServicePoint(id);
      toast.success('Service point deleted successfully');
      loadServicePoints();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete service point');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-safe">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Service Points Management</h1>
        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 sm:space-x-0">
          <Link
            to="/map"
            className="bg-green-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            View Map
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-primary-dark flex items-center justify-center gap-2 min-h-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Point
          </button>
        </div>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(servicePoints || []).map((point) => (
              <tr key={point.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{point.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-bold rounded uppercase ${point.type === 'ATM' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                    {point.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 max-w-xs truncate">{point.address}</div>
                  <div className="text-xs text-gray-400">
                    {point.latitude?.toFixed(4) || '0'}, {point.longitude?.toFixed(4) || '0'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {point.company?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEditPoint(point)} className="text-primary hover:text-primary-dark p-1" title="Edit Point">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeletePoint(point.id)} className="text-red-600 hover:text-red-900 p-1" title="Delete Point">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {(servicePoints || []).map((point) => (
          <div
            key={point.id}
            className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{point.name}</div>
                  <span className={`inline-flex mt-1 px-2 py-0.5 text-xs font-bold rounded uppercase ${point.type === 'ATM' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                    {point.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEditPoint(point)}
                    className="p-2.5 rounded-lg text-primary hover:bg-primary-light/20 touch-manipulation"
                    title="Edit Point"
                    aria-label="Edit"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeletePoint(point.id)}
                    className="p-2.5 rounded-lg text-red-600 hover:bg-red-50 touch-manipulation"
                    title="Delete Point"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-500 line-clamp-2">{point.address}</div>
              <div className="mt-1 text-xs text-gray-400">
                {point.latitude?.toFixed(4) || '0'}, {point.longitude?.toFixed(4) || '0'}
              </div>
              <div className="mt-2 text-xs text-gray-500">{point.company?.name || 'N/A'}</div>
            </div>
          </div>
        ))}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:bg-gray-600/50 sm:p-4">
          <div className="bg-white flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg sm:shadow-xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Service Point</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100 touch-manipulation" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={updatePoint} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" required value={editPoint.name} onChange={(e) => setEditPoint({ ...editPoint, name: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select required value={editPoint.type} onChange={(e) => setEditPoint({ ...editPoint, type: e.target.value as 'ATM' | 'BUS_STOP' })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation">
                      <option value="ATM">ATM</option>
                      <option value="BUS_STOP">Bus Stop</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input type="text" required value={editPoint.address} onChange={(e) => setEditPoint({ ...editPoint, address: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <select required value={editPoint.companyId} onChange={(e) => setEditPoint({ ...editPoint, companyId: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation">
                      <option value="">Select a company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location (tap on map to set coordinates)</label>
                  <LocationPicker
                    latitude={parseFloat(editPoint.latitude) || 40.4093}
                    longitude={parseFloat(editPoint.longitude) || 49.8671}
                    onLocationChange={(lat, lng) => setEditPoint({ ...editPoint, latitude: lat.toString(), longitude: lng.toString() })}
                    height={mapHeight}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input type="number" step="any" required value={editPoint.latitude} onChange={(e) => setEditPoint({ ...editPoint, latitude: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input type="number" step="any" required value={editPoint.longitude} onChange={(e) => setEditPoint({ ...editPoint, longitude: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:space-x-3 p-4 border-t border-gray-200 bg-gray-50 sm:bg-white">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-3 sm:py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 touch-manipulation min-h-[44px]">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-primary-dark touch-manipulation min-h-[44px]">Update Point</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:bg-gray-600/50 sm:p-4">
          <div className="bg-white flex flex-col w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg sm:shadow-xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Service Point</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100 touch-manipulation" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createPoint} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" required value={newPoint.name} onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" placeholder="e.g. Unibank ATM #1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select required value={newPoint.type} onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value as 'ATM' | 'BUS_STOP' })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation">
                      <option value="ATM">ATM</option>
                      <option value="BUS_STOP">Bus Stop</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input type="text" required value={newPoint.address} onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" placeholder="Street, city" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <select required value={newPoint.companyId} onChange={(e) => setNewPoint({ ...newPoint, companyId: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation">
                      <option value="">Select a company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location (tap on map to set coordinates)</label>
                  <LocationPicker
                    latitude={parseFloat(newPoint.latitude) || 40.4093}
                    longitude={parseFloat(newPoint.longitude) || 49.8671}
                    onLocationChange={(lat, lng) => setNewPoint({ ...newPoint, latitude: lat.toString(), longitude: lng.toString() })}
                    height={mapHeight}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input type="number" step="any" required value={newPoint.latitude} onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input type="number" step="any" required value={newPoint.longitude} onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })} className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-base touch-manipulation" />
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:space-x-3 p-4 border-t border-gray-200 bg-gray-50 sm:bg-white">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-3 sm:py-2 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 touch-manipulation min-h-[44px]">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-primary-dark touch-manipulation min-h-[44px]">Create Point</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
