import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api');

const ORG_SLUG = 'breathe-esg';
const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refresh';

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
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Organisation-Slug'] = ORG_SLUG;
  }
  return config;
});

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

export const loginRequest = (username, password) =>
  api.post('/auth/login/', { username, password });

export const fetchCurrentUser = () => api.get('/auth/me/');

export default api;
