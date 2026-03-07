import { useQuery } from '@tanstack/react-query'
import { searchDocuments, suggestDocuments } from '../api/searchApi'

export const searchKeys = {
  results: (params) => ['search', 'documents', params],
  suggest: (q)      => ['search', 'suggest', q],
}

/**
 * Full document search with facets.
 * enabled only when q is non-empty or at least one filter is active.
 */
export function useDocumentSearch(params) {
  const hasQuery = params?.q?.trim().length > 0
  const hasFilter = params?.categoryId?.length || params?.segmentId?.length
    || params?.status?.length || params?.mimeType?.length

  return useQuery({
    queryKey: searchKeys.results(params),
    queryFn: () => searchDocuments(params),
    enabled: !!(hasQuery || hasFilter),
    staleTime: 30_000,
    keepPreviousData: true,   // don't flash empty while paginating
  })
}

/**
 * Type-ahead suggestions — fires after 2+ characters, 300ms debounce
 * should be handled in the component via useDebounce.
 */
export function useSearchSuggestions(q) {
  return useQuery({
    queryKey: searchKeys.suggest(q),
    queryFn: () => suggestDocuments(q),
    enabled: q?.trim().length >= 2,
    staleTime: 60_000,
  })
}