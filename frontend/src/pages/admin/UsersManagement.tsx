import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import type { User, Company, ServicePoint } from './types';
import AssignPointsModal from './AssignPointsModal';

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignATMsModal, setShowAssignATMsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [allATMs, setAllATMs] = useState<ServicePoint[]>([]);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'CLEANER',
    companyId: '',
  });
  const [editUser, setEditUser] = useState({
    id: '',
    username: '',
    email: '',
    role: 'CLEANER',
    companyId: '',
  });

  useEffect(() => {
    loadUsers();
    loadCompanies();
    loadATMs();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
    } catch (error) {
      console.error('Load users error:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await adminAPI.getCompanies();
      setCompanies(Array.isArray(response.data?.companies) ? response.data.companies : []);
    } catch (error) {
      console.error('Load companies error:', error);
      setCompanies([]);
    }
  };

  const loadATMs = async () => {
    try {
      const response = await adminAPI.getATMs();
      setAllATMs(Array.isArray(response.data?.servicePoints) ? response.data.servicePoints : []);
    } catch (error) {
      console.error('Load ATMs error:', error);
      setAllATMs([]);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createUser(newUser);
      toast.success('User created successfully');
      setShowCreateModal(false);
      setNewUser({ username: '', email: '', password: '', role: 'CLEANER', companyId: '' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditUser({
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      companyId: user.companyId || '',
    });
    setShowEditModal(true);
  };

  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.updateUser(editUser.id, {
        username: editUser.username,
        email: editUser.email,
        role: editUser.role,
        companyId: editUser.companyId || null,
      });
      toast.success('User updated successfully');
      setShowEditModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleAssignPoints = (user: User) => {
    setSelectedUser(user);
    setShowAssignATMsModal(true);
  };

  const assignPointsToCleaner = async (pointIds: string[]) => {
    if (!selectedUser) return;
    try {
      await adminAPI.assignPointsToCleaner(selectedUser.id, pointIds);
      toast.success('Points assigned successfully');
      setShowAssignATMsModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign points');
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
        <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(users || []).map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  {user.email && <div className="text-sm text-gray-500">{user.email}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                    user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.company?.name || 'No company'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEditUser(user)} className="text-primary hover:text-primary-dark" title="Edit user">
                      <Edit className="h-4 w-4" />
                    </button>
                    {user.role === 'CLEANER' && (
                      <button onClick={() => handleAssignPoints(user)} className="text-blue-600 hover:text-blue-900" title="Assign Points">
                        <MapPin className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900" title="Delete user">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h3>
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CLEANER">Cleaner</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h3>
            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" required value={editUser.username} onChange={(e) => setEditUser({ ...editUser, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CLEANER">Cleaner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select value={editUser.companyId} onChange={(e) => setEditUser({ ...editUser, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">No company</option>
                  {(companies || []).map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">Update User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignATMsModal && selectedUser && (
        <AssignPointsModal
          user={selectedUser}
          allPoints={allATMs}
          assignedPointIds={selectedUser.assignedPoints?.map((a: any) => a.servicePoint.id) || []}
          onClose={() => { setShowAssignATMsModal(false); setSelectedUser(null); }}
          onSave={assignPointsToCleaner}
        />
      )}
    </div>
  );
}
