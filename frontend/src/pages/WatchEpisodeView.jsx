import React, { useEffect, useState } from "react";
import { API_BASE } from '../config.js';

export default function WatchEpisodeView({ animeId, episodeId }) {
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/anime/${animeId}/episodes/${episodeId}`)
      .then(r => r.json())
      .then(data => { if (mounted) setEpisode(data); })
      .catch(err => console.error(err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => (mounted = false);
  }, [animeId, episodeId]);

  // Keyboard navigation for scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const start = window.scrollY;
        const target = Math.max(0, start - 300);
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          window.scrollTo(0, start + (target - start) * progress);
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const start = window.scrollY;
        const target = start + 300;
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          window.scrollTo(0, start + (target - start) * progress);
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!episode || episode.error) return <div className="app-container"><div className="col">Không tìm thấy tập.</div></div>;

  return (
    <div className="app-container">
      <div ref={topRef} style={{ height: 0 }} />
      <div className="col">
        <h2 className="page-title">{episode.title || `Tập ${episode.number}`}</h2>
        <div className="card">
          <div className="iframe-wrap">
            <iframe src={episode.embed_url} allow="fullscreen" title={episode.title}></iframe>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><button onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>← Quay lại</button></div>
      </div>
    </div>
  );
}
