import React, { useEffect, useRef, useState } from "react";
import { authFetch, getUserFromToken } from "../utils/auth.js";
import { API_BASE } from "../config.js";

function normalizeImageUrl(value) {
  if (!value) return value;
  try {
    const url = String(value).trim();
    const gdrive = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
    if (gdrive) {
      const id = gdrive[1] || gdrive[2];
      return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    if (url.includes("dropbox.com")) {
      return url.replace(/\?dl=0$/, "?raw=1").replace(/\?dl=1$/, "?raw=1");
    }
    const imgur = url.match(/i?\.imgur\.com\/(.+?)(?:$|\.)/);
    if (imgur && !/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) {
      return `https://i.imgur.com/${imgur[1]}.jpg`;
    }
    return url;
  } catch {
    return value;
  }
}

export default function ReadChapterView({ mangaId, chapterId }) {
  const [chapter, setChapter] = useState(null);
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chaptersList, setChaptersList] = useState([]);
  const [user, setUser] = useState(() => getUserFromToken());
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [navAtHeader, setNavAtHeader] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  const upwardRevealPx = useRef(0);
  const topRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch(`${API_BASE}/api/manga/${mangaId}/chapters/${chapterId}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/manga/${mangaId}/chapters`).then((r) => r.json()),
      fetch(`${API_BASE}/api/manga/${mangaId}`).then((r) => r.json())
    ])
      .then(([chapterData, chapterList, mangaData]) => {
        if (!mounted) return;
        setChapter(chapterData || null);
        setChaptersList(Array.isArray(chapterList) ? chapterList : []);
        setManga(mangaData || null);
      })
      .catch(() => {
        if (!mounted) return;
        setChapter(null);
        setChaptersList([]);
        setManga(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [mangaId, chapterId]);

  useEffect(() => {
    function syncUser() {
      setUser(getUserFromToken());
    }
    syncUser();
    window.addEventListener("hashchange", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("hashchange", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setFollowing(false);
      setLiked(false);
      return () => {
        mounted = false;
      };
    }

    authFetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const current = (data.follows || []).some(
          (x) => x.type === "manga" && String(x.target_id) === String(mangaId)
        );
        const likedCurrent = (data.likes || []).some(
          (x) => x.type === "manga" && String(x.target_id) === String(mangaId)
        );
        setFollowing(!!current);
        setLiked(!!likedCurrent);
      })
      .catch(() => {
        if (mounted) setFollowing(false);
        if (mounted) setLiked(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, mangaId]);

  useEffect(() => {
    setNavVisible(false);
    setNavAtHeader(false);
    upwardRevealPx.current = 0;
    lastScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
  }, [mangaId, chapterId]);

  // Keyboard navigation for chapter and scroll
  useEffect(() => {
    const currentIndex = chaptersList.findIndex((c) => String(c.id) === String(chapterId));
    const prevChap = currentIndex > 0 ? chaptersList[currentIndex - 1] : null;
    const nextChap = currentIndex > -1 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft' && prevChap) {
        window.location.hash = `#/read/${mangaId}/chapter/${prevChap.id}`;
      } else if (e.key === 'ArrowRight' && nextChap) {
        window.location.hash = `#/read/${mangaId}/chapter/${nextChap.id}`;
      } else if (e.key === 'ArrowUp') {
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
  }, [mangaId, chapterId, chaptersList]);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      const delta = y - (lastScrollY.current || 0);
      const header = document.querySelector(".site-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const mainHeaderVisible = headerBottom > 8 || y <= 80;

      if (mainHeaderVisible) {
        setNavVisible(false);
        setNavAtHeader(false);
        upwardRevealPx.current = 0;
      } else {
        setNavAtHeader(true);

        // Keep toolbar fixed once shown, until the main header appears again.
        if (!navVisible) {
          if (delta < -2) {
            upwardRevealPx.current += Math.abs(delta);
            if (upwardRevealPx.current >= 48) setNavVisible(true);
          } else if (delta > 2) {
            upwardRevealPx.current = 0;
          }
        }
      }
      setShowScrollTop(y > 300);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [navVisible]);

  async function toggleFollow() {
    if (!user) {
      window.location.hash = "#/auth";
      return;
    }
    try {
      const res = await authFetch("/api/me/follow", {
        method: "POST",
        body: JSON.stringify({ type: "manga", targetId: mangaId })
      });
      const data = await res.json();
      if (res.ok) setFollowing(!!data.following);
    } catch {}
  }

  async function toggleLike() {
    if (!user) {
      window.location.hash = "#/auth";
      return;
    }
    try {
      const res = await authFetch("/api/me/like", {
        method: "POST",
        body: JSON.stringify({ type: "manga", targetId: mangaId })
      });
      const data = await res.json();
      if (res.ok) setLiked(!!data.liked);
    } catch {}
  }

  let images = [];
  if (chapter?.images) {
    if (Array.isArray(chapter.images) && chapter.images.length && typeof chapter.images[0] === "string") {
      images = chapter.images.map((url, index) => ({ order: index + 1, url }));
    } else if (Array.isArray(chapter.images)) {
      images = chapter.images.map((item) => ({ order: item.order || 1, url: item.url }));
    }
  }
  images = images
    .map((item) => ({ ...item, url: normalizeImageUrl(item.url) }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const currentIndex = chaptersList.findIndex((c) => String(c.id) === String(chapterId));
  const prevChapter = currentIndex > 0 ? chaptersList[currentIndex - 1] : null;
  const nextChapter = currentIndex > -1 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="app-container">
        <div className="col">Đang tải...</div>
      </div>
    );
  }

  if (!chapter || chapter.error) {
    return (
      <div className="app-container">
        <div className="col">Không tìm thấy chapter.</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div ref={topRef} style={{ height: 0 }} />
      <div className={`floating-nav ${navVisible ? "" : "hidden"} ${navAtHeader ? "stuck" : ""}`}>
        <div className="left">
          <a className="nav-button secondary" href={`#/read/${mangaId}`} aria-label="Danh sách chương">
            M
          </a>
          <button
            className="nav-button"
            disabled={!prevChapter}
            onClick={() => {
              if (prevChapter) window.location.hash = `#/read/${mangaId}/chapter/${prevChapter.id}`;
            }}
            aria-label="Chương trước"
          >
            {"<"}
          </button>
        </div>

        <div className="center">
          <select
            className="nav-select"
            value={String(chapterId)}
            onChange={(e) => {
              const value = e.target.value;
              if (value) window.location.hash = `#/read/${mangaId}/chapter/${value}`;
            }}
          >
            {chaptersList.map((c) => (
              <option key={c.id} value={String(c.id)}>
                Chapter {c.number}
                {c.title ? ` - ${c.title}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="right">
          <button
            className="nav-button"
            disabled={!nextChapter}
            onClick={() => {
              if (nextChapter) window.location.hash = `#/read/${mangaId}/chapter/${nextChapter.id}`;
            }}
            aria-label="Chương sau"
          >
            {">"}
          </button>
          <button className={`btn-follow ${following ? "active" : ""}`} onClick={toggleFollow}>
            {user ? (following ? "Đang theo dõi" : "Theo dõi") : "Đăng nhập"}
          </button>
        </div>
      </div>

      <div className="col">
        {images.length ? (
          <>
            <div className="reader-top-controls">
              <div className="reader-path">
                <a className="breadcrumb" href="#/">
                  Home
                </a>
                {" / "}
                <a className="breadcrumb" href={`#/read/${mangaId}`}>
                  {manga?.title || "Manga"}
                </a>
                {" / "}
                <strong>Chapter {chapter.number}</strong>
              </div>
              <div className="reader-top-actions">
                <button className={`reader-mini-action follow ${following ? "active" : ""}`} onClick={toggleFollow}>
                  <span aria-hidden="true">+</span> Theo doi
                </button>
                <button
                  className={`reader-mini-action like ${liked ? "active" : ""}`}
                  onClick={toggleLike}
                  aria-label="Yeu thich"
                >
                  <span aria-hidden="true">{liked ? "❤" : "♡"}</span>
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

            <div className="continuous-bleed reader-continuous" style={{ marginTop: 12 }}>
              {images.map((image, index) => (
                <div key={index} style={{ marginBottom: 0 }}>
                  <img src={image.url} alt={`page-${image.order}`} style={{ width: "100%", display: "block" }} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card">
            <p>Không có ảnh cho chapter này.</p>
          </div>
        )}
      </div>

      {/* Scroll to top button */}
      <button
        onClick={() => topRef.current?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: 'rgba(95, 183, 247, 0.9)',
          border: 'none',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(95, 183, 247, 0.3)',
          transition: 'all 0.3s ease',
          zIndex: 100
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = 'rgba(95, 183, 247, 1)';
          e.target.style.boxShadow = '0 6px 16px rgba(95, 183, 247, 0.5)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = 'rgba(95, 183, 247, 0.9)';
          e.target.style.boxShadow = '0 4px 12px rgba(95, 183, 247, 0.3)';
          e.target.style.transform = 'scale(1)';
        }}
        aria-label="Scroll to top"
      >
        ⬆
      </button>
    </div>
  );
}
