import React, { useState } from 'react';
import { saveToken, getUserFromToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';
import firebaseClient, { getIdTokenForUser } from '../firebaseClient.js';

export default function Login() {
  const [mode, setMode] = useState('login'); // or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    const url = mode === 'login' ? '/auth/login' : '/auth/register';
    if (mode === 'register' && password !== confirm) {
      setMessage('Mật khẩu và xác nhận mật khẩu không khớp');
      return;
    }
    try {
      // Use Firebase client SDK to sign in / register and exchange ID token with backend
      if (mode === 'login') {
        try {
          const user = await firebaseClient.signInWithUsernamePassword(username, password);
          const idToken = await getIdTokenForUser(user);
          const res = await fetch(`${API_BASE}/auth/firebase`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Lỗi đăng nhập');
          if (data.token) {
            saveToken(data.token);
            window.location.hash = '#/';
            window.location.reload();
          }
        } catch (err) {
          // map Firebase auth errors to Vietnamese messages
          const code = err?.code || '';
          if (code === 'auth/user-not-found') setMessage('Tài khoản không tồn tại');
          else if (code === 'auth/wrong-password') setMessage('Mật khẩu không đúng');
          else if (code === 'auth/invalid-email') setMessage('Email không hợp lệ');
          else if (code === 'auth/too-many-requests') setMessage('Quá nhiều lần thử. Vui lòng thử lại sau');
          else setMessage(err.message || 'Lỗi đăng nhập');
        }
      } else {
        try {
          // register via Firebase client, then exchange token to get server JWT
          const user = await firebaseClient.registerWithUsernamePassword(username, password);
          const idToken = await getIdTokenForUser(user);
          const res = await fetch(`${API_BASE}/auth/firebase`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Lỗi đăng ký');
          if (data.token) {
            saveToken(data.token);
            window.location.hash = '#/';
            window.location.reload();
          }
        } catch (err) {
          const code = err?.code || '';
          if (code === 'auth/email-already-in-use') setMessage('Tài khoản đã tồn tại');
          else if (code === 'auth/weak-password') setMessage('Mật khẩu quá yếu');
          else setMessage(err.message || 'Lỗi đăng ký');
        }
      }
    } catch (err) {
      setMessage(err.message || 'Lỗi');
    }
  }

  return (
    <div className="app-container">
      <div className="col" style={{ maxWidth: 520, margin: '20px auto' }}>
        <h2 className="page-title">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}/>
              <button type="button" className="btn secondary" onClick={() => setShowPassword(s => !s)} > {showPassword ? 'Ẩn' : 'Hiện'} </button>
            </div>
          </div>
            {mode === 'register' ? (
              <div className="form-row">
                <label>Xác nhận mật khẩu</label>
                <input type={showPassword ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
            ) : null}
            {mode === 'login' ? (
              <div className="form-row">
                <label><a href="#/forgot-password">Quên Mật Khẩu?</a></label>
              </div>
            ) : null}
          {/* <div className="form-row">
            <label><a href="#/forgot-password">Quên Mật Khẩu?</a></label>
          </div> */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">{mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
            <button type="button" className="btn secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Tạo tài khoản' : 'Đã có tài khoản'}</button>
          </div>
        </form>
        {message && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 6, background: '#1a1a2e', borderLeft: '4px solid #f88', color: '#f88' }}>
            {message}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>Hoặc đăng nhập nhanh bằng:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => socialLogin('google')}>Đăng nhập với Google</button>
            <button className="btn" onClick={() => socialLogin('facebook')}>Đăng nhập với Facebook</button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function socialLogin(provider) {
  try {
    const user = await firebaseClient.socialSignIn(provider);
    const idToken = await getIdTokenForUser(user);
    const res = await fetch(`${API_BASE}/auth/firebase`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Login failed');
    if (j.token) {
      saveToken(j.token);
      window.location.hash = '#/';
      window.location.reload();
    }
  } catch (err) {
    // map errors to Vietnamese friendly messages
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed') {
      alert('Phương thức đăng nhập này chưa được bật trong Firebase (Auth -> Sign-in method).');
      return;
    }
    if (err.message === 'Unsupported provider') {
      alert('Nhà cung cấp không được hỗ trợ');
      return;
    }
    alert(err.message || 'Lỗi đăng nhập');
  }
}
