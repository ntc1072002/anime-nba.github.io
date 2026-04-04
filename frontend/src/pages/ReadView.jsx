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
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(months / 12);
  return `${years} năm trước`;
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
      .then((data) => {
        if (mounted) setChapters(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setChapters([]);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="app-container">
        <div className="col">Dang tai...</div>
      </div>
    );
  }

  if (!item || item.error) {
    return (
      <div className="app-container">
        <div className="col">Khong tim thay truyen.</div>
      </div>
    );
  }

  const posterUrl = normalizeImageUrl(
    (item && (item.cover_url || item.cover || item.poster || item.thumbnail)) || null
  );
  const orderedChapters = [...chapters].sort((a, b) => Number(b?.number || 0) - Number(a?.number || 0));

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap"
              }}
            >
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
          {orderedChapters.length ? (
            <section className="chapter-table-panel">
              <header className="chapter-table-head">
                <span className="chapter-table-icon" aria-hidden="true" />
                <h3>Danh sách chương</h3>
              </header>
              <div className="chapter-table-list">
                {orderedChapters.map((c) => (
                  <ChapterRow key={c.id} mangaId={id} chapter={c} />
                ))}
              </div>
            </section>
          ) : (
            <>
              <h3>Danh sách chương</h3>
              <p className="notice">Chưa có chương nào.</p>
            </>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="back-link" onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>
            {"<"}- Quay lại
          </button>
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
        {following ? "Đang theo dõi" : "Theo dõi"}
      </button>
      <button className={liked ? "btn" : "btn secondary"} onClick={toggleLike}>
        {liked ? "Đã thích" : "Thích"}
      </button>
    </>
  );
}

function ChapterRow({ mangaId, chapter }) {
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));

  useEffect(() => {
    function onHash() {
      setHash(window.location.hash);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const isActive = hash.includes(`/read/${mangaId}/chapter/${chapter.id}`);
  const timeLabel = formatRelativeTime(chapter.updated_at || chapter.created_at);
  const chapterLabel = chapter.title ? `Chapter ${chapter.number} - ${chapter.title}` : `${chapter.number}`;

  return (
    <a className={`chapter-table-row ${isActive ? "active" : ""}`} href={`#/read/${mangaId}/chapter/${chapter.id}`}>
      <span className="chapter-table-num">{chapterLabel}</span>
      <span className="chapter-table-time">{timeLabel || "-"}</span>
    </a>
  );
}
