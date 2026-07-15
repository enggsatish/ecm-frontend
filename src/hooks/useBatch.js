/**
 * useBatch.js
 * React Query hooks for the batch processing module.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listBatchJobs, getBatchJob, getBatchItems, getBatchStats,
  getReviewQueue, getReviewItem, getAutoProcessed,
  createBatchJob, approveReviewItem, flagReviewItem,
  retryReviewItem, reconcileReviewItem,
} from '../api/batchApi'

// ── Queries ─────────────────────────────────────────────────────────────────

export const useBatchJobs = (params) =>
  useQuery({
    queryKey: ['batch-jobs', params],
    queryFn: () => listBatchJobs(params),
    staleTime: 30_000,
  })

export const useBatchJob = (id) =>
  useQuery({
    queryKey: ['batch-job', id],
    queryFn: () => getBatchJob(id),
    enabled: !!id,
  })

export const useBatchItems = (jobId, params) =>
  useQuery({
    queryKey: ['batch-items', jobId, params],
    queryFn: () => getBatchItems(jobId, params),
    enabled: !!jobId,
  })

export const useBatchStats = () =>
  useQuery({
    queryKey: ['batch-stats'],
    queryFn: getBatchStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

export const useReviewQueue = (params) =>
  useQuery({
    queryKey: ['batch-review', params],
    queryFn: () => getReviewQueue(params),
    staleTime: 15_000,
  })

export const useReviewItem = (itemId) =>
  useQuery({
    queryKey: ['batch-review-item', itemId],
    queryFn: () => getReviewItem(itemId),
    enabled: !!itemId,
  })

export const useAutoProcessed = (params) =>
  useQuery({
    queryKey: ['batch-auto-processed', params],
    queryFn: () => getAutoProcessed(params),
    staleTime: 30_000,
  })

// ── Mutations ───────────────────────────────────────────────────────────────

export const useCreateBatchJob = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ files, metadata, onProgress }) => createBatchJob(files, metadata, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-jobs'] })
      qc.invalidateQueries({ queryKey: ['batch-stats'] })
    },
  })
}

export const useApproveReviewItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, data }) => approveReviewItem(itemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-review'] })
      qc.invalidateQueries({ queryKey: ['batch-stats'] })
    },
  })
}

export const useFlagReviewItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, data }) => flagReviewItem(itemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-auto-processed'] })
      qc.invalidateQueries({ queryKey: ['batch-review'] })
      qc.invalidateQueries({ queryKey: ['batch-stats'] })
    },
  })
}

export const useRetryReviewItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId }) => retryReviewItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-items'] })
      qc.invalidateQueries({ queryKey: ['batch-job'] })
      qc.invalidateQueries({ queryKey: ['batch-jobs'] })
      qc.invalidateQueries({ queryKey: ['batch-stats'] })
    },
  })
}

export const useReconcileReviewItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId }) => reconcileReviewItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch-items'] })
      qc.invalidateQueries({ queryKey: ['batch-job'] })
      qc.invalidateQueries({ queryKey: ['batch-jobs'] })
      qc.invalidateQueries({ queryKey: ['batch-stats'] })
    },
  })
}
