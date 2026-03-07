/**
 * RuleBuilder.jsx
 * Visual condition → action rule editor.
 * Operates on schema.globalRules via the eformsStore.
 * Supports AND/OR conditions with multiple clauses, multiple actions.
 */
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { useEFormsDesignerStore } from '../../../store/eformsStore';
import { newRule } from '../../../utils/ruleEngine';

const OPERATORS = [
  { value: 'EQUALS',          label: 'equals' },
  { value: 'NOT_EQUALS',      label: 'not equals' },
  { value: 'IS_EMPTY',        label: 'is empty' },
  { value: 'IS_NOT_EMPTY',    label: 'is not empty' },
  { value: 'CONTAINS',        label: 'contains' },
  { value: 'NOT_CONTAINS',    label: 'does not contain' },
  { value: 'GREATER_THAN',    label: 'greater than' },
  { value: 'LESS_THAN',       label: 'less than' },
  { value: 'GREATER_OR_EQUAL',label: 'greater or equal' },
  { value: 'LESS_OR_EQUAL',   label: 'less or equal' },
  { value: 'IN',              label: 'in list' },
];

const ACTION_TYPES = [
  { value: 'HIDE',         label: 'Hide field' },
  { value: 'SHOW',         label: 'Show field' },
  { value: 'REQUIRE',      label: 'Make required' },
  { value: 'UNREQUIRE',    label: 'Make optional' },
  { value: 'SET_VALUE',    label: 'Set value' },
  { value: 'BLOCK_SUBMIT', label: 'Block submit (show message)' },
  { value: 'HIDE_SECTION', label: 'Hide section' },
  { value: 'SHOW_SECTION', label: 'Show section' },
];

const NEEDS_VALUE_OPS = new Set([
  'EQUALS','NOT_EQUALS','CONTAINS','NOT_CONTAINS','GREATER_THAN','LESS_THAN',
  'GREATER_OR_EQUAL','LESS_OR_EQUAL','IN',
]);

export default function RuleBuilder() {
  const { schema, addGlobalRule, updateGlobalRule, removeGlobalRule, getAllFieldKeys } = useEFormsDesignerStore();
  const rules = schema.globalRules || [];
  const fieldKeys = getAllFieldKeys();

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Conditional Rules</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Rules are evaluated in order on every field change. Server re-validates using the same logic.
            </p>
          </div>
          <button
            onClick={() => addGlobalRule(newRule())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-12 flex flex-col items-center">
            <span className="text-3xl mb-3">⚡</span>
            <p className="text-sm text-gray-500">No rules yet</p>
            <p className="text-xs text-gray-400 mt-1">Add rules to show/hide fields based on conditions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule, rIdx) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                ruleNumber={rIdx + 1}
                fieldKeys={fieldKeys}
                onUpdate={(partial) => updateGlobalRule(rule.id, partial)}
                onRemove={() => removeGlobalRule(rule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({ rule, ruleNumber, fieldKeys, onUpdate, onRemove }) {
  const updateCondition = (partial) =>
    onUpdate({ condition: { ...rule.condition, ...partial } });

  const updateClause = (idx, partial) => {
    const clauses = [...(rule.condition.clauses || [])];
    clauses[idx] = { ...clauses[idx], ...partial };
    updateCondition({ clauses });
  };

  const addClause = () =>
    updateCondition({
      clauses: [...(rule.condition.clauses || []), { field: '', operator: 'EQUALS', value: '' }],
    });

  const removeClause = (idx) => {
    const clauses = [...(rule.condition.clauses || [])];
    clauses.splice(idx, 1);
    updateCondition({ clauses });
  };

  const updateAction = (actList, idx, partial) => {
    const list = [...actList];
    list[idx] = { ...list[idx], ...partial };
    return list;
  };

  const addAction = () =>
    onUpdate({ actions: [...(rule.actions || []), { type: 'HIDE', target: '' }] });

  const removeAction = (idx) => {
    const actions = [...(rule.actions || [])];
    actions.splice(idx, 1);
    onUpdate({ actions });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">#{ruleNumber}</span>
          <input
            type="text"
            value={rule.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={`Rule ${ruleNumber}`}
            className="text-xs font-medium text-gray-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
          />
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 p-1 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* WHEN conditions */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-indigo-600 uppercase">When</span>
            <select
              value={rule.condition?.logic || 'AND'}
              onChange={(e) => updateCondition({ logic: e.target.value })}
              className={smallSelectCls}
            >
              <option value="AND">ALL of these match (AND)</option>
              <option value="OR">ANY of these match (OR)</option>
            </select>
          </div>

          <div className="space-y-1.5 ml-2">
            {(rule.condition?.clauses || []).map((clause, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={clause.field}
                  onChange={(e) => updateClause(idx, { field: e.target.value })}
                  className={smallSelectCls}
                >
                  <option value="">Select field...</option>
                  {fieldKeys.map((f) => (
                    <option key={f.key} value={f.key}>{f.label || f.key}</option>
                  ))}
                </select>
                <select
                  value={clause.operator}
                  onChange={(e) => updateClause(idx, { operator: e.target.value })}
                  className={smallSelectCls}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {NEEDS_VALUE_OPS.has(clause.operator) && (
                  <input
                    type="text"
                    value={clause.value || ''}
                    onChange={(e) => updateClause(idx, { value: e.target.value })}
                    placeholder="value"
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-28 focus:outline-none focus:border-indigo-400"
                  />
                )}
                <button onClick={() => removeClause(idx)} className="text-gray-300 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addClause}
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-1"
            >
              <Plus className="w-3 h-3" /> Add condition
            </button>
          </div>
        </div>

        {/* THEN actions */}
        <div>
          <span className="text-xs font-semibold text-green-600 uppercase block mb-2">Then</span>
          <div className="space-y-1.5 ml-2">
            {(rule.actions || []).map((action, idx) => (
              <ActionRow
                key={idx}
                action={action}
                fieldKeys={fieldKeys}
                onChange={(partial) =>
                  onUpdate({ actions: updateAction(rule.actions, idx, partial) })
                }
                onRemove={() => removeAction(idx)}
              />
            ))}
            <button
              onClick={addAction}
              className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 mt-1"
            >
              <Plus className="w-3 h-3" /> Add action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ action, fieldKeys, onChange, onRemove }) {
  const needsTarget = !['BLOCK_SUBMIT'].includes(action.type);
  const needsValue = ['SET_VALUE', 'BLOCK_SUBMIT'].includes(action.type);

  return (
    <div className="flex items-center gap-2">
      <select
        value={action.type}
        onChange={(e) => onChange({ type: e.target.value })}
        className={smallSelectCls}
      >
        {ACTION_TYPES.map((at) => (
          <option key={at.value} value={at.value}>{at.label}</option>
        ))}
      </select>
      {needsTarget && (
        <select
          value={action.target || ''}
          onChange={(e) => onChange({ target: e.target.value })}
          className={smallSelectCls}
        >
          <option value="">Select field...</option>
          {fieldKeys.map((f) => (
            <option key={f.key} value={f.key}>{f.label || f.key}</option>
          ))}
        </select>
      )}
      {needsValue && (
        <input
          type="text"
          value={action.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={action.type === 'BLOCK_SUBMIT' ? 'Message to user...' : 'value'}
          className="text-xs border border-gray-200 rounded px-2 py-1 w-40 focus:outline-none focus:border-indigo-400"
        />
      )}
      <button onClick={onRemove} className="text-gray-300 hover:text-red-400">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const smallSelectCls =
  'text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 bg-white';