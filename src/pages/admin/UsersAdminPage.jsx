import { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp,
  ShieldPlus, UserX, UserCheck, Loader2, UserPlus, X, Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useUsers,
  useAddRole,
  useRemoveRole,
  useDeactivateUser,
  useReactivateUser,
  useDepartments,
  useInviteUser,
} from '../../hooks/useAdmin';
import useUserStore from '../../store/userStore';

const SUPER_ADMIN_ROLE = 'ECM_SUPER_ADMIN';
const ALL_ROLES_FULL = [SUPER_ADMIN_ROLE, 'ECM_ADMIN', 'ECM_DESIGNER', 'ECM_BACKOFFICE', 'ECM_REVIEWER', 'ECM_READONLY'];
const ALL_ROLES_NO_SUPER = ALL_ROLES_FULL.filter(r => r !== SUPER_ADMIN_ROLE);

const ROLE_COLORS = {
  ECM_SUPER_ADMIN:'bg-rose-100 text-rose-800',
  ECM_ADMIN:      'bg-red-100 text-red-700',
  ECM_DESIGNER:   'bg-purple-100 text-purple-700',
  ECM_BACKOFFICE: 'bg-blue-100 text-blue-700',
  ECM_REVIEWER:   'bg-amber-100 text-amber-700',
  ECM_READONLY:   'bg-gray-100 text-gray-600',
};

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role, onRemove, removing }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role.replace('ECM_', '')}
      <button
        onClick={onRemove}
        disabled={removing}
        className="ml-0.5 hover:opacity-70 disabled:opacity-40"
        title={`Remove ${role}`}
      >
        {removing ? <Loader2 size={10} className="animate-spin" /> : '×'}
      </button>
    </span>
  );
}

// ── Add role dropdown ─────────────────────────────────────────────────────────

function AddRoleDropdown({ userId, existingRoles }) {
  const [open, setOpen] = useState(false);
  const addRole = useAddRole();
  const isSuperAdmin = useUserStore(s => s.isSuperAdmin());
  const visibleRoles = isSuperAdmin ? ALL_ROLES_FULL : ALL_ROLES_NO_SUPER;
  const available = visibleRoles.filter(r => !existingRoles.includes(r));

  if (!available.length) return null;

  const handle = (role) => {
    setOpen(false);
    addRole.mutate({ id: userId, roleName: role }, {
      onSuccess: () => toast.success(`Role ${role} added`),
      onError:   () => toast.error('Failed to add role'),
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={addRole.isPending}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
      >
        <ShieldPlus size={12} /> Add role
      </button>
      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-40">
            {available.map(r => (
              <button
                key={r}
                onClick={() => handle(r)}
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── User row (expandable) ─────────────────────────────────────────────────────

function UserRow({ user }) {
  const [expanded, setExpanded] = useState(false);
  const removeRole = useRemoveRole();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const roles = user.roles ?? [];

  const handleStatusToggle = () => {
    const action = user.isActive ? deactivate : reactivate;
    const msg    = user.isActive ? 'User deactivated' : 'User reactivated';
    action.mutate(user.id, {
      onSuccess: () => toast.success(msg),
      onError:   () => toast.error('Action failed'),
    });
  };

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
        <td className="px-4 py-3 w-8">
          <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>

        {/* User identity */}
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-gray-900">{user.displayName ?? user.email}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </td>

        {/* Department */}
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {user.department?.name ?? '—'}
        </td>

        {/* Roles + add/remove */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {roles.map(r => (
              <RoleBadge
                key={r}
                role={r}
                removing={removeRole.isPending}
                onRemove={() => removeRole.mutate({ id: user.id, roleName: r }, {
                  onSuccess: () => toast.success(`Role ${r} removed`),
                  onError:   () => toast.error('Failed to remove role'),
                })}
              />
            ))}
            <AddRoleDropdown userId={user.id} existingRoles={roles} />
          </div>
        </td>

        {/* Status badge */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>

        {/* Action button */}
        <td className="px-4 py-3 whitespace-nowrap">
          <button
            onClick={handleStatusToggle}
            disabled={deactivate.isPending || reactivate.isPending}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50 ${
              user.isActive
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {user.isActive
              ? <><UserX size={12} /> Deactivate</>
              : <><UserCheck size={12} /> Reactivate</>
            }
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-blue-50/40 border-b border-gray-100">
          <td />
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Sub Email</span>
                <div className="font-medium text-gray-800 mt-0.5">{user.subEmail ?? '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Auth Provider</span>
                <div className="font-medium text-gray-800 mt-0.5">{user.authProvider ?? '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Last Login</span>
                <div className="font-medium text-gray-800 mt-0.5">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">User ID</span>
                <div className="font-mono text-gray-600 mt-0.5 truncate text-[11px]">{user.id}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Invite User Modal ─────────────────────────────────────────────────────────

function InviteUserModal({ departments, onClose }) {
  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [deptId,      setDeptId]      = useState('');
  const [initRole,    setInitRole]    = useState('ECM_READONLY');

  const inviteUser = useInviteUser();
  const isSuperAdmin = useUserStore(s => s.isSuperAdmin());
  const inviteRoles = isSuperAdmin ? ALL_ROLES_FULL : ALL_ROLES_NO_SUPER;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    try {
      await inviteUser.mutateAsync({
        email,
        displayName:  displayName || undefined,
        departmentId: deptId      || undefined,
        initialRole:  initRole    || undefined,
      });
      toast.success(`Invitation sent to ${email}`);
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Failed to invite user';
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Invite User</h3>
              <p className="text-xs text-gray-400">User activates on first SSO login</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value.trim())}
              placeholder="jane.doe@example.com"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                          ${email && !emailValid ? 'border-red-300' : 'border-gray-300'}`}
            />
            {email && !emailValid && (
              <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Display name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={deptId}
              onChange={e => setDeptId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— No department —</option>
              {(departments ?? []).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Initial role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Initial role
            </label>
            <select
              value={initRole}
              onChange={e => setInitRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {inviteRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Additional roles can be assigned from the Users table after the user logs in.
            </p>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2.5">
            <Mail className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              A pending user record will be created. The user must sign in via SSO
              — their account activates automatically on first login.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!emailValid || inviteUser.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white
                       rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviteUser.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Mail className="w-4 h-4" />
            }
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersAdminPage() {
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [page,         setPage]         = useState(0);
  const [showInvite,   setShowInvite]   = useState(false);

  const isSuperAdmin = useUserStore(s => s.isSuperAdmin());
  const filterRoles = isSuperAdmin ? ALL_ROLES_FULL : ALL_ROLES_NO_SUPER;
  const { data: depts } = useDepartments(true);
  const { data, isLoading, isError } = useUsers({
    search:       search       || undefined,
    role:         roleFilter   || undefined,
    isActive:     statusFilter === '' ? undefined : statusFilter === 'active',
    departmentId: deptFilter   || undefined,
    page,
    size: 20,
  });

  const users      = Array.isArray(data) ? data : (data?.content ?? []);
  const totalPages = data?.totalPages ?? 1;

  return (
    /* h-full + flex-col so this pane fills the scrollable outlet area */
    <div className="flex flex-col h-full">

      {/* ── Sticky filter bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search name or email…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Roles</option>
            {filterRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Department filter */}
          <select
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setPage(0); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Departments</option>
            {(depts ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {/* ── Invite User ── */}
          <button
            onClick={() => setShowInvite(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                       rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors
                       whitespace-nowrap"
          >
            <UserPlus size={14} />
            Invite User
          </button>
        </div>
      </div>

      {/* ── Scrollable table area ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm ">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading users…
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-red-500 text-sm">Failed to load users.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map(u => <UserRow key={u.id} user={u} />)
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">
              Page {page + 1} of {totalPages} · {users.length} users shown
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                           disabled:opacity-40 hover:bg-gray-50 bg-white"
              >
                ← Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                           disabled:opacity-40 hover:bg-gray-50 bg-white"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite User modal */}
      {showInvite && (
        <InviteUserModal
          departments={depts}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}