import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Token storage ────────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess: () => localStorage.getItem('adflow_access'),
  getRefresh: () => localStorage.getItem('adflow_refresh'),
  set: (access: string, refresh: string) => {
    localStorage.setItem('adflow_access', access);
    localStorage.setItem('adflow_refresh', refresh);
  },
  clear: () => {
    localStorage.removeItem('adflow_access');
    localStorage.removeItem('adflow_refresh');
  },
};

// ─── Request interceptor: attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  queue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers!.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = data.data;
      tokenStorage.set(accessToken, newRefresh);
      processQueue(null, accessToken);
      original.headers!.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      tokenStorage.clear();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Typed helpers ────────────────────────────────────────────────────────────
export function apiGet<T>(url: string, params?: Record<string, unknown>) {
  return api.get<{ success: boolean; data: T }>(url, { params }).then((r) => r.data.data);
}

export function apiPost<T>(url: string, body?: unknown) {
  return api.post<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);
}

export function apiPatch<T>(url: string, body?: unknown) {
  return api.patch<{ success: boolean; data: T }>(url, body).then((r) => r.data.data);
}

export function apiDelete(url: string) {
  return api.delete(url);
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
