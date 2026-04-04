import React, { useEffect, useState } from "react";
import { API_BASE } from "../config.js";

export default function Watch({ data = [], loading = false }) {
  return (
    <div className="col right">
      <h2 className="page-title">Xem anime</h2>

      {loading ? (
        <div className="media-skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="media-skeleton-card">
              <div className="media-skeleton-cover" />
              <div className="media-skeleton-line long" />
              <div className="media-skeleton-line medium" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="empty-block">Chưa có anime nào.</p>
      ) : (
        data.map((a) => <AnimeCard key={a.id} anime={a} />)
      )}
    </div>
  );
}

function AnimeCard({ anime }) {
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoadingEpisodes(true);
    fetch(`${API_BASE}/api/anime/${anime.id}/episodes`)
      .then((r) => r.json())
      .then((items) => setEpisodes(items || []))
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEpisodes(false));
  }, [anime.id]);

  const maxDescLength = 150;
  const rawDesc = anime.description || "Không có mô tả nào.";
  const isTruncated = rawDesc.length > maxDescLength;
  const truncatedDesc = isTruncated ? `${rawDesc.substring(0, maxDescLength)}...` : rawDesc;

  return (
    <>
      <article className="media-card" onClick={() => window.location.href = `#/watch/${anime.id}`}>
        <div className="media-card-top">
          <div className="media-poster">
            {anime.cover_url ? <img src={anime.cover_url} alt={anime.title} /> : <div className="media-poster-empty">No image</div>}
          </div>

          <div className="media-info">
            <h3 className="media-title">
              <a href={`#/watch/${anime.id}`}>{anime.title}</a>
            </h3>

            <p className="media-desc">{truncatedDesc}</p>

            <div className="media-meta-row">
              <span>{episodes.length} tập</span>
              <div className="media-actions">
                {isTruncated ? (
                  <button type="button" className="action-chip" onClick={() => setShowModal(true)}>
                    Chi tiết
                  </button>
                ) : null}
                <a href={`#/watch/${anime.id}`} className="primary-link">
                  Xem phim
                </a>
              </div>
            </div>
          </div>
        </div>

        {loadingEpisodes ? (
          <div className="media-subtle">Đang tải tập...</div>
        ) : episodes.length === 0 ? (
          <div className="media-subtle">Chưa có tập nào</div>
        ) : (
          <div className="chip-list">
            {episodes.slice(0, 6).map((ep) => (
              <a key={ep.id} href={`#/watch/${anime.id}/episodes/${ep.id}`} className="chip-link">
                Tập {ep.number}
              </a>
            ))}
            {episodes.length > 6 ? (
              <a href={`#/watch/${anime.id}`} className="chip-link muted">
                +{episodes.length - 6} tập khác
              </a>
            ) : null}
          </div>
        )}
      </article>
      {showModal ? (
        <div className="soft-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="soft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="soft-modal-body">
              {anime.cover_url ? <img src={anime.cover_url} alt={anime.title} className="soft-modal-cover" /> : null}
              <div>
                <h2>{anime.title}</h2>
                <p>{rawDesc}</p>
                <div className="soft-modal-meta">{episodes.length} tập</div>
                <a href={`#/watch/${anime.id}`} className="primary-link">
                  Xem phim
                </a>
              </div>
            </div>
            <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>

            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
