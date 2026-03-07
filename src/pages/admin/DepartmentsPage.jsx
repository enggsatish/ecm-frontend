import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeactivateDepartment,
} from '../../hooks/useAdmin';

// Build tree from flat list
function buildTree(nodes) {
  const map = {};
  nodes.forEach(n => (map[n.id] = { ...n, children: [] }));
  const roots = [];
  nodes.forEach(n => {
    if (n.parentId && map[n.parentId]) map[n.parentId].children.push(map[n.id]);
    else if (!n.parentId) roots.push(map[n.id]);
  });
  return roots;
}

function DeptNode({ node, depth = 0, allNodes, onEdit, onDeactivate, deactivating }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 ${!node.isActive ? 'opacity-50' : ''}`}>
        <td className="px-4 py-2.5">
          <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
            <button
              onClick={() => setOpen(v => !v)}
              className={`mr-1.5 text-gray-400 ${!hasChildren ? 'invisible' : ''}`}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <Building2 size={14} className="mr-2 text-blue-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800">{node.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-sm text-gray-500 font-mono">{node.code}</td>
        <td className="px-4 py-2.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            node.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}>
            {node.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(node)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            {node.isActive && (
              <button
                onClick={() => onDeactivate(node.id)}
                disabled={deactivating}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                title="Deactivate"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && hasChildren && node.children.map(child => (
        <DeptNode
          key={child.id}
          node={child}
          depth={depth + 1}
          allNodes={allNodes}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
          deactivating={deactivating}
        />
      ))}
    </>
  );
}

function SlidePanel({ title, open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: '', code: '', parentId: '' };

export default function DepartmentsPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: flat, isLoading } = useDepartments(true);
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const deactivate = useDeactivateDepartment();

  const flatList = flat ?? [];
  const tree = buildTree(flatList);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (node) => {
    setEditing(node);
    setForm({ name: node.name, code: node.code, parentId: node.parentId ?? '' });
    setPanelOpen(true);
  };

  const handleDeactivate = (id) => {
    if (!confirm('Deactivate this department?')) return;
    deactivate.mutate(id, {
      onSuccess: () => toast.success('Department deactivated'),
      onError: () => toast.error('Failed to deactivate'),
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and Code are required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      parentId: form.parentId || null,
    };
    const opts = {
      onSuccess: () => { toast.success(editing ? 'Department updated' : 'Department created'); setPanelOpen(false); },
      onError: () => toast.error('Save failed'),
      onSettled: () => setSaving(false),
    };
    if (editing) update.mutate({ id: editing.id, payload }, opts);
    else create.mutate(payload, opts);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Departments</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage organisational hierarchy</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Add Department
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tree.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400 text-sm">No departments yet.</td></tr>
              ) : (
                tree.map(node => (
                  <DeptNode
                    key={node.id}
                    node={node}
                    allNodes={flatList}
                    onEdit={openEdit}
                    onDeactivate={handleDeactivate}
                    deactivating={deactivate.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <SlidePanel title={editing ? 'Edit Department' : 'Add Department'} open={panelOpen} onClose={() => setPanelOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Underwriting"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. UNDERWRITING"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Parent Department</label>
            <select
              value={form.parentId}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (top level)</option>
              {flatList.filter(d => d.id !== editing?.id && d.isActive).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create'}
            </button>
            <button onClick={() => setPanelOpen(false)} className="px-4 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}