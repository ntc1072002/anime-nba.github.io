import React, { useState, useEffect } from "react";
import { getUserFromToken, removeToken } from "../utils/auth.js";

export default function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUserFromToken());
  }, []);

  function logout() {
    removeToken();
    window.location.hash = '#/';
    window.location.reload();
  }

  return (
    <header className="site-header">
      <div className="brand">
        <div className="logo">BT</div>
        <div>
          <h1>Bảo Tàng Truyện</h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Ngôi nhà của truyện & anime</div>
        </div>
      </div>

      <nav className="nav-links">
        <a href="#/">Trang chủ</a>
        <a href="#/">Truyện</a>
        <a href="#/">Anime</a>
        {user && user.role === 'admin' ? (
          <a href="#/admin" style={{ marginLeft: 18, fontWeight: 600, color: "white" }}>Admin</a>
        ) : null}

        {!user ? (
          <a href="#/auth" style={{ marginLeft: 18 }}>Đăng nhập</a>
        ) : (
          <>
            <span style={{ marginLeft: 12, color: 'var(--muted)' }}>Hi, {user.username}</span>
            <button onClick={logout} className="btn secondary" style={{ marginLeft: 12 }}>Đăng xuất</button>
          </>
        )}
      </nav>
    </header>
  );
}
