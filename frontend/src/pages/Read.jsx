import React, { useEffect, useState } from "react";
import { API_BASE } from '../config.js';

export default function Read({ data = [], loading = false }) {
  return (
    <div className="col left">
      <h2 className="page-title">📖 Đọc truyện</h2>

      {loading ? (
        // Loading skeleton
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ borderRadius: 8, background: '#1a1a2e', padding: 12, minHeight: 200 }}>
              <div style={{ width: '100%', height: 150, background: '#0f0f1a', borderRadius: 6, marginBottom: 8 }}></div>
              <div style={{ height: 16, background: '#0f0f1a', borderRadius: 4, marginBottom: 8, width: '80%' }}></div>
              <div style={{ height: 12, background: '#0f0f1a', borderRadius: 4, width: '60%' }}></div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>Chưa có truyện nào</p>
      ) : (
        data.map(m => (
          <MangaCard key={m.id} manga={m} />
        ))
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
      .then(r => r.json())
      .then(data => setChapters(data || []))
      .catch(err => {
        console.error('Fetch chapters error:', err);
        setChapters([]);
      })
      .finally(() => setLoadingChapters(false));
  }, [manga.id]);

  // Truncate description
  const maxDescLength = 150;
  const isTruncated = manga.description && manga.description.length > maxDescLength;
  const truncatedDesc = isTruncated ? manga.description.substring(0, maxDescLength) + '...' : manga.description || 'Không có mô tả';

  return (
    <>
      <article style={{
        background: '#1a1a2e',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Header: Poster + Title */}
        <div style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Poster */}
          <div style={{
            width: 120,
            height: 160,
            flexShrink: 0,
            borderRadius: 6,
            background: '#0f0f1a',
            overflow: 'hidden'
          }}>
            {manga.cover_url ? (
              <img src={manga.cover_url} alt={manga.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12, textAlign: 'center', padding: 8 }}>
                📷<br />Chưa có ảnh
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>
              <a href={`#/read/${manga.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {manga.title}
              </a>
            </h3>
            <p style={{
              margin: '0 0 8px 0',
              color: '#aaa',
              fontSize: 13,
              lineHeight: 1.4,
              flex: 1,
              overflow: 'hidden'
            }}>
              {truncatedDesc}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#888' }}>📚 {chapters.length} chương</span>
              {isTruncated && (
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    padding: '4px 12px',
                    background: '#0f0f1a',
                    color: '#8ef',
                    border: '1px solid rgba(136, 238, 255, 0.3)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget;   // 👈 cache element
                    if (!el) return;

                    el.style.background = '#1a3a3a';
                    el.style.borderColor = 'rgba(136, 238, 255, 0.5)';
                  }}

                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    if (!el) return;

                    el.style.background = '#0f0f1a';
                    el.style.borderColor = 'rgba(136, 238, 255, 0.3)';
                  }}
                >
                  Chi tiết
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chapters List */}
        {loadingChapters ? (
          <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
            Đang tải chương...
          </div>
        ) : chapters.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
            Chưa có chương nào
          </div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chapters.slice(0, 6).map(ep => (
              <a
                key={ep.id}
                href={`#/read/${manga.id}/chapter/${ep.id}`}
                style={{
                  padding: '6px 10px',
                  background: '#0f0f1a',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#8ef',
                  textDecoration: 'none',
                  border: '1px solid rgba(136, 238, 255, 0.2)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;   // 👈 cache element
                  if (!el) return;

                  el.style.background = '#1a3a3a';
                  el.style.borderColor = 'rgba(136, 238, 255, 0.5)';
                }}

                onMouseLeave={e => {
                  const el = e.currentTarget;
                  if (!el) return;

                  el.style.background = '#0f0f1a';
                  el.style.borderColor = 'rgba(136, 238, 255, 0.3)';
                }}
              >
                Chap {ep.number}
              </a>
            ))}
            {chapters.length > 6 && (
              <a
                href={`#/read/${manga.id}`}
                style={{
                  padding: '6px 10px',
                  background: '#0f0f1a',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#aaa',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer'
                }}
              >
                +{chapters.length - 6} chương khác
              </a>
            )}
          </div>
        )}
      </article>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: 8,
            padding: 24,
            maxWidth: 600,
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255,255,255,0.1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <img
                src={manga.cover_url}
                alt={manga.title}
                style={{ width: 120, height: 160, borderRadius: 6, objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 8px 0', color: '#fff' }}>{manga.title}</h2>
                <p style={{ margin: 0, color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
                  {manga.description || 'Không có mô tả'}
                </p>
                <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
                  📚 {chapters.length} chương
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                padding: 10,
                background: '#0f0f1a',
                color: '#8ef',
                border: '1px solid rgba(136, 238, 255, 0.3)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
