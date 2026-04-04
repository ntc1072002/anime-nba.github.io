import React, { useEffect, useState } from "react";
import { API_BASE } from "../config.js";

export default function Read({ data = [], loading = false }) {
  return (
    <div className="col left">
      <h2 className="page-title">Đọc truyện</h2>

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
        <p className="empty-block">Chưa có truyện nào.</p>
      ) : (
        data.map((m) => <MangaCard key={m.id} manga={m} />)
      )}
    </div>
  );
}

function MangaCard({ manga }) {
  const [chapters, setChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoadingChapters(true);
    fetch(`${API_BASE}/api/manga/${manga.id}/chapters`)
      .then((r) => r.json())
      .then((items) => setChapters(items || []))
      .catch(() => setChapters([]))
      .finally(() => setLoadingChapters(false));
  }, [manga.id]);

  const maxDescLength = 150;
  const rawDesc = manga.description || "Không có mô tả nào.";
  const isTruncated = rawDesc.length > maxDescLength;
  const truncatedDesc = isTruncated ? `${rawDesc.substring(0, maxDescLength)}...` : rawDesc;
  const orderedChapters = [...chapters].sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0));
  const firstChapter = orderedChapters[0] || null;
  const readHref = firstChapter ? `#/read/${manga.id}/chapter/${firstChapter.id}` : `#/read/${manga.id}`;

  return (
    <>
      <article className="media-card" onClick={() => window.location.href = `#/read/${manga.id}`}>
        <div className="media-card-top">
          <div className="media-poster">
            {manga.cover_url ? <img src={manga.cover_url} alt={manga.title} /> : <div className="media-poster-empty">No image</div>}
          </div>

          <div className="media-info">
            <h3 className="media-title">
              <a>{manga.title}</a>
            </h3>

            <p className="media-desc">{truncatedDesc}</p>

            <div className="media-meta-row">
              <span>{chapters.length} chapter</span>
              <div className="media-actions">
                {isTruncated ? (
                  <button type="button" className="action-chip" onClick={() => setShowModal(true)}>
                    Chi tiết
                  </button>
                ) : null}
                {firstChapter ? (
                  <a href={readHref} className="primary-link">
                    Đọc truyện
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {loadingChapters ? (
          <div className="media-subtle">Đang tải chương...</div>
        ) : chapters.length === 0 ? (
          <div className="media-subtle">Chưa có chương nào</div>
        ) : (
          <div className="chip-list">
            {orderedChapters.slice(0, 6).map((chapter) => (
              <a key={chapter.id} href={`#/read/${manga.id}/chapter/${chapter.id}`} className="chip-link">
                Chapter {chapter.number}
              </a>
            ))}
            {chapters.length > 6 ? (
              <a href={`#/read/${manga.id}`} className="chip-link muted">
                +{chapters.length - 6} chapter
              </a>
            ) : null}
          </div>
        )}
      </article>
      {showModal ? (
        <div className="soft-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="soft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="soft-modal-body">
              {manga.cover_url ? <img src={manga.cover_url} alt={manga.title} className="soft-modal-cover" /> : null}
              <div>
                <h2>{manga.title}</h2>
                <p>{rawDesc}</p>
                <div className="soft-modal-meta">{chapters.length} chapters</div>
              </div>
            </div>
            <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
