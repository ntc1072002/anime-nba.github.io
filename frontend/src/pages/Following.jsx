import React, { useEffect, useMemo, useState } from "react";
import { authFetch, getUserFromToken } from "../utils/auth.js";

function CardItem({ item, type }) {
  const href = type === "manga" ? `#/read/${item.id}` : `#/watch/${item.id}`;
  const desc = item.description || "Chua co mo ta.";

  return (
    <a className="following-card" href={href}>
      <div className="following-cover">
        {item.cover_url ? <img src={item.cover_url} alt={item.title || item.id} /> : <div className="cover-empty">No image</div>}
      </div>
      <div className="following-content">
        <h4>{item.title || item.id}</h4>
        <p>{desc}</p>
        <div className="following-flags">
          {item.following ? <span className="status-pill follow">Theo doi</span> : null}
          {item.liked ? <span className="status-pill like">Da thich</span> : null}
        </div>
      </div>
    </a>
  );
}

function Column({ title, items, type }) {
  return (
    <section className="following-column">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <div className="following-empty">Ban chua theo doi hoac thich noi dung nao.</div>
      ) : (
        <div className="following-list">
          {items.map((item) => (
            <CardItem key={item.id} item={item} type={type} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Following() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [library, setLibrary] = useState({ manga: [], anime: [], stats: { manga: {}, anime: {} } });
  const user = useMemo(() => getUserFromToken(), []);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setLoading(false);
      return () => {};
    }

    async function loadLibrary() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch("/api/me/library?limit=200");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Khong the tai du lieu theo doi");
        if (!mounted) return;
        setLibrary({
          manga: data.manga || [],
          anime: data.anime || [],
          stats: data.stats || { manga: {}, anime: {} }
        });
      } catch (err) {
        if (mounted) setError(err.message || "Co loi xay ra");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLibrary();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) {
    return (
      <main className="app-container">
        <div className="col">
          <h2 className="page-title">Theo doi</h2>
          <p className="notice">Ban can dang nhap de xem danh sach theo doi va yeu thich.</p>
          <a className="btn" href="#/auth">
            Dang nhap ngay
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="app-container">
        <div className="col">
          <h2 className="page-title">Theo doi</h2>
          <p className="notice">Dang tai du lieu...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-container">
        <div className="col">
          <h2 className="page-title">Theo doi</h2>
          <p className="notice" style={{ color: "#f88" }}>
            {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-container">
      <div className="col">
        <h2 className="page-title">Theo doi cua ban</h2>
        <div className="following-summary">
          <div className="summary-box">
            <strong>Truyen</strong>
            <span>{library.stats?.manga?.total || 0} muc</span>
          </div>
          <div className="summary-box">
            <strong>Anime</strong>
            <span>{library.stats?.anime?.total || 0} muc</span>
          </div>
        </div>
        <div className="following-layout">
          <Column title="Truyen (Manga)" items={library.manga || []} type="manga" />
          <Column title="Anime" items={library.anime || []} type="anime" />
        </div>
      </div>
    </main>
  );
}
