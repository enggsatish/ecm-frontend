/**
 * OcrTemplatesPage.jsx
 * Route: /admin/ocr-templates
 * Admin page for managing OCR extraction templates.
 *
 * Features:
 *   - List templates with category, field count, active status
 *   - Create/edit modal with field pattern editor
 *   - "Test regex" panel — paste sample text, see extracted fields live
 */
import { useState } from 'react';
import { Plus, Edit, Trash2, FlaskConical, X, Check } from 'lucide-react';
import { useOcrTemplates, useCreateOcrTemplate, useUpdateOcrTemplate, useDeleteOcrTemplate } from '../../hooks/useAdmin';
import { useCategories } from '../../hooks/useAdmin';
import toast from 'react-hot-toast';

const EMPTY_FIELD = { fieldName: '', pattern: '', defaultValue: '' };

export default function OcrTemplatesPage() {
  const { data: templates = [], isLoading } = useOcrTemplates();
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateOcrTemplate();
  const updateMutation = useUpdateOcrTemplate();
  const deleteMutation = useDeleteOcrTemplate();

  const [editing, setEditing] = useState(null);       // null = closed, {} = new, {id,...} = edit
  const [testMode, setTestMode] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState(null);

  const allTemplates = Array.isArray(templates) ? templates : [];

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    categoryCode: '', categoryId: null, name: '', description: '', isActive: true,
    fields: [{ ...EMPTY_FIELD }],
  });

  const openNew = () => {
    setForm({ categoryCode: '', categoryId: null, name: '', description: '', isActive: true, fields: [{ ...EMPTY_FIELD }] });
    setEditing({});
    setTestMode(false);
    setTestResults(null);
  };

  const openEdit = (t) => {
    let fields = [];
    try { fields = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields || []; } catch { fields = []; }
    setForm({
      categoryCode: t.categoryCode || '', categoryId: t.categoryId, name: t.name || '',
      description: t.description || '', isActive: t.isActive !== false,
      fields: fields.length ? fields : [{ ...EMPTY_FIELD }],
    });
    setEditing(t);
    setTestMode(false);
    setTestResults(null);
  };

  const handleSave = () => {
    const payload = {
      ...form,
      fields: JSON.stringify(form.fields.filter(f => f.fieldName && f.pattern)),
    };
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, payload }, {
        onSuccess: () => { setEditing(null); toast.success('Template updated'); },
        onError: (e) => toast.error(e?.response?.data?.message || 'Update failed'),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setEditing(null); toast.success('Template created'); },
        onError: (e) => toast.error(e?.response?.data?.message || 'Create failed'),
      });
    }
  };

  const addField = () => setForm(f => ({ ...f, fields: [...f.fields, { ...EMPTY_FIELD }] }));

  const updateField = (idx, key, value) =>
    setForm(f => ({ ...f, fields: f.fields.map((fld, i) => i === idx ? { ...fld, [key]: value } : fld) }));

  const removeField = (idx) =>
    setForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));

  // ── Test regex ────────────────────────────────────────────────────────────
  const runTest = () => {
    const results = {};
    for (const fp of form.fields) {
      if (!fp.fieldName || !fp.pattern) continue;
      try {
        const re = new RegExp(fp.pattern, 'is');
        const m = re.exec(testText);
        results[fp.fieldName] = m && m[1] ? m[1].trim() : fp.defaultValue || '(no match)';
      } catch (e) {
        results[fp.fieldName] = `(regex error: ${e.message})`;
      }
    }
    setTestResults(results);
  };

  const fieldCount = (t) => {
    try {
      const f = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
      return Array.isArray(f) ? f.length : 0;
    } catch { return 0; }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">OCR Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage extraction templates for document categories</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* ── Template List ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : allTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-600">No OCR templates</p>
            <p className="text-xs text-gray-400 mt-1">Create a template to enable field extraction</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Category</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Fields</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allTemplates.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-500">{t.categoryCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{fieldCount(t)} fields</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Deactivate this template?')) deleteMutation.mutate(t.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────── */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing?.id ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:border-indigo-400"
                    placeholder="Identity Document Extraction" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category Code *</label>
                  <select value={form.categoryCode} onChange={e => {
                    const cat = (Array.isArray(categories) ? categories : []).find(c => c.code === e.target.value);
                    setForm(f => ({ ...f, categoryCode: e.target.value, categoryId: cat?.id || null }));
                  }}
                    disabled={!!editing?.id}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:border-indigo-400">
                    <option value="">Select category...</option>
                    {(Array.isArray(categories) ? categories : []).map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:border-indigo-400"
                  placeholder="Government-issued identity document extraction" />
              </div>

              {/* Field patterns */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Extraction Fields
                  </label>
                  <button onClick={addField}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    + Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {form.fields.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <input type="text" value={f.fieldName} placeholder="field_name"
                          onChange={e => updateField(idx, 'fieldName', e.target.value)}
                          className="text-xs font-mono border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400" />
                        <input type="text" value={f.pattern} placeholder="regex pattern"
                          onChange={e => updateField(idx, 'pattern', e.target.value)}
                          className="col-span-2 text-xs font-mono border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400" />
                      </div>
                      <button onClick={() => removeField(idx)}
                        className="p-1 text-gray-400 hover:text-red-500 mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test regex */}
              <div>
                <button onClick={() => setTestMode(!testMode)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 mb-2">
                  <FlaskConical className="w-3.5 h-3.5" />
                  {testMode ? 'Hide Test Panel' : 'Test Regex'}
                </button>
                {testMode && (
                  <div className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/30 space-y-2">
                    <textarea value={testText} onChange={e => setTestText(e.target.value)}
                      rows={4} placeholder="Paste sample OCR text here..."
                      className="w-full text-xs font-mono border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-indigo-400 bg-white" />
                    <button onClick={runTest}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700">
                      Run Extraction
                    </button>
                    {testResults && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(testResults).map(([key, val]) => (
                          <div key={key} className="flex items-baseline gap-2">
                            <span className="text-xs font-mono text-gray-500 w-32 flex-shrink-0">{key}:</span>
                            <span className={`text-xs font-medium ${val === '(no match)' ? 'text-red-500' : 'text-green-700'}`}>
                              {val}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Active</label>
                <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.isActive ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button onClick={handleSave}
                disabled={!form.name || !form.categoryCode}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" /> {editing?.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
