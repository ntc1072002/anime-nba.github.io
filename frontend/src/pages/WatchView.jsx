import React, { useEffect, useState } from "react";
import { authFetch, getUserFromToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default function WatchView({ id }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpisode, setCurrentEpisode] = useState(null);

  useEffect(() => {
    let mounted = true;
  fetch(`${API_BASE}/api/anime/${id}`)
      .then(r => r.json())
      .then(data => { if (mounted) setItem(data); })
      .catch(err => console.error(err))
      .finally(() => { if (mounted) setLoading(false); });
  fetch(`${API_BASE}/api/anime/${id}/episodes`).then(r=>r.json()).then(d=>{ if (mounted) {
      setEpisodes(d||[]);
      // default to first episode if present
      if ((d||[]).length && !currentEpisode) setCurrentEpisode((d||[])[0]);
    }}).catch(()=>{});
    return () => (mounted = false);
  }, [id]);

  // extract direct video URL from common embed providers
  function extractVideoUrl(url) {
    if (!url) return null;
    try {
      const urlStr = String(url).trim();
      
      // YouTube
      const ytMatch = urlStr.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/);
      if (ytMatch) return null; // YouTube requires iframe or API (can't embed direct video)
      
      // Vimeo
      const vmMatch = urlStr.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vmMatch) return null; // Vimeo requires iframe or API
      
      // Direct MP4/video file
      if (/\.(mp4|webm|mkv|avi|mov|m3u8)$/i.test(urlStr)) {
        return urlStr;
      }
      
      // check if url is already an iframe src (not a direct video), fallback to null
      return null;
    } catch (e) {
      return null;
    }
  }

  const currentEpisodeUrl = currentEpisode?.embed_url || currentEpisode?.url || item?.embed_url;
  const directVideoUrl = extractVideoUrl(currentEpisodeUrl);
  const useIframe = !directVideoUrl; // if no direct video extracted, use iframe

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!item || item.error) return <div className="app-container"><div className="col">Không tìm thấy video.</div></div>;

  return (
    <div className="app-container">
      <div className="col">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{item.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <FollowLikeControls id={id} />
          </div>
        </div>
        {/* {item.cover_url && (
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <img src={item.cover_url} alt={item.title} style={{ width: '100%', height: 'auto', maxHeight: 400, objectFit: 'cover', borderRadius: 6 }} />
          </div>
        )} */}
        <div className="card">
          <div className="iframe-wrap">
            {currentEpisode ? (
              <iframe src={currentEpisode.embed_url || currentEpisode.url || item.embed_url} allowFullScreen title={currentEpisode.title || item.title}></iframe>
            ) : (
              <iframe src={item.embed_url} allowFullScreen title={item.title}></iframe>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <h3>Danh sách tập</h3>
          {episodes.length ? (
            <div className="episode-row">
              {episodes.map(ep => (
                <a key={ep.id}
                   href={`#/watch/${id}/episode/${ep.id}`}
                   onClick={e => { e.preventDefault(); setCurrentEpisode(ep); }}
                   className={currentEpisode && ep.id === currentEpisode.id ? 'episode-btn active' : 'episode-btn'}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <div style={{fontSize:13}}>Tập {ep.number}</div>
                    {ep.title ? <div style={{fontSize:12,color:'var(--muted)'}}>{ep.title}</div> : null}
                  </div>
                </a>
              ))}
            </div>
          ) : <p className="notice">Chưa có tập nào.</p>}
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
        const f = (data.follows || []).some(x => x.type === 'anime' && String(x.target_id) === String(id));
        const l = (data.likes || []).some(x => x.type === 'anime' && String(x.target_id) === String(id));
        setFollowing(!!f);
        setLiked(!!l);
      }).catch(()=>{});
    }
    return () => mounted = false;
  }, [id]);

  async function toggleFollow() {
    if (!user) return window.location.hash = '#/auth';
    try {
  const res = await authFetch('/api/me/follow', { method: 'POST', body: JSON.stringify({ type: 'anime', targetId: id }) });
      const j = await res.json();
      if (res.ok) setFollowing(!!j.following);
    } catch (e) {}
  }

  async function toggleLike() {
    if (!user) return window.location.hash = '#/auth';
    try {
  const res = await authFetch('/api/me/like', { method: 'POST', body: JSON.stringify({ type: 'anime', targetId: id }) });
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
