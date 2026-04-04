import React, { useEffect, useMemo, useRef, useState } from "react";
import { authFetch, getUserFromToken, signOut } from "../utils/auth.js";

function formatTimeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function notificationHref(item) {
  if (!item) return "#/";
  const type = item.type;
  const targetId = item.target_id;
  const metadata = item.metadata || {};

  if (type === "manga") {
    if (metadata.chapterId) return `#/read/${targetId}/chapter/${metadata.chapterId}`;
    return `#/read/${targetId}`;
  }
  if (type === "anime") {
    if (metadata.episodeId) return `#/watch/${targetId}/episodes/${metadata.episodeId}`;
    return `#/watch/${targetId}`;
  }
  return "#/";
}

function currentPageFromHash() {
  const hash = window.location.hash || "#/";
  const page = hash.replace(/^#\//, "").split("/")[0];
  return page || "home";
}

export default function Header() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(() => currentPageFromHash());
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    function sync() {
      setUser(getUserFromToken());
      setPage(currentPageFromHash());
    }
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setBellOpen(false);
      return;
    }

    let mounted = true;
    async function loadUnreadCount() {
      try {
        const res = await authFetch("/api/me/notifications/unread-count");
        const data = await res.json();
        if (mounted && res.ok) setUnreadCount(Number(data.unread) || 0);
      } catch {}
    }

    loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!bellOpen) return;
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [bellOpen]);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const res = await authFetch("/api/me/notifications?limit=12");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function toggleBell() {
    if (!bellOpen) await loadNotifications();
    setBellOpen((v) => !v);
  }

  async function markAsRead(notificationId) {
    try {
      const res = await authFetch(`/api/me/notifications/${notificationId}/read`, { method: "PATCH" });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }

  async function markAllAsRead() {
    try {
      const res = await authFetch("/api/me/notifications/read-all", { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }

  async function openNotification(item) {
    if (!item) return;
    if (!item.read) await markAsRead(item.id);
    setBellOpen(false);
    window.location.hash = notificationHref(item);
  }

  async function logout() {
    await signOut();
    window.location.hash = "#/";
    window.location.reload();
  }

  const navLinks = useMemo(
    () => [
      { key: "home", href: "#/", label: "Trang chu" },
      { key: "following", href: "#/following", label: "Theo doi" }
    ],
    []
  );

  return (
    <header className="site-header">
      <div className="brand">
        <div className="logo">BT</div>
        <div className="brand-copy">
          <h1>Bao Tang Truyen</h1>
          <div className="brand-subtitle">Doc truyen va xem anime theo cach nhe nhang hon</div>
        </div>
      </div>

      <nav className="nav-links">
        <div className="nav-main">
          {navLinks.map((nav) => (
            <a key={nav.key} href={nav.href} className={`nav-link ${page === nav.key ? "active" : ""}`}>
              {nav.label}
            </a>
          ))}

          {user && user.role === "admin" ? (
            <a href="#/admin" className={`nav-link nav-link-admin ${page === "admin" ? "active" : ""}`}>
              Admin
            </a>
          ) : null}
        </div>

        <div className="nav-user">
          {user ? (
            <div className="bell-wrap" ref={bellRef}>
              <button type="button" className="bell-button" onClick={toggleBell} aria-label="Thong bao">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2a6 6 0 0 0-6 6v3.2c0 .8-.3 1.5-.9 2.1L3.4 15A1 1 0 0 0 4 16.7h16a1 1 0 0 0 .6-1.7l-1.7-1.7a3 3 0 0 1-.9-2.1V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2h-5.6A3 3 0 0 0 12 22Z"
                  />
                </svg>
                {unreadCount > 0 ? <span className="bell-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
              </button>

              {bellOpen ? (
                <div className="bell-menu">
                  <div className="bell-menu-head">
                    <strong>Thong bao</strong>
                    <button type="button" className="btn secondary bell-read-all" onClick={markAllAsRead}>
                      Danh dau da doc
                    </button>
                  </div>

                  {loadingNotifications ? (
                    <div className="notice">Dang tai thong bao...</div>
                  ) : notifications.length === 0 ? (
                    <div className="notice">Ban chua co thong bao nao.</div>
                  ) : (
                    <div className="bell-list">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`bell-item ${item.read ? "" : "unread"}`}
                          onClick={() => openNotification(item)}
                        >
                          <div className="bell-item-title">{item.title || "Thong bao moi"}</div>
                          <div className="bell-item-message">{item.message || ""}</div>
                          <div className="bell-item-time">{formatTimeLabel(item.created_at)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {!user ? (
            <a href="#/auth" className={`nav-link nav-link-auth ${page === "auth" ? "active" : ""}`}>
              Dang nhap
            </a>
          ) : (
            <div className="user-chip">
              <span>Hi, {user.username}</span>
              <button onClick={logout} className="btn secondary">
                Dang xuat
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
