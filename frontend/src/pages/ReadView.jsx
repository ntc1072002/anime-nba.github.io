import React, { useEffect, useState } from "react";
import { authFetch, getUserFromToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default function ReadView({ id }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/manga/${id}`)
      .then(r => r.json())
      .then(data => { if (mounted) setItem(data); })
      .catch(err => console.error(err))
      .finally(() => { if (mounted) setLoading(false); });
    fetch(`${API_BASE}/api/manga/${id}/chapters`).then(r=>r.json()).then(d=>{ if (mounted) setChapters(d||[])}).catch(()=>{});
    return () => (mounted = false);
  }, [id]);

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!item || item.error) return <div className="app-container"><div className="col">Không tìm thấy truyện.</div></div>;
  function normalizeImageUrl(u) {
    if (!u) return u;
    try {
      const url = String(u).trim();
      const gdrive = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
      if (gdrive) {
        const id = gdrive[1] || gdrive[2];
        return `https://drive.google.com/uc?export=view&id=${id}`;
      }
      if (url.includes('dropbox.com')) {
        return url.replace(/\?dl=0$/, '?raw=1').replace(/\?dl=1$/, '?raw=1');
      }
      const imgur = url.match(/i?\.imgur\.com\/(.+?)(?:$|\.)/);
      if (imgur && !/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) {
        return `https://i.imgur.com/${imgur[1]}.jpg`;
      }
      return url;
    } catch (e) {
      return u;
    }
  }

  const posterUrl = normalizeImageUrl((item && (item.cover_url || item.cover || item.poster || item.thumbnail)) || null);

  return (
    <div className="app-container">
      <div className="col">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {posterUrl ? (
            <div style={{ flex: '0 0 auto' }}>
              <img src={posterUrl} alt="poster" style={{ width: 120, height: 'auto', borderRadius: 6 }} />
            </div>
          ) : null}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 className="page-title" style={{ margin: 0 }}>{item.title}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <FollowLikeControls id={id} />
              </div>
            </div>
            <div className="card">
              <p>{item.description}</p>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <h3>Danh sách chương</h3>
          {chapters.length ? (
            <div className="chapter-grid">
                    {chapters.map(c => (
                      <ChapterLink key={c.id} id={id} c={c} />
                    ))}
            </div>
          ) : <p className="notice">Chưa có chương nào.</p>}
        </div>
        <div style={{ marginTop: 12 }}><a className="back-link" href="#/">← Quay lại</a></div>
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
  authFetch('/api/me').then(r => r.json()).then(data => {
        if (!mounted) return;
        const f = (data.follows || []).some(x => x.type === 'manga' && String(x.target_id) === String(id));
        const l = (data.likes || []).some(x => x.type === 'manga' && String(x.target_id) === String(id));
        setFollowing(!!f);
        setLiked(!!l);
      }).catch(()=>{});
    }
    return () => mounted = false;
  }, [id]);

  async function toggleFollow() {
    if (!user) return window.location.hash = '#/auth';
    try {
  const res = await authFetch('/api/me/follow', { method: 'POST', body: JSON.stringify({ type: 'manga', targetId: id }) });
      const j = await res.json();
      if (res.ok) setFollowing(!!j.following);
    } catch (e) {}
  }

  async function toggleLike() {
    if (!user) return window.location.hash = '#/auth';
    try {
  const res = await authFetch('/api/me/like', { method: 'POST', body: JSON.stringify({ type: 'manga', targetId: id }) });
      const j = await res.json();
      if (res.ok) setLiked(!!j.liked);
    } catch (e) {}
  }

  return (
    <>
      <button className={following ? 'btn' : 'btn secondary'} onClick={toggleFollow}>{following ? 'Đang theo dõi' : 'Theo dõi'}</button>
      <button className={liked ? 'btn' : 'btn secondary'} onClick={toggleLike}>{liked ? 'Đã thích' : 'Like'}</button>
    </>
  );
}

function ChapterLink({ id, c }) {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    function onHash() { setHash(window.location.hash); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const isActive = hash.includes(`/read/${id}/chapter/${c.id}`) || (!hash && false);
  return (
    <a key={c.id} className={`chapter-btn ${isActive ? 'active' : ''}`} href={`#/read/${id}/chapter/${c.id}`}>Chương {c.number}{c.title?` - ${c.title}`:''}</a>
  );
}
