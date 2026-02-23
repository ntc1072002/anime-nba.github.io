// Firebase client helper (gọn, có chú thích tiếng Việt)
// - Sử dụng SDK modular (v9+)
// - Các hàm trả về user/getIdToken để frontend trao đổi với backend
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

// cấu hình lấy từ Vite env (frontend/.env) hoặc config-firebase.js
let firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fallback: nếu env variables không đủ, log warning
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('⚠️ Firebase config chưa hoàn toàn từ .env - hãy thêm VITE_FIREBASE_* vào frontend/.env hoặc sửa config-firebase.js');
}

// Nếu không có cấu hình, không khởi tạo Firebase (tránh crash khi dev)
const hasFirebaseConfig = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);
let app = null;
let auth = null;
if (hasFirebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn('Firebase chưa cấu hình. Tạo frontend/.env với VITE_FIREBASE_* để bật auth.');
}

// Đăng nhập bằng username/password (ứng dụng dùng email giả username@local.app)
export async function signInWithUsernamePassword(username, password) {
  if (!auth) throw Object.assign(new Error('Firebase chưa cấu hình.'), { code: 'auth/no-config' });
  const email = `${username}@local.app`;
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Đăng ký bằng username/password (tạo Firebase Auth user)
export async function registerWithUsernamePassword(username, password) {
  if (!auth) throw Object.assign(new Error('Firebase chưa cấu hình.'), { code: 'auth/no-config' });
  const email = `${username}@local.app`;
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Đăng nhập social (hiện hỗ trợ Google popup)
export async function socialSignIn(providerName) {
  if (!auth) throw Object.assign(new Error('Firebase chưa cấu hình.'), { code: 'auth/no-config' });
  if (providerName === 'google') {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }
  if (providerName === 'facebook') {
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }
  throw new Error('Unsupported provider');
}

// Lấy ID token của user hiện tại (Firebase ID token)
export async function getIdTokenForUser(user) {
  if (!auth) return null;
  if (user && typeof user.getIdToken === 'function') return user.getIdToken();
  if (auth.currentUser) return auth.currentUser.getIdToken();
  return null;
}

// Đăng xuất (Firebase client)
export async function signOut() {
  if (!auth) return;
  try { await firebaseSignOut(auth); } catch (e) { /* ignore */ }
}

export default { signInWithUsernamePassword, registerWithUsernamePassword, socialSignIn, getIdTokenForUser, signOut };
