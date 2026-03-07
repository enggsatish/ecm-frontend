/**
 * ruleEngine.js
 * Client-side rule evaluation — exact mirror of RuleEngineService.java
 * Must stay in sync with backend to ensure consistent behaviour.
 *
 * Usage:
 *   const { hidden, required, blocking, computed } = evaluateRules(schema, formData);
 *   - hidden:   Set<string> of field keys (and '__section__<sectionId>' for sections)
 *   - required: Set<string> of field keys dynamically made required
 *   - blocking: string[]   of user-facing block messages
 *   - computed: Record<string, any> of SET_VALUE results
 */

export function evaluateRules(schema, formData) {
  const hidden = new Set();
  const required = new Set();
  const blocking = [];
  const computed = {};

  if (!schema) return { hidden, required, blocking, computed };

  const allRules = [
    ...(schema.globalRules || []),
    ...(schema.sections || []).flatMap((s) =>
      (s.fields || []).flatMap((f) => f.rules || [])
    ),
  ];

  for (const rule of allRules) {
    const matches = evaluateCondition(rule.condition, formData);
    const actions = matches ? rule.actions : rule.elseActions;
    if (!actions) continue;

    for (const action of actions) {
      switch (action.type) {
        case 'HIDE':
          hidden.add(action.target);
          break;
        case 'SHOW':
          hidden.delete(action.target);
          break;
        case 'TOGGLE':
          hidden.has(action.target)
            ? hidden.delete(action.target)
            : hidden.add(action.target);
          break;
        case 'REQUIRE':
          required.add(action.target);
          break;
        case 'UNREQUIRE':
          required.delete(action.target);
          break;
        case 'SET_VALUE':
          computed[action.target] = action.value;
          break;
        case 'BLOCK_SUBMIT':
          blocking.push(action.value);
          break;
        case 'HIDE_SECTION':
          hidden.add('__section__' + action.target);
          break;
        case 'SHOW_SECTION':
          hidden.delete('__section__' + action.target);
          break;
        // DISABLE / ENABLE / CLEAR / COPY_FROM / SHOW_MESSAGE handled in renderer
        default:
          break;
      }
    }
  }

  return { hidden, required, blocking, computed };
}

function evaluateCondition(cond, data) {
  if (!cond) return true;

  const results = [
    ...(cond.clauses || []).map((c) => evaluateClause(c, data)),
    ...(cond.subConditions || []).map((s) => evaluateCondition(s, data)),
  ];

  if (!results.length) return true;

  return cond.logic === 'OR'
    ? results.some(Boolean)
    : results.every(Boolean);
}

function evaluateClause(clause, data) {
  const val = data[clause.field];
  const ruleVal = clause.value;

  switch (clause.operator) {
    case 'EQUALS':
      return String(val ?? '').toLowerCase() === String(ruleVal ?? '').toLowerCase();
    case 'NOT_EQUALS':
      return String(val ?? '').toLowerCase() !== String(ruleVal ?? '').toLowerCase();
    case 'IS_EMPTY':
      return val == null || String(val).trim() === '';
    case 'IS_NOT_EMPTY':
      return val != null && String(val).trim() !== '';
    case 'CONTAINS':
      return String(val ?? '').toLowerCase().includes(String(ruleVal ?? '').toLowerCase());
    case 'NOT_CONTAINS':
      return !String(val ?? '').toLowerCase().includes(String(ruleVal ?? '').toLowerCase());
    case 'STARTS_WITH':
      return String(val ?? '').toLowerCase().startsWith(String(ruleVal ?? '').toLowerCase());
    case 'ENDS_WITH':
      return String(val ?? '').toLowerCase().endsWith(String(ruleVal ?? '').toLowerCase());
    case 'GREATER_THAN':
      return Number(val) > Number(ruleVal);
    case 'LESS_THAN':
      return Number(val) < Number(ruleVal);
    case 'GREATER_OR_EQUAL':
      return Number(val) >= Number(ruleVal);
    case 'LESS_OR_EQUAL':
      return Number(val) <= Number(ruleVal);
    case 'BETWEEN': {
      const n = Number(val);
      const [lo, hi] = Array.isArray(ruleVal) ? ruleVal : [ruleVal, ruleVal];
      return n >= Number(lo) && n <= Number(hi);
    }
    case 'IN':
      return Array.isArray(ruleVal) ? ruleVal.includes(val) : val === ruleVal;
    case 'NOT_IN':
      return Array.isArray(ruleVal) ? !ruleVal.includes(val) : val !== ruleVal;
    case 'BEFORE_DATE':
      return new Date(val) < new Date(ruleVal);
    case 'AFTER_DATE':
      return new Date(val) > new Date(ruleVal);
    case 'DATE_BETWEEN': {
      const d = new Date(val);
      const [start, end] = Array.isArray(ruleVal) ? ruleVal : [ruleVal, ruleVal];
      return d >= new Date(start) && d <= new Date(end);
    }
    default:
      return false;
  }
}

/** Helper: build a blank new rule object for the rule builder UI */
export function newRule(id) {
  return {
    id: id || crypto.randomUUID(),
    trigger: 'ON_CHANGE',
    condition: { logic: 'AND', clauses: [{ field: '', operator: 'EQUALS', value: '' }] },
    actions: [{ type: 'HIDE', target: '' }],
    elseActions: [],
  };
}