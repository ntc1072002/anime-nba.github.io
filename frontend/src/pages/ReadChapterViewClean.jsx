import React, { useEffect, useState, useRef } from "react";
import { API_BASE } from '../config.js';

export default function ReadChapterView({ mangaId, chapterId }) {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chaptersList, setChaptersList] = useState([]);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState("single");
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/manga/${mangaId}/chapters/${chapterId}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setChapter(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    fetch(`${API_BASE}/api/manga/${mangaId}/chapters`)
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setChaptersList(d || []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [mangaId, chapterId]);

  // normalize images
  let imgs = [];
  if (chapter && chapter.images) {
    if (Array.isArray(chapter.images) && chapter.images.length && typeof chapter.images[0] === "string") {
      imgs = chapter.images.map((u, idx) => ({ order: idx + 1, url: u }));
    } else if (Array.isArray(chapter.images)) {
      imgs = chapter.images.map((i) => ({ order: i.order || 1, url: i.url }));
    }
  }
  imgs.sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (page >= imgs.length) setPage(0);
  }, [imgs.length]);

  const currentIndex = chaptersList.findIndex((c) => String(c.id) === String(chapterId));
  const prevChapter = currentIndex > -1 && currentIndex > 0 ? chaptersList[currentIndex - 1] : null;
  const nextChapter = currentIndex > -1 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

  // keyboard nav
  useEffect(() => {
    function onKey(e) {
      if (viewMode !== "single") return;
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPage((p) => Math.min(imgs.length - 1, p + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, imgs.length]);

  // floating nav show/hide on scroll
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      const delta = y - (lastScrollY.current || 0);
      if (delta > 10 && y > 120) setNavVisible(false);
      if (delta < -8) setNavVisible(true);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!chapter || chapter.error) return <div className="app-container"><div className="col">Không tìm thấy chương.</div></div>;

  return (
    <div className="app-container">
      <div className={`floating-nav ${navVisible ? "" : "hidden"}`}>
        <div className="left">
          <a className="nav-button secondary" href="#/">🏠</a>
          <button className="nav-button secondary" onClick={() => {}} aria-label="menu">☰</button>
          <button
            className="nav-button"
            onClick={() => {
              if (prevChapter) window.location.hash = `#/read/${mangaId}/chapter/${prevChapter.id}`;
            }}
            aria-label="prev"
          >
            ←
          </button>
        </div>
        <div className="center">
          <select
            className="nav-select"
            value={String(chapterId)}
            onChange={(e) => {
              const v = e.target.value;
              if (v) window.location.hash = `#/read/${mangaId}/chapter/${v}`;
            }}
          >
            {chaptersList.map((c) => (
              <option key={c.id} value={String(c.id)}>
                Chương {c.number}
                {c.title ? ` - ${c.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="right">
          <button
            className="nav-button"
            onClick={() => {
              if (nextChapter) window.location.hash = `#/read/${mangaId}/chapter/${nextChapter.id}`;
            }}
            aria-label="next"
          >
            →
          </button>
          <button className="btn-follow">Theo dõi</button>
        </div>
      </div>

      <div className="col">
        <h2 className="page-title">{chapter.title || `Chương ${chapter.number}`}</h2>

        <div className="card">
          {imgs.length ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <a className="breadcrumb" href="#/">Home</a> &nbsp;/&nbsp; <a className="breadcrumb" href={`#/read/${mangaId}`}>Manga</a> &nbsp;/&nbsp; <strong>Chương {chapter.number}</strong>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn secondary" onClick={() => setViewMode((m) => (m === "single" ? "continuous" : "single"))}>
                    {viewMode === "single" ? "Xem liên tục" : "Xem từng trang"}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      if (prevChapter) window.location.hash = `#/read/${mangaId}/chapter/${prevChapter.id}`;
                    }}
                    disabled={!prevChapter}
                  >
                    Prev chap
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      if (nextChapter) window.location.hash = `#/read/${mangaId}/chapter/${nextChapter.id}`;
                    }}
                    disabled={!nextChapter}
                  >
                    Next chap
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {/* continuous-only reader: render all images in order, with a small fade-in animation */}
                <div className="reader-continuous continuous-bleed">
                  {imgs.map((im, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <div style={{ marginBottom: 6, color: "var(--muted)" }}>Trang {im.order}</div>
                      <img className="reader-image img-fade" src={im.url} alt={`page-${im.order}`} style={{ width: "100%" }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p>Không có ảnh cho chương này.</p>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <a className="back-link" href={`#/read/${mangaId}`}>← Quay lại</a>
        </div>
      </div>
    </div>
  );
}
