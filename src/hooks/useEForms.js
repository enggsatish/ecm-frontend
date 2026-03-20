/**
 * useEForms.js
 * TanStack Query v5 hooks for ecm-eforms.
 *
 * eformsApi list functions are async and return plain arrays already
 * (they normalise Page<T> / List<T> → T[]).
 * Single-object functions still return an axios response — those hooks
 * extract response.data (already unwrapped by the apiClient interceptor).
 *
 * Mutation onError references err.message because apiClient wraps all
 * errors as new Error(message), so .message is always present.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as api from '../api/eformsApi'

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const eformsKeys = {
  definitions:    (params)  => ['eforms', 'definitions', params],
  definition:     (id)      => ['eforms', 'definition', id],
  versions:       (id)      => ['eforms', 'versions', id],
  published:      ()        => ['eforms', 'published'],
  schema:         (formKey) => ['eforms', 'schema', formKey],
  mySubmissions:  ()        => ['eforms', 'submissions', 'mine'],
  allSubmissions: ()        => ['eforms', 'submissions', 'all'],
  submission:     (id)      => ['eforms', 'submission', id],
}

// ─── Form Definitions ─────────────────────────────────────────────────────────

/** Returns T[] — api.getFormDefinitions is async and normalises Page/List. */
export function useFormDefinitions(params = {}) {
  return useQuery({
    queryKey: eformsKeys.definitions(params),
    queryFn:  () => api.getFormDefinitions(params),
  })
}

/** Returns a single FormDefinitionResponse object. */
export function useFormDefinition(id) {
  return useQuery({
    queryKey: eformsKeys.definition(id),
    queryFn:  () => api.getFormDefinition(id).then((r) => r.data),
    enabled:  !!id,
  })
}

/** Returns T[] — api.getFormVersionHistory is async and normalises. */
export function useFormVersionHistory(id) {
  return useQuery({
    queryKey: eformsKeys.versions(id),
    queryFn:  () => api.getFormVersionHistory(id),
    enabled:  !!id,
  })
}

export function useCreateFormDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createFormDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      toast.success('Form created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create form'),
  })
}

export function useUpdateFormDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.updateFormDefinition(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: eformsKeys.definition(vars.id) })
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      toast.success('Draft saved')
    },
    onError: (err) => toast.error(err?.message || 'Failed to save'),
  })
}

export function usePublishForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.publishForm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      qc.invalidateQueries({ queryKey: ['eforms', 'published'] })
      toast.success('Form published successfully')
    },
    onError: (err) => toast.error(err?.message || 'Failed to publish'),
  })
}

export function useArchiveForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveForm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      toast.success('Form archived')
    },
    onError: (err) => toast.error(err?.message || 'Failed to archive'),
  })
}

export function useCloneForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.cloneForm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      toast.success('Form cloned — new draft created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to clone'),
  })
}

export function useDeleteFormDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteFormDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eforms', 'definitions'] })
      toast.success('Draft deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete'),
  })
}

// ─── Form Rendering ───────────────────────────────────────────────────────────

/** Returns T[] — api.getPublishedForms is async and normalises. */
export function usePublishedForms() {
  return useQuery({
    queryKey: eformsKeys.published(),
    queryFn:  () => api.getPublishedForms(),
  })
}

/** Returns a single schema/definition object. */
export function useFormSchema(formKey) {
  return useQuery({
    queryKey: eformsKeys.schema(formKey),
    queryFn:  () => api.getFormSchema(formKey).then((r) => r.data),
    enabled:  !!formKey,
  })
}

// ─── Form Submissions ─────────────────────────────────────────────────────────

/** Returns T[] — api.getMySubmissions is async and normalises. */
export function useMySubmissions() {
  return useQuery({
    queryKey: eformsKeys.mySubmissions(),
    queryFn:  () => api.getMySubmissions(),
    // Auto-poll every 30s when any submission is awaiting signature
    refetchInterval: (query) => {
      const data = query.state.data
      const hasPending = Array.isArray(data) &&
        data.some(s => s.status === 'PENDING_SIGNATURE')
      return hasPending ? 30_000 : false
    },
    staleTime: 10_000,
  })
}

/** Returns T[] — api.getAllSubmissions is async and normalises. */
export function useAllSubmissions() {
  return useQuery({
    queryKey: eformsKeys.allSubmissions(),
    queryFn:  () => api.getAllSubmissions(),
  })
}

/** Returns a single submission object. */
export function useSubmission(id) {
  return useQuery({
    queryKey: eformsKeys.submission(id),
    queryFn:  () => api.getSubmission(id).then((r) => r.data),
    enabled:  !!id,
  })
}

export function useSubmitForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.submitForm,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: eformsKeys.mySubmissions() })
      toast.success(vars.draft ? 'Draft saved' : 'Form submitted successfully')
    },
    onError: (err) => toast.error(err?.message || 'Submission failed'),
  })
}

export function useWithdrawSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.withdrawSubmission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eformsKeys.mySubmissions() })
      toast.success('Submission withdrawn')
    },
    onError: (err) => toast.error(err?.message || 'Failed to withdraw'),
  })
}