import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Users, Building2, FolderTree, Package, Archive, Settings } from 'lucide-react';

const tabs = [
  { label: 'Users',       icon: Users,       path: 'users' },
  { label: 'Departments', icon: Building2,   path: 'departments' },
  { label: 'Categories',  icon: FolderTree,  path: 'categories' },
  { label: 'Products',    icon: Package,     path: 'products' },
  { label: 'Retention',   icon: Archive,     path: 'retention' },
  { label: 'Settings',    icon: Settings,    path: 'settings' },
];

export default function AdminPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Administration</h1>
        <nav className="flex gap-1">
          {tabs.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </div>
    </div>
  );
}

// Default redirect
export function AdminIndexRedirect() {
  return <Navigate to="users" replace />;
}