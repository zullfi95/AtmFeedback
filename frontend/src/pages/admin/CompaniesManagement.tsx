import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import type { Company } from './types';

export default function CompaniesManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', description: '', address: '' });
  const [editCompany, setEditCompany] = useState({ id: '', name: '', description: '', address: '' });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await adminAPI.getCompanies();
      setCompanies(Array.isArray(response.data?.companies) ? response.data.companies : []);
    } catch (error) {
      console.error('Load companies error:', error);
      toast.error('Failed to load companies');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createCompany(newCompany);
      toast.success('Company created successfully');
      setShowCreateModal(false);
      setNewCompany({ name: '', description: '', address: '' });
      loadCompanies();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create company');
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditCompany({
      id: company.id,
      name: company.name,
      description: company.description || '',
      address: company.address || '',
    });
    setShowEditModal(true);
  };

  const updateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.updateCompany(editCompany.id, {
        name: editCompany.name,
        description: editCompany.description,
        address: editCompany.address,
      });
      toast.success('Company updated successfully');
      setShowEditModal(false);
      loadCompanies();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update company');
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? This will also delete all associated users and service points.')) return;
    try {
      await adminAPI.deleteCompany(companyId);
      toast.success('Company deleted successfully');
      loadCompanies();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete company');
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
        <h1 className="text-2xl font-bold text-gray-900">Companies Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(companies || []).map((company) => (
          <div key={company.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-100 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{company.name}</h3>
                {company.address && <p className="text-sm text-gray-500 mt-1">{company.address}</p>}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEditCompany(company)} className="text-primary-600 hover:text-primary-900" title="Edit company">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDeleteCompany(company.id)} className="text-red-600 hover:text-red-900" title="Delete company">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {company.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{company.description}</p>
            )}
            <div className="mt-auto border-t pt-4 space-y-4">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Users: <span className="font-semibold text-gray-900">{(company as any)._count?.users || 0}</span></span>
                <span>Points: <span className="font-semibold text-gray-900">{(company as any)._count?.servicePoints || 0}</span></span>
              </div>
              {company.users && company.users.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Users & Assignments</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {(company.users || []).map((user: any) => (
                      <div key={user.id} className="p-2 bg-gray-50 rounded border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-800 text-xs">{user.username}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${user.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{user.role}</span>
                        </div>
                        {user.assignedPoints && user.assignedPoints.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(user.assignedPoints || []).map((ap: any) => (
                              <span key={ap.servicePoint.id} className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600" title={ap.servicePoint.name}>
                                {ap.servicePoint.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic mt-1">No points assigned</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {company.servicePoints && company.servicePoints.length > 0 ? (
                <div className="mt-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">All Service Points</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {(company.servicePoints || []).map((point: any) => (
                      <div key={point.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center space-x-2 truncate">
                          <span className={`w-2 h-2 rounded-full ${point.type === 'ATM' ? 'bg-blue-500' : 'bg-orange-500'}`} title={point.type}></span>
                          <span className="font-medium text-gray-700 truncate">{point.name}</span>
                        </div>
                        <span className="text-gray-400 shrink-0 ml-2">{point.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No service points found</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Company</h3>
            <form onSubmit={createCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" required value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newCompany.description} onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={newCompany.address} onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Create Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Company</h3>
            <form onSubmit={updateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" required value={editCompany.name} onChange={(e) => setEditCompany({ ...editCompany, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editCompany.description} onChange={(e) => setEditCompany({ ...editCompany, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={editCompany.address} onChange={(e) => setEditCompany({ ...editCompany, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Update Company</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
