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

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!episode || episode.error) return <div className="app-container"><div className="col">Không tìm thấy tập.</div></div>;

  return (
    <div className="app-container">
      <div className="col">
        <h2 className="page-title">{episode.title || `Tập ${episode.number}`}</h2>
        <div className="card">
          <div className="iframe-wrap">
            <iframe src={episode.embed_url} allowFullScreen title={episode.title}></iframe>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><a href={`#/watch/${animeId}`}>← Quay lại</a></div>
      </div>
    </div>
  );
}
