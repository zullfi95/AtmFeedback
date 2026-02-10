import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import type { ServicePoint, Company } from './types';

export default function ServicePointsManagement() {
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPoint, setNewPoint] = useState({
    name: '',
    type: 'ATM' as const,
    address: '',
    latitude: '',
    longitude: '',
    companyId: '',
  });
  const [editPoint, setEditPoint] = useState({
    id: '',
    name: '',
    type: 'ATM' as const,
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
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Points Management</h1>
        <div className="flex space-x-3">
          <Link to="/map" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            View Map
          </Link>
          <button onClick={() => setShowCreateModal(true)} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Point
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    <button onClick={() => handleEditPoint(point)} className="text-primary hover:text-primary-dark" title="Edit Point">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeletePoint(point.id)} className="text-red-600 hover:text-red-900" title="Delete Point">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Service Point</h3>
            <form onSubmit={updatePoint} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" required value={editPoint.name} onChange={(e) => setEditPoint({ ...editPoint, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select required value={editPoint.type} onChange={(e) => setEditPoint({ ...editPoint, type: e.target.value as 'ATM' | 'BUS_STOP' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="ATM">ATM</option>
                    <option value="BUS_STOP">Bus Stop</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" required value={editPoint.address} onChange={(e) => setEditPoint({ ...editPoint, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select required value={editPoint.companyId} onChange={(e) => setEditPoint({ ...editPoint, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (Click on map to set coordinates)</label>
                <LocationPicker
                  latitude={parseFloat(editPoint.latitude) || 40.4093}
                  longitude={parseFloat(editPoint.longitude) || 49.8671}
                  onLocationChange={(lat, lng) => setEditPoint({ ...editPoint, latitude: lat.toString(), longitude: lng.toString() })}
                  height="300px"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input type="number" step="any" required value={editPoint.latitude} onChange={(e) => setEditPoint({ ...editPoint, latitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input type="number" step="any" required value={editPoint.longitude} onChange={(e) => setEditPoint({ ...editPoint, longitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Update Point</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Service Point</h3>
            <form onSubmit={createPoint} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" required value={newPoint.name} onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select required value={newPoint.type} onChange={(e) => setNewPoint({ ...newPoint, type: e.target.value as 'ATM' | 'BUS_STOP' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="ATM">ATM</option>
                    <option value="BUS_STOP">Bus Stop</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" required value={newPoint.address} onChange={(e) => setNewPoint({ ...newPoint, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select required value={newPoint.companyId} onChange={(e) => setNewPoint({ ...newPoint, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (Click on map to set coordinates)</label>
                <LocationPicker
                  latitude={parseFloat(newPoint.latitude) || 40.4093}
                  longitude={parseFloat(newPoint.longitude) || 49.8671}
                  onLocationChange={(lat, lng) => setNewPoint({ ...newPoint, latitude: lat.toString(), longitude: lng.toString() })}
                  height="300px"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input type="number" step="any" required value={newPoint.latitude} onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input type="number" step="any" required value={newPoint.longitude} onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Create Point</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
