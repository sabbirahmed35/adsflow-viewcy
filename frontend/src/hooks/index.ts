import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete, api } from '../lib/api';
import { Ad, AdPerformance, AdminStats, GeneratedCopy, ExtractedUrlMetadata, AdStatus } from '@shared/types';

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const Keys = {
  ads: (params?: object) => ['ads', params] as const,
  ad: (id: string) => ['ad', id] as const,
  adPerf: (id: string) => ['ad-perf', id] as const,
  adminAds: (params?: object) => ['admin-ads', params] as const,
  adminPending: () => ['admin-pending'] as const,
  adminStats: () => ['admin-stats'] as const,
};

// ─── Paginated response type ──────────────────────────────────────────────────
interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Client: ads ─────────────────────────────────────────────────────────────
export function useAds(params?: { page?: number; limit?: number; status?: AdStatus }) {
  return useQuery({
    queryKey: Keys.ads(params),
    queryFn: () => apiGet<Paginated<Ad>>('/ads', params as any),
  });
}

export function useAd(id: string) {
  return useQuery({
    queryKey: Keys.ad(id),
    queryFn: () => apiGet<Ad>(`/ads/${id}`),
    enabled: !!id,
  });
}

export function useAdPerformance(id: string) {
  return useQuery({
    queryKey: Keys.adPerf(id),
    queryFn: () => apiGet<AdPerformance[]>(`/ads/${id}/performance`),
    enabled: !!id,
  });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Ad>('/ads', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  });
}

export function useUpdateAd(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPatch<Ad>(`/ads/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Keys.ad(id) });
      qc.invalidateQueries({ queryKey: ['ads'] });
    },
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/ads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads'] }),
  });
}

export function useSubmitAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Ad>(`/ads/${id}/submit`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: Keys.ad(id) });
      qc.invalidateQueries({ queryKey: ['ads'] });
      qc.invalidateQueries({ queryKey: Keys.adminPending() });
    },
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export function useAdminAds(params?: { page?: number; status?: AdStatus; search?: string }) {
  return useQuery({
    queryKey: Keys.adminAds(params),
    queryFn: () => apiGet<Paginated<Ad>>('/admin/ads', params as any),
  });
}

export function useAdminPending() {
  return useQuery({
    queryKey: Keys.adminPending(),
    queryFn: () => apiGet<Ad[]>('/admin/ads/pending'),
    refetchInterval: 30_000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: Keys.adminStats(),
    queryFn: () => apiGet<AdminStats>('/admin/stats'),
    staleTime: 60_000,
  });
}

export function useApproveAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Ad>(`/admin/ads/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Keys.adminPending() });
      qc.invalidateQueries({ queryKey: ['admin-ads'] });
      qc.invalidateQueries({ queryKey: Keys.adminStats() });
    },
  });
}

export function useRejectAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost<Ad>(`/admin/ads/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Keys.adminPending() });
      qc.invalidateQueries({ queryKey: ['admin-ads'] });
    },
  });
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export function useGenerateCopy() {
  return useMutation({
    mutationFn: ({ url, context }: { url: string; context?: string }) =>
      apiPost<{ copy: GeneratedCopy; metadata: ExtractedUrlMetadata }>('/ai/generate-copy', {
        url,
        context,
      }),
  });
}

export function useRegenerateCopy() {
  return useMutation({
    mutationFn: ({
      url,
      existingCopy,
      feedback,
    }: {
      url: string;
      existingCopy: GeneratedCopy;
      feedback?: string;
    }) => apiPost<GeneratedCopy>('/ai/regenerate-copy', { url, existingCopy, feedback }),
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export function useUploadCreative() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{
        success: boolean;
        data: { url: string; key: string; type: 'IMAGE' | 'VIDEO' };
      }>('/upload/creative', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
  });
}
