import React, { useEffect, useState } from "react";
import { API_BASE } from '../config.js';

export default function Watch({ data = [], loading = false }) {
  return (
    <div className="col right">
      <h2 className="page-title">🎬 Xem anime</h2>

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
        <p style={{ textAlign: 'center', color: '#666' }}>Chưa có anime nào</p>
      ) : (
        data.map(a => (
          <AnimeCard key={a.id} anime={a} />
        ))
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
      .then(r => r.json())
      .then(data => setEpisodes(data || []))
      .catch(err => {
        console.error('Fetch episodes error:', err);
        setEpisodes([]);
      })
      .finally(() => setLoadingEpisodes(false));
  }, [anime.id]);

  // Truncate description  
  const maxDescLength = 150;
  const isTruncated = anime.description && anime.description.length > maxDescLength;
  const truncatedDesc = isTruncated ? anime.description.substring(0, maxDescLength) + '...' : anime.description || 'Chưa có mô tả';

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
            {anime.cover_url ? (
              <img src={anime.cover_url} alt={anime.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12, textAlign: 'center', padding: 8 }}>
                📷<br />Chưa có ảnh
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>
              <a href={`#/watch/${anime.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {anime.title}
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
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                🎬 {episodes.length} tập
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
                      e.target.style.background = '#1a3a3a';
                      e.target.style.borderColor = 'rgba(136, 238, 255, 0.5)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.background = '#0f0f1a';
                      e.target.style.borderColor = 'rgba(136, 238, 255, 0.3)';
                    }}
                  >
                    Chi tiết
                  </button>
                )}
                <a
                  href={`#/watch/${anime.id}`}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#0f3f0f',
                    color: '#8f8',
                    border: '1px solid rgba(136, 238, 136, 0.3)',
                    borderRadius: 4,
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: 12,
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.style.background = '#1a5a1a';
                    e.style.borderColor = 'rgba(136, 238, 136, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.style.background = '#0f3f0f';
                    e.style.borderColor = 'rgba(136, 238, 136, 0.3)';
                  }}
                >
                  ▶ Xem Phim
                </a>
              </div>
            </div>
          </div>
        </div>


        {/* Episodes List */}
        {loadingEpisodes ? (
          <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
            Đang tải tập...
          </div>
        ) : episodes.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
            Chưa có tập nào
          </div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {episodes.slice(0, 6).map(ep => (
              <a
                key={ep.id}
                href={`#/watch/${anime.id}/episode/${ep.id}`}
                // href={`#/watch/${id}/episode/${ep.id}`}
                // onClick={e => { e.preventDefault(); setCurrentEpisode(ep.id); }}
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
                  e.target.style.background = '#1a3a3a';
                  e.target.style.borderColor = 'rgba(136, 238, 255, 0.5)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = '#0f0f1a';
                  e.target.style.borderColor = 'rgba(136, 238, 255, 0.2)';
                }}
              >
                Tập {ep.number}
              </a>
            ))}
            {episodes.length > 6 && (
              <a
                href={`#/watch/${anime.id}`}
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
                +{episodes.length - 6} tập khác
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
                src={anime.cover_url}
                alt={anime.title}
                style={{ width: 120, height: 160, borderRadius: 6, objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 8px 0', color: '#fff' }}>{anime.title}</h2>
                <p style={{ margin: 0, color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
                  {anime.description || 'Không có mô tả'}
                </p>
                <p style={{ margin: 0, color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
                  🎬 {episodes.length} tập
                </p>
                <a
                  href={`#/watch/${anime.id}`}
                  style={{
                    display: 'inline-block',
                    marginTop: 12,
                    padding: '8px 16px',
                    background: '#0f3f0f',
                    color: '#8f8',
                    border: '1px solid rgba(136, 238, 136, 0.3)',
                    borderRadius: 4,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                  onMouseEnter={e => {
                    e.style.background = '#1a5a1a';
                    e.style.borderColor = 'rgba(136, 238, 136, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.style.background = '#0f3f0f';
                    e.style.borderColor = 'rgba(136, 238, 136, 0.3)';
                  }}
                >
                  ▶ Xem phim
                </a>
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
