/**
 * useWorkflow.js
 * TanStack Query v5 hooks for ecm-workflow (port 8083 via gateway).
 *
 * ─── WHY NO .then() in queryFns ──────────────────────────────────────────────
 * workflowApi functions already call .then(unwrap) internally, where
 * unwrap = (r) => r.data?.data ?? r.data (operates on the raw axios response).
 * Combined with the apiClient interceptor that strips the ApiResponse envelope,
 * every api.getXxx() call resolves directly to the payload (array or object).
 *
 * If hooks additionally did .then(r => r.data?.data ?? r.data), then `r` would
 * be the already-resolved payload (e.g. an array), r.data = undefined, and
 * undefined ?? undefined = undefined — TanStack Query throws:
 *   "Query data cannot be undefined"
 *
 * Fix: call api.getXxx() directly in queryFn. No extra .then() needed.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * STATUS VALUES (WorkflowInstanceRecord.status):
 *   ACTIVE | INFO_REQUESTED | COMPLETED_APPROVED | COMPLETED_REJECTED | CANCELLED
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as api from '../api/workflowApi'

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const workflowKeys = {
  inbox:       () => ['workflow', 'inbox'],
  tasks:       () => ['workflow', 'tasks', 'my'],
  instances:   (params) => ['workflow', 'instances', params],
  instance:    (id) => ['workflow', 'instance', id],
  definitions: () => ['workflow', 'definitions'],
  groups:      () => ['workflow', 'groups'],
  categories:  () => ['workflow', 'categories', 'mappings'],
}

// ─── Inbox / Tasks ────────────────────────────────────────────────────────────
export function useSlaSummary() {
  return useQuery({
    queryKey: ['sla-summary'],
    queryFn:  () => api.getSlaSummary(),   // workflowApi.js handles the call
    throwOnError: false,
  })
}

export function useSlaOverdue() {
  return useQuery({
    queryKey:        ['sla-overdue'],
    queryFn:         () => api.getSlaOverdue(),
    refetchInterval: 60_000,   // auto-refresh every minute for live SLA monitoring
    throwOnError:    false,
  })
}
/**
 * Full inbox: claimed tasks + unclaimed pool tasks in my groups.
 * Auto-refreshes every 30 s so reviewers see new assignments without reloading.
 */
export function useMyInbox() {
  return useQuery({
    queryKey:        workflowKeys.inbox(),
    queryFn:         () => api.getMyInbox(),  // already resolves to payload
    refetchInterval: 30_000,
    throwOnError:    false,
  })
}

/** Tasks I have personally claimed. Auto-refreshes every 30 s. */
export function useMyTasks() {
  return useQuery({
    queryKey:        workflowKeys.tasks(),
    queryFn:         () => api.getMyTasks(),  // already resolves to payload
    refetchInterval: 30_000,
    throwOnError:    false,
  })
}

// ─── Workflow Instances ───────────────────────────────────────────────────────

/**
 * Paginated list of workflow instances.
 * @param {object} params - { page, size, status, documentId, ... }
 */
export function useWorkflowInstances(params = {}) {
  return useQuery({
    queryKey:        workflowKeys.instances(params),
    queryFn:         () => api.listWorkflowInstances(params), // already resolves to payload
    placeholderData: (prev) => prev,
    throwOnError:    false,
  })
}

/** Single workflow instance detail. */
export function useWorkflowInstance(id) {
  return useQuery({
    queryKey:     workflowKeys.instance(id),
    queryFn:      () => api.getWorkflowInstance(id), // already resolves to payload
    enabled:      !!id,
    throwOnError: false,
  })
}

// ─── Task Mutations ───────────────────────────────────────────────────────────

/** Claim an unclaimed pool task. */
export function useClaimTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId }) => api.claimTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow'] })
      toast.success('Task claimed')
    },
    onError: (err) => toast.error(err?.message || 'Failed to claim task'),
  })
}

/** Return a claimed task back to the pool. */
export function useUnclaimTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId }) => api.unclaimTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow'] })
      toast.success('Task returned to pool')
    },
    onError: (err) => toast.error(err?.message || 'Failed to unclaim task'),
  })
}

/**
 * Complete a review task.
 * @param {'approve'|'reject'|'request-info'|'pass'} action
 */
export function useCompleteTask(action) {
  const qc = useQueryClient()

  const mutationFnMap = {
    'approve':      ({ taskId, payload }) => api.approveTask(taskId, payload?.comment),
    'reject':       ({ taskId, payload }) => api.rejectTask(taskId, payload?.comment),
    'request-info': ({ taskId, payload }) => api.requestInfo(taskId, payload?.comment),
    'pass':         ({ taskId, payload }) => api.passToSpecialist(taskId, payload?.comment),
  }

  const successMessages = {
    'approve':      'Document approved',
    'reject':       'Document rejected',
    'request-info': 'Additional information requested from submitter',
    'pass':         'Task passed to specialist',
  }

  const mutationFn = mutationFnMap[action]
  if (!mutationFn) throw new Error(`useCompleteTask: unknown action "${action}"`)

  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow'] })
      toast.success(successMessages[action] || 'Action completed')
    },
    onError: (err) => toast.error(err?.message || 'Action failed'),
  })
}

/**
 * Submit additional information for an INFO_REQUESTED task.
 * On success the workflow instance moves from INFO_REQUESTED → ACTIVE.
 */
export function useProvideInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, comment }) => api.provideInfo(taskId, { comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow'] })
      toast.success('Information submitted — document returned to reviewer queue')
    },
    onError: (err) => toast.error(err?.message || 'Failed to submit information'),
  })
}

/** Cancel a running workflow instance (admin only). */
export function useCancelWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => api.cancelWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow'] })
      toast.success('Workflow cancelled')
    },
    onError: (err) => toast.error(err?.message || 'Failed to cancel workflow'),
  })
}

// ─── Admin: Definitions ───────────────────────────────────────────────────────

/** List all workflow definitions. Stale for 10 minutes. */
export function useWorkflowDefinitions() {
  return useQuery({
    queryKey:     workflowKeys.definitions(),
    queryFn:      () => api.listWorkflowDefinitions(), // already resolves to payload
    staleTime:    10 * 60 * 1000,
    throwOnError: false,
  })
}

/** Create a new workflow definition. */
export function useCreateWorkflowDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.createWorkflowDefinition(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.definitions() })
      toast.success('Workflow definition created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create definition'),
  })
}

/** Update an existing workflow definition. */
export function useUpdateWorkflowDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.updateWorkflowDefinition(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.definitions() })
      toast.success('Workflow definition updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed to update definition'),
  })
}

// ─── Admin: Groups ────────────────────────────────────────────────────────────

/** List all workflow groups. */
export function useWorkflowGroups() {
  return useQuery({
    queryKey:     workflowKeys.groups(),
    queryFn:      () => api.listWorkflowGroups(), // already resolves to payload
    throwOnError: false,
  })
}

/** Create a workflow group. */
export function useCreateWorkflowGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) =>
      api.createWorkflowGroup({ name: payload.name, description: payload.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.groups() })
      toast.success('Group created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create group'),
  })
}

// ─── Admin: Category Mappings ─────────────────────────────────────────────────

export function useCategoryMappings() {
  return useQuery({
    queryKey:     workflowKeys.categories(),
    queryFn:      () => api.listCategoryMappings(), // already resolves to payload
    throwOnError: false,
  })
}

export function useCreateCategoryMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.createCategoryMapping(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.categories() })
      toast.success('Category mapping created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create mapping'),
  })
}

export function useDeleteCategoryMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => api.deleteCategoryMapping(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.categories() })
      toast.success('Mapping deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete mapping'),
  })
}