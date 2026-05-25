import axios from 'axios';

export const RENDER_API_URL = 'https://breatheesg-khy4.onrender.com/api';

/** Same-origin /api on Vercel (proxied to Render). Direct Render URL for local dev. */
export const getApiBaseUrl = () => {
  if (!import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app') || host.includes('vercel.app')) {
      return '/api';
    }
  }
  return RENDER_API_URL;
};

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
  timeout: 120000,
});

const authHeaders = (accessToken) => {
  const token = accessToken || getStoredToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Organisation-Slug'] = ORG_SLUG;
  }
  return headers;
};

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  Object.assign(config.headers, authHeaders());
  if (config.data && !(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

const uploadTimeoutMs = 180000;

/** File uploads via fetch — avoids axios forcing application/json on FormData. */
export const uploadBatch = async (file, sourceType, accessToken) => {
  const token = accessToken || getStoredToken();
  if (!token) {
    const err = new Error('Your session expired. Please sign in again.');
    err.response = { status: 401, data: { detail: err.message } };
    throw err;
  }

  await wakeServer(3);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('source_type', sourceType);

  const url = `${getApiBaseUrl()}/uploads/`;
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      let data = {};
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { detail: text?.slice(0, 200) || `Server error (${response.status})` };
      }

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredTokens();
          window.dispatchEvent(new Event('auth:logout'));
        }
        const msg =
          typeof data.detail === 'string'
            ? data.detail
            : data.error_message || `Upload failed (HTTP ${response.status})`;
        const err = new Error(msg);
        err.response = { status: response.status, data };
        throw err;
      }

      return { data };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err.response || attempt >= 2) throw err;
      await wakeServer(2);
      await sleep(2000);
    }
  }

  throw lastError;
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  const refresh = getStoredRefresh();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${getApiBaseUrl()}/auth/refresh/`, { refresh }, { timeout: 120000 })
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
      const res = await axios.get(`${getApiBaseUrl()}/health/`, {
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
