import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchUsers, getUser, updateUser, addRole, removeRole,
  deactivateUser, reactivateUser,
  getDepartments, createDepartment, updateDepartment, deactivateDepartment,
  getCategories, createCategory, updateCategory, deactivateCategory,
  getProducts, getProduct, createProduct, updateProduct, deactivateProduct,
  linkCategory, unlinkCategory, getWorkflowDefinitions,
  getRetentionPolicies, createRetentionPolicy, updateRetentionPolicy, deactivateRetentionPolicy,
  getTenantConfig, updateConfigKey, bulkUpdateConfig,
  // Sprint-C
  getHierarchy, getSegments, createSegment, updateSegment,
  getProductLines, createProductLine, updateProductLine,
  getAuditLog,
} from '../api/adminApi';

// ── Users ──────────────────────────────────────────────────────────────────
export const useUsers = (params) =>
  useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => searchUsers(params),
    staleTime: 30_000,
  });

export const useUser = (id) =>
  useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => getUser(id),
    enabled: !!id,
    staleTime: 30_000,
  });

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateUser(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
  });
};

export const useAddRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleName }) => addRole(id, roleName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useRemoveRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleName }) => removeRole(id, roleName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useReactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => reactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

// ── Departments ────────────────────────────────────────────────────────────
export const useDepartments = (flat = false) =>
  useQuery({
    queryKey: ['admin', 'departments', flat],
    queryFn: () => getDepartments(flat),
    staleTime: 5 * 60_000,
  });

export const useCreateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createDepartment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
};

export const useUpdateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateDepartment(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
};

export const useDeactivateDepartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deactivateDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
};

// ── Categories ─────────────────────────────────────────────────────────────
export const useCategories = (flat = false) =>
  useQuery({
    queryKey: ['admin', 'categories', flat],
    queryFn: () => getCategories(flat),
    staleTime: 5 * 60_000,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createCategory(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateCategory(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
};

export const useDeactivateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deactivateCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
};

// ── Products ───────────────────────────────────────────────────────────────
export const useProducts = (params) =>
  useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => getProducts(params),
    staleTime: 30_000,
  });

export const useProduct = (id) =>
  useQuery({
    queryKey: ['admin', 'products', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
    staleTime: 30_000,
  });

export const useWorkflowDefinitions = () =>
  useQuery({
    queryKey: ['admin', 'workflow-definitions'],
    queryFn: getWorkflowDefinitions,
    staleTime: 5 * 60_000,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createProduct(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateProduct(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'products', id] });
    },
  });
};

export const useDeactivateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deactivateProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
  });
};

export const useLinkCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }) => linkCategory(productId, payload),
    onSuccess: (_, { productId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'products', productId] }),
  });
};

export const useUnlinkCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, categoryId }) => unlinkCategory(productId, categoryId),
    onSuccess: (_, { productId }) =>
      qc.invalidateQueries({ queryKey: ['admin', 'products', productId] }),
  });
};

// ── Retention Policies ─────────────────────────────────────────────────────
export const useRetentionPolicies = () =>
  useQuery({
    queryKey: ['admin', 'retention-policies'],
    queryFn: getRetentionPolicies,
    staleTime: 60_000,
  });

export const useCreateRetentionPolicy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRetentionPolicy(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'retention-policies'] }),
  });
};

export const useUpdateRetentionPolicy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateRetentionPolicy(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'retention-policies'] }),
  });
};

export const useDeactivateRetentionPolicy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => deactivateRetentionPolicy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'retention-policies'] }),
  });
};

// ── Tenant Config ──────────────────────────────────────────────────────────
export const useTenantConfig = () =>
  useQuery({
    queryKey: ['admin', 'tenant-config'],
    queryFn: getTenantConfig,
    staleTime: 10 * 60_000,
  });

export const useBulkUpdateConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configs) => bulkUpdateConfig(configs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenant-config'] }),
  });
};

// ══════════════════════════════════════════════════════════════════
// Sprint-C: Hierarchy & Audit hooks
// ══════════════════════════════════════════════════════════════════

// ── Hierarchy ──────────────────────────────────────────────────────────────

/**
 * Full tree: Segment → ProductLine → Product.
 * Stale for 10 min — this data changes very infrequently.
 * Used by the document upload cascading selects.
 */
export const useHierarchy = () =>
  useQuery({
    queryKey: ['admin', 'hierarchy'],
    queryFn: getHierarchy,
    staleTime: 10 * 60_000,
  });

/** All segments (including inactive) — for the admin segments table. */
export const useSegments = () =>
  useQuery({
    queryKey: ['admin', 'segments'],
    queryFn: getSegments,
    staleTime: 5 * 60_000,
  });

export const useCreateSegment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createSegment(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'segments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'hierarchy'] });
    },
  });
};

export const useUpdateSegment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateSegment(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'segments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'hierarchy'] });
    },
  });
};

/**
 * Product lines for a specific segment — used in cascading selects.
 * Query only fires when segmentId is truthy.
 */
export const useProductLines = (segmentId) =>
  useQuery({
    queryKey: ['admin', 'product-lines', segmentId],
    queryFn: () => getProductLines(segmentId),
    enabled: segmentId != null,
    staleTime: 5 * 60_000,
  });

/** All product lines — for the admin product lines table. */
export const useAllProductLines = () =>
  useQuery({
    queryKey: ['admin', 'product-lines', 'all'],
    queryFn: () => getProductLines(null),
    staleTime: 5 * 60_000,
  });

export const useCreateProductLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createProductLine(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-lines'] });
      qc.invalidateQueries({ queryKey: ['admin', 'hierarchy'] });
    },
  });
};

export const useUpdateProductLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateProductLine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'product-lines'] });
      qc.invalidateQueries({ queryKey: ['admin', 'hierarchy'] });
    },
  });
};

// ── Audit Log ──────────────────────────────────────────────────────────────

/**
 * Paginated audit log.
 * Re-fetches on filter change; stale after 30 s so the page stays fresh
 * during investigation without hammering the DB.
 */
export const useAuditLog = (filters) =>
  useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: () => getAuditLog(filters),
    staleTime: 30_000,
  });