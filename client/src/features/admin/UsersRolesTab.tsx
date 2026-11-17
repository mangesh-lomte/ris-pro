import React, { useState } from 'react';
import {
  Users,
  Shield,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  RefreshCw,
  Building2
} from 'lucide-react';
import { AdminUser, adminService } from '../../services/adminService';

interface UsersRolesTabProps {
  users: AdminUser[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (msg: string, isErr?: boolean) => void;
}

export const UsersRolesTab: React.FC<UsersRolesTabProps> = ({
  users,
  loading,
  onRefresh,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showTestFixtures, setShowTestFixtures] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const isTestFixture = (u: AdminUser) => {
    const email = (u.email || '').toLowerCase();
    const name = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
    return (
      email.includes('.p4') ||
      email.includes('@example.com') ||
      email.includes('test') ||
      name.includes('bystander') ||
      name.includes('inactive doctor') ||
      name.includes('-p4') ||
      name.includes('tester')
    );
  };

  const testFixtureCount = users.filter(isTestFixture).length;

  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'RADIOLOGIST',
    department: 'Clinical Imaging',
    phoneNumber: '',
  });

  const filteredUsers = users.filter((u) => {
    const fullName = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
    const email = u.email.toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = !search || fullName.includes(query) || email.includes(query);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    // Filter automated test fixtures unless explicitly toggled or searching
    if (!showTestFixtures && !search.trim() && isTestFixture(u)) {
      return false;
    }

    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name.trim() || !newUserData.email.trim() || !newUserData.password.trim()) {
      onNotify('Please complete all required fields.', true);
      return;
    }

    try {
      setCreating(true);
      await adminService.createUser({
        name: newUserData.name.trim(),
        email: newUserData.email.trim(),
        password: newUserData.password,
        role: newUserData.role,
        department: newUserData.department.trim() || undefined,
        phoneNumber: newUserData.phoneNumber.trim() || undefined,
      });
      onNotify(`Staff user ${newUserData.email} registered successfully.`);
      setIsAddUserOpen(false);
      setNewUserData({
        name: '',
        email: '',
        password: '',
        role: 'RADIOLOGIST',
        department: 'Clinical Imaging',
        phoneNumber: '',
      });
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to create user', true);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivateUser = async (user: AdminUser) => {
    const confirmPrompt = window.confirm(
      `DEACTIVATE USER ACCOUNT:\n\nAre you sure you want to deactivate ${user.name || user.email} (${user.role})?\n\nThis will immediately revoke system authentication and session tokens.`
    );
    if (!confirmPrompt) return;

    try {
      setDeactivatingId(user.id);
      await adminService.deactivateUser(user.id, 'Administrative governance action');
      onNotify(`User account ${user.email} deactivated.`);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to deactivate user', true);
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleReactivateUser = async (user: AdminUser) => {
    try {
      setDeactivatingId(user.id);
      await adminService.updateUser(user.id, { isActive: true });
      onNotify(`User account ${user.email} restored and reactivated.`);
      onRefresh();
    } catch (err: any) {
      onNotify(err?.response?.data?.message || err?.message || 'Failed to reactivate user', true);
    } finally {
      setDeactivatingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Shield className="w-3.5 h-3.5 text-[#2563EB]" />
            ADMIN
          </span>
        );
      case 'RADIOLOGIST':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            RADIOLOGIST
          </span>
        );
      case 'TECHNOLOGIST':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            TECHNOLOGIST
          </span>
        );
      case 'RECEPTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            RECEPTION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {role}
          </span>
        );
    }
  };

  const getRolePermissionsSummary = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Full System & Clinical Governance';
      case 'RADIOLOGIST':
        return 'Study Diagnostic & Report Finalization';
      case 'TECHNOLOGIST':
        return 'Scan Acquisition & Safety Protocols';
      case 'RECEPTION':
        return 'Patient Intake, Scheduling & Billing';
      default:
        return 'Restricted Access';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="user-role-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Role:
            </label>
            <select
              id="user-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-slate-300 bg-slate-50 rounded-md px-3 py-1.5 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <option value="ALL">All Roles ({filteredUsers.length})</option>
              <option value="ADMIN">ADMIN</option>
              <option value="RADIOLOGIST">RADIOLOGIST</option>
              <option value="TECHNOLOGIST">TECHNOLOGIST</option>
              <option value="RECEPTION">RECEPTION</option>
            </select>

            {testFixtureCount > 0 && (
              <button
                type="button"
                onClick={() => setShowTestFixtures(!showTestFixtures)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                  showTestFixtures
                    ? 'bg-slate-200 border-slate-400 text-slate-800 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                }`}
              >
                {showTestFixtures ? 'Hide Test Fixtures' : `Test Fixtures (${testFixtureCount})`}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center px-4 py-1.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Staff User
          </button>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Staff Member</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Username / Email</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Department</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Permissions Scope</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No staff members found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const displayName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <span>{displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.email}</td>
                      <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.department || 'Clinical Imaging'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {getRolePermissionsSummary(u.role)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {u.isActive ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.isActive ? (
                          <button
                            onClick={() => handleDeactivateUser(u)}
                            disabled={deactivatingId === u.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateUser(u)}
                            disabled={deactivatingId === u.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Staff User</h3>
                  <p className="text-xs text-slate-500">Configure credentials & clinical role assignment</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Priya Sharma"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email / Username</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. p.sharma@ris.local"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <option value="RADIOLOGIST">RADIOLOGIST</option>
                    <option value="TECHNOLOGIST">TECHNOLOGIST</option>
                    <option value="RECEPTION">RECEPTION</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Clinical Imaging"
                    value={newUserData.department}
                    onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating User...' : 'Create Staff User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
