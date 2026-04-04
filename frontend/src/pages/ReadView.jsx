import React, { useEffect, useState } from "react";
import { authFetch, getUserFromToken } from "../utils/auth.js";
import { API_BASE } from "../config.js";

function normalizeImageUrl(u) {
  if (!u) return u;
  try {
    const url = String(u).trim();
    const gdrive = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
    if (gdrive) {
      const id = gdrive[1] || gdrive[2];
      return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    if (url.includes("dropbox.com")) {
      return url.replace(/\?dl=0$/, "?raw=1").replace(/\?dl=1$/, "?raw=1");
    }
    const imgur = url.match(/i?\.imgur\.com\/(.+?)(?:$|\.)/);
    if (imgur && !/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) {
      return `https://i.imgur.com/${imgur[1]}.jpg`;
    }
    return url;
  } catch {
    return u;
  }
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  return 0;
}

function formatRelativeTime(value) {
  const ms = toMillis(value);
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vua xong";
  if (mins < 60) return `${mins} phut truoc`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} gio truoc`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngay truoc`;
  return new Date(ms).toLocaleDateString("vi-VN");
}

export default function ReadView({ id }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/manga/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setItem(data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    fetch(`${API_BASE}/api/manga/${id}/chapters`)
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setChapters(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (mounted) setChapters([]);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading)
    return (
      <div className="app-container">
        <div className="col">Dang tai...</div>
      </div>
    );

  if (!item || item.error)
    return (
      <div className="app-container">
        <div className="col">Khong tim thay truyen.</div>
      </div>
    );

  const posterUrl = normalizeImageUrl(
    (item && (item.cover_url || item.cover || item.poster || item.thumbnail)) || null
  );

  return (
    <div className="app-container">
      <div className="col">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          {posterUrl ? (
            <div style={{ flex: "0 0 auto" }}>
              <img src={posterUrl} alt="poster" style={{ width: 120, height: "auto", borderRadius: 6 }} />
            </div>
          ) : null}

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 className="page-title" style={{ margin: 0, minWidth: 0 }}>
                {item.title}
              </h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 6 }}>
                <FollowLikeControls id={id} />
              </div>
            </div>
            <div className="card">
              <p>{item.description}</p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <h3>Danh sach chapters</h3>
          {chapters.length ? (
            <div className="chapter-grid">
              {chapters.map((c) => (
                <ChapterLink key={c.id} id={id} c={c} />
              ))}
            </div>
          ) : (
            <p className="notice">Chua co chapter nao.</p>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <a className="back-link" href="#/">
            {"<"}- Quay lai
          </a>
        </div>
      </div>
    </div>
  );
}

function FollowLikeControls({ id }) {
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const u = getUserFromToken();
    setUser(u);
    let mounted = true;
    if (u) {
      authFetch("/api/me")
        .then((r) => r.json())
        .then((data) => {
          if (!mounted) return;
          const f = (data.follows || []).some((x) => x.type === "manga" && String(x.target_id) === String(id));
          const l = (data.likes || []).some((x) => x.type === "manga" && String(x.target_id) === String(id));
          setFollowing(!!f);
          setLiked(!!l);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  async function toggleFollow() {
    if (!user) {
      window.location.hash = "#/auth";
      return;
    }
    try {
      const res = await authFetch("/api/me/follow", {
        method: "POST",
        body: JSON.stringify({ type: "manga", targetId: id })
      });
      const j = await res.json();
      if (res.ok) setFollowing(!!j.following);
    } catch {}
  }

  async function toggleLike() {
    if (!user) {
      window.location.hash = "#/auth";
      return;
    }
    try {
      const res = await authFetch("/api/me/like", {
        method: "POST",
        body: JSON.stringify({ type: "manga", targetId: id })
      });
      const j = await res.json();
      if (res.ok) setLiked(!!j.liked);
    } catch {}
  }

  return (
    <>
      <button className={following ? "btn" : "btn secondary"} onClick={toggleFollow}>
        {following ? "Dang theo doi" : "Theo doi"}
      </button>
      <button className={liked ? "btn" : "btn secondary"} onClick={toggleLike}>
        {liked ? "Da thich" : "Like"}
      </button>
    </>
  );
}

function ChapterLink({ id, c }) {
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  useEffect(() => {
    function onHash() {
      setHash(window.location.hash);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const isActive = hash.includes(`/read/${id}/chapter/${c.id}`);
  const timeLabel = formatRelativeTime(c.updated_at || c.created_at);

  return (
    <a key={c.id} className={`chapter-btn ${isActive ? "active" : ""}`} href={`#/read/${id}/chapter/${c.id}`}>
      Chuong {c.number}
      {timeLabel ? ` • ${timeLabel}` : ""}
      {c.title ? ` - ${c.title}` : ""}
    </a>
  );
}
