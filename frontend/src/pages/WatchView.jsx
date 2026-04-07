import React, { useEffect, useState } from "react";
import { authFetch, getUserFromToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default function WatchView({ id }) {

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  /* =============================
     READ EPISODE ID FROM URL
  ============================== */
  function getEpisodeIdFromUrl() {
    const hash = window.location.hash;
    const match = hash.match(/\/episodes\/([^/]+)/);
    return match ? match[1] : null;
  }

  /* =============================
     LOAD ANIME + EPISODES
  ============================== */
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const anime = await fetch(`${API_BASE}/api/anime/${id}`).then(r => r.json());
        if (!mounted) return;
        setItem(anime);

        const eps = await fetch(`${API_BASE}/api/anime/${id}/episodes`).then(r => r.json());
        if (!mounted) return;

        const list = eps || [];
        setEpisodes(list);

        const episodeIdFromUrl = getEpisodeIdFromUrl();

        // ✅ chọn tập theo URL
        if (episodeIdFromUrl) {
          const found = list.find(e => String(e.id) === String(episodeIdFromUrl));
          setCurrentEpisode(found || list[0]);
        } else {
          setCurrentEpisode(list[0]);
        }

      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => mounted = false;
  }, [id]);

  /* =============================
     CONVERT GOOGLE DRIVE URL
  ============================= */
  function normalizeEmbedUrl(url) {
    if (!url) return url;

    // Google Drive dạng /file/d/ID/view
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }

    // dạng open?id=
    const match2 = url.match(/[?&]id=([^&]+)/);
    if (url.includes("drive.google.com") && match2) {
      return `https://drive.google.com/file/d/${match2[1]}/preview`;
    }

    return url;
  }

  /* =============================
     LISTEN URL CHANGE
  ============================== */
  useEffect(() => {

    function handleHashChange() {
      const epId = getEpisodeIdFromUrl();
      if (!epId) return;

      const found = episodes.find(e => String(e.id) === String(epId));
      if (found) setCurrentEpisode(found);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);

  }, [episodes]);

  if (loading)
    return <div className="app-container"><div className="col">Đang tải...</div></div>;

  if (!item)
    return <div className="app-container"><div className="col">Không tìm thấy video.</div></div>;

  return (
    <div className="app-container">
      <div className="col">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ margin: 0, minWidth: 0 }}>{item.title}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FollowLikeControls id={id} />
          </div>
        </div>

        {/* PLAYER */}
        <div className="card">
          <div className="iframe-wrap">
            <iframe
              key={currentEpisode?.id}
              src={normalizeEmbedUrl(
                currentEpisode?.embed_url || item.embed_url
              )}
              allow="autoplay; fullscreen"
              // allowFullScreen
              title={currentEpisode?.title || item.title}
            />
          </div>
        </div>

        {/* EPISODES */}
        <div style={{ marginTop: 12 }}>
          <h3>Danh sách tập</h3>
          <div className="episode-list">
            <div className="left">
              <img src={item.cover_url} alt={item.title} style={{ width: '100%', display: "flex", height: 'auto', maxHeight: 200, objectFit: 'cover', borderRadius: 6 }} />
            </div>
            <div className="right">
              <div className="episode-row">
                {episodes.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => setCurrentEpisode(ep)}
                    className={
                      currentEpisode?.id === ep.id
                        ? "episode-btn active"
                        : "episode-btn"
                    }
                  >
                    Tập {ep.number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="back-link" onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>← Quay lại</button>
        </div>
      </div>
    </div >
  );
}


/* =============================
   FOLLOW + LIKE (GIỮ NGUYÊN)
============================== */

function FollowLikeControls({ id }) {
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const u = getUserFromToken();
    setUser(u);
    let mounted = true;
    if (u) {
      authFetch('/api/me').then(r => r.json()).then(data => {
        if (!mounted) return;
        const f = (data.follows || []).some(x => x.type === 'anime' && String(x.target_id) === String(id));
        const l = (data.likes || []).some(x => x.type === 'anime' && String(x.target_id) === String(id));
        setFollowing(!!f);
        setLiked(!!l);
      }).catch(() => { });
    }
    return () => mounted = false;
  }, [id]);

  // Keyboard navigation for scroll only (when watching anime)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        window.scrollBy({ top: -100, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        window.scrollBy({ top: 100, behavior: 'smooth' });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function toggleFollow() {
    if (!user) return window.location.hash = '#/auth';
    try {
      const res = await authFetch('/api/me/follow', { method: 'POST', body: JSON.stringify({ type: 'anime', targetId: id }) });
      const j = await res.json();
      if (res.ok) setFollowing(!!j.following);
    } catch (e) { }
  }

  async function toggleLike() {
    if (!user) return window.location.hash = '#/auth';
    try {
      const res = await authFetch('/api/me/like', { method: 'POST', body: JSON.stringify({ type: 'anime', targetId: id }) });
      const j = await res.json();
      if (res.ok) setLiked(!!j.liked);
    } catch (e) { }
  }

  return (
    <>
      <button className={following ? 'btn' : 'btn secondary'} onClick={toggleFollow}>{following ? 'Đang theo dõi' : 'Theo dõi'}</button>
      <button className={liked ? 'btn' : 'btn secondary'} onClick={toggleLike}>{liked ? 'Đã thích' : 'Like'}</button>
    </>
  );
}
