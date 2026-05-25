import axios from 'axios';

// Direct Render URL — Vercel /api proxy causes redirect loops with Django trailing slashes.
export const RENDER_API_URL = 'https://breatheesg-khy4.onrender.com/api';

// Always use Render in production (Vercel /api proxy causes redirect loops).
const API_BASE_URL = import.meta.env.PROD
  ? RENDER_API_URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000/api');

const ORG_SLUG = 'breathe-esg';
const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refresh';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const getStoredRefresh = () => localStorage.getItem(REFRESH_KEY) || '';

export const setStoredTokens = (access, refresh) => {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  else localStorage.removeItem(TOKEN_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);
};

export const clearStoredTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

const authHeaders = () => {
  const token = getStoredToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Organisation-Slug'] = ORG_SLUG;
  }
  return headers;
};

api.interceptors.request.use((config) => {
  Object.assign(config.headers, authHeaders());
  if (config.data && !(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

/** File uploads via fetch — avoids axios forcing application/json on FormData. */
export const uploadBatch = async (file, sourceType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source_type', sourceType);

  const response = await fetch(`${API_BASE_URL}/uploads/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredTokens();
      window.dispatchEvent(new Event('auth:logout'));
    }
    const err = new Error(
      typeof data.detail === 'string' ? data.detail : 'Failed to upload batch.'
    );
    err.response = { status: response.status, data };
    throw err;
  }

  return { data };
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  const refresh = getStoredRefresh();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh/`, { refresh }, { timeout: 120000 })
      .then((res) => {
        const access = res.data?.access;
        if (access) {
          setStoredTokens(access, refresh);
          return access;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login/') &&
      !original.url?.includes('/auth/refresh/')
    ) {
      original._retry = true;
      const access = await refreshAccessToken();
      if (access) {
        original.headers.Authorization = `Bearer ${access}`;
        original.headers['X-Organisation-Slug'] = ORG_SLUG;
        return api(original);
      }
      clearStoredTokens();
      window.dispatchEvent(new Event('auth:logout'));
    }

    return Promise.reject(error);
  }
);

/** Ping Render until the API responds (cold-start wake-up). */
export const wakeServer = async (maxAttempts = 6) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await axios.get(`${RENDER_API_URL}/health/`, {
        timeout: 90000,
      });
      if (res.status === 200) return true;
    } catch {
      // Render free tier can take 30–60s to wake up
    }
    if (attempt < maxAttempts - 1) {
      await sleep(3000 + attempt * 2000);
    }
  }
  return false;
};

export const loginRequest = async (username, password) => {
  await wakeServer();

  const maxAttempts = 3;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await api.post('/auth/login/', { username, password });
    } catch (err) {
      lastError = err;
      if (err.response) throw err;
      if (attempt < maxAttempts - 1) {
        await wakeServer(2);
        await sleep(2000);
      }
    }
  }

  throw lastError;
};

export const fetchCurrentUser = () => api.get('/auth/me/');

export default api;
