import { API_BASE } from '../config.js';
import firebaseClient from '../firebaseClient.js';

// Key lưu JWT server
export const TOKEN_KEY = 'authToken';

export function saveToken(token) { try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} }
export function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
export function removeToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

export function getAuthHeaders() { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

// Lấy thông tin user từ JWT (không verify ở client)
export function getUserFromToken() {
  const t = getToken(); if (!t) return null;
  try {
    const parts = t.split('.'); if (parts.length < 2) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (e) { return null; }
}

// Nếu chưa có JWT server, thử lấy Firebase ID token và đổi lấy JWT server
async function exchangeFirebaseTokenIfNeeded() {
  const t = getToken(); if (t) return t;
  try {
    const idToken = await firebaseClient.getIdTokenForUser();
    if (!idToken) return null;
    const res = await fetch(`${API_BASE}/auth/firebase`, { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return null;
    const j = await res.json(); if (j && j.token) { saveToken(j.token); return j.token; }
  } catch (e) { /* ignore */ }
  return null;
}

// Gọi fetch có kèm JWT server (khởi tạo JWT từ Firebase nếu cần)
export async function authFetch(url, opts = {}) {
  const fullUrl = (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  const token = await exchangeFirebaseTokenIfNeeded();
  const headers = Object.assign({}, opts.headers || {}, token ? { Authorization: `Bearer ${token}` } : {}, { 'Content-Type': 'application/json' });
  return fetch(fullUrl, Object.assign({}, opts, { headers }));
}

// Đăng xuất: xóa cả Firebase client và server JWT
export async function signOut() { try { await firebaseClient.signOut(); } catch (e) {} try { removeToken(); } catch (e) {} }
