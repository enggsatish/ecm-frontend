/**
 * ruleEngine.js
 * Client-side rule evaluation — exact mirror of RuleEngineService.java
 * Must stay in sync with backend to ensure consistent behaviour.
 *
 * Usage:
 *   const { hidden, required, blocking, computed, disabled } = evaluateRules(schema, formData);
 *   - hidden:   Set<string>   field keys (and '__section__<sectionId>' for sections)
 *   - required: Set<string>   field keys dynamically made required
 *   - disabled: Set<string>   field keys dynamically disabled  ← NEW (was missing)
 *   - blocking: string[]      user-facing messages that block submission
 *   - computed: Record<string, any>  SET_VALUE / COPY_FROM / CLEAR results
 *
 * ── Sync log (bugs fixed vs previous version) ────────────────────────────────
 * 1. BETWEEN / DATE_BETWEEN: Java uses clause.valueTo as upper bound.
 *    JS was wrongly reading ruleVal as [lo, hi] array — different DSL shapes.
 *    Fixed: read clause.valueTo as the upper bound on both operators.
 *
 * 2. STARTS_WITH / ENDS_WITH: Java is case-sensitive (String.startsWith).
 *    JS was calling .toLowerCase() on both sides — silent mismatch.
 *    Fixed: removed toLowerCase() to match Java's behaviour.
 *
 * 3. Dynamic date expressions (TODAY, TODAY+N, TODAY-N):
 *    Java parseDate() handles these. JS was passing them to new Date() which
 *    returns Invalid Date.
 *    Fixed: added parseRuleDate() helper matching Java's parseDate() logic.
 *
 * 4. DISABLE / ENABLE: Java tracks a disabledFields Set.
 *    JS had no disabled tracking at all — actions fell to default no-op.
 *    Fixed: added disabled Set, returned from evaluateRules().
 *
 * 5. CLEAR: Java sets computed[target] = null.
 *    JS had no case — fell to default.
 *    Fixed: explicit case added.
 *
 * 6. COPY_FROM: Java copies data[action.value] to computed[target].
 *    JS had no case — fell to default.
 *    Fixed: explicit case added.
 */

export function evaluateRules(schema, formData) {
  const hidden    = new Set();
  const required  = new Set();
  const disabled  = new Set();   // ← was missing; Java tracks this
  const blocking  = [];
  const computed  = {};

  if (!schema) return { hidden, required, disabled, blocking, computed };

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
      applyAction(action, formData, hidden, required, disabled, blocking, computed);
    }
  }

  return { hidden, required, disabled, blocking, computed };
}

// ── Action application ────────────────────────────────────────────────────────
// Kept as a separate function to mirror Java's applyActions() method structure.

function applyAction(action, formData, hidden, required, disabled, blocking, computed) {
  const t = action.target;
  switch (action.type) {
    // ── Visibility ──────────────────────────────────────────────────────────
    case 'HIDE':
      hidden.add(t);
      break;
    case 'SHOW':
      hidden.delete(t);
      break;
    case 'TOGGLE':
      hidden.has(t) ? hidden.delete(t) : hidden.add(t);
      break;

    // ── Required state ──────────────────────────────────────────────────────
    case 'REQUIRE':
      required.add(t);
      break;
    case 'UNREQUIRE':
      required.delete(t);
      break;

    // ── Interaction state ───────────────────────────────────────────────────
    case 'DISABLE':          // ← was falling to default (no-op)
      disabled.add(t);
      break;
    case 'ENABLE':           // ← was falling to default (no-op)
      disabled.delete(t);
      break;

    // ── Section visibility ──────────────────────────────────────────────────
    case 'HIDE_SECTION':
      hidden.add('__section__' + t);
      break;
    case 'SHOW_SECTION':
      hidden.delete('__section__' + t);
      break;

    // ── Value manipulation ──────────────────────────────────────────────────
    case 'SET_VALUE':
      computed[t] = action.value;
      break;
    case 'CLEAR':            // ← was falling to default (no-op)
      computed[t] = null;
      break;
    case 'COPY_FROM':        // ← was falling to default (no-op)
      if (action.value != null) {
        computed[t] = formData[action.value];
      }
      break;

    // ── Submission ──────────────────────────────────────────────────────────
    case 'BLOCK_SUBMIT':
      if (action.value != null) blocking.push(String(action.value));
      break;

    // ── Not handled client-side (renderer concerns or server-only) ──────────
    // READONLY, JUMP_TO_SECTION, SHOW_MESSAGE, SET_PRIORITY — handled in renderer
    default:
      break;
  }
}

// ── Condition evaluation ──────────────────────────────────────────────────────

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
  const val     = data[clause.field];
  const ruleVal = clause.value;

  switch (clause.operator) {
    case 'EQUALS':
      return normalizeForCompare(val) === normalizeForCompare(ruleVal);
    case 'NOT_EQUALS':
      return normalizeForCompare(val) !== normalizeForCompare(ruleVal);

    case 'IS_EMPTY':
      return val == null || String(val).trim() === '';
    case 'IS_NOT_EMPTY':
      return val != null && String(val).trim() !== '';

    case 'CONTAINS':
      return String(val ?? '').toLowerCase().includes(String(ruleVal ?? '').toLowerCase());
    case 'NOT_CONTAINS':
      return !String(val ?? '').toLowerCase().includes(String(ruleVal ?? '').toLowerCase());

    // ── FIX #2: remove toLowerCase() — Java is case-sensitive here ────────
    case 'STARTS_WITH':
      return String(val ?? '').startsWith(String(ruleVal ?? ''));
    case 'ENDS_WITH':
      return String(val ?? '').endsWith(String(ruleVal ?? ''));

    case 'GREATER_THAN':
      return Number(val) > Number(ruleVal);
    case 'LESS_THAN':
      return Number(val) < Number(ruleVal);
    case 'GREATER_OR_EQUAL':
      return Number(val) >= Number(ruleVal);
    case 'LESS_OR_EQUAL':
      return Number(val) <= Number(ruleVal);

    // ── FIX #1: use clause.valueTo as upper bound, matching Java ──────────
    case 'BETWEEN': {
      const n  = Number(val);
      const lo = Number(ruleVal);
      const hi = Number(clause.valueTo);        // Java: clause.getValueTo()
      return n >= lo && n <= hi;
    }

    case 'IN':
      return Array.isArray(ruleVal) ? ruleVal.includes(val) : val === ruleVal;
    case 'NOT_IN':
      return Array.isArray(ruleVal) ? !ruleVal.includes(val) : val !== ruleVal;

    // ── FIX #3: dynamic date expressions matching Java's parseDate() ──────
    case 'BEFORE_DATE':
      return parseRuleDate(val) < parseRuleDate(ruleVal);
    case 'AFTER_DATE':
      return parseRuleDate(val) > parseRuleDate(ruleVal);
    case 'DATE_BETWEEN': {
      const d   = parseRuleDate(val);
      const lo  = parseRuleDate(ruleVal);
      const hi  = parseRuleDate(clause.valueTo); // Java: clause.getValueTo()
      return d >= lo && d <= hi;
    }

    default:
      return false;
  }
}

// ── Value normalization ───────────────────────────────────────────────────────

/**
 * Normalize values for EQUALS/NOT_EQUALS comparison.
 * Handles: boolean true/false vs string "true"/"false" (checkbox fields),
 * and case-insensitive string matching.
 */
function normalizeForCompare(val) {
  if (val === true || val === false) return String(val);
  return String(val ?? '').toLowerCase();
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * FIX #3: Parse a rule date value, supporting dynamic expressions.
 * Mirrors Java's RuleEngineService.parseDate():
 *   "TODAY"       → today at midnight
 *   "TODAY+N"     → N days from today
 *   "TODAY-N"     → N days before today
 *   ISO date str  → parsed directly
 *
 * Returns a Date object (or epoch 0 on parse failure, matching Java's null → 0 compare).
 */
function parseRuleDate(value) {
  if (value == null) return new Date(0);
  const s = String(value).trim();

  if (s.toUpperCase() === 'TODAY') {
    return today();
  }
  const plusMatch  = s.match(/^TODAY\+(\d+)$/i);
  const minusMatch = s.match(/^TODAY-(\d+)$/i);
  if (plusMatch)  return addDays(today(), +plusMatch[1]);
  if (minusMatch) return addDays(today(), -minusMatch[1]);

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Builder helper ────────────────────────────────────────────────────────────

/** Build a blank new rule object for the rule builder UI */
export function newRule(id) {
  return {
    id: id || crypto.randomUUID(),
    trigger: 'ON_CHANGE',
    condition: {
      logic: 'AND',
      clauses: [{ field: '', operator: 'EQUALS', value: '', valueTo: null }],
    },
    actions:     [{ type: 'HIDE', target: '' }],
    elseActions: [],
  };
}