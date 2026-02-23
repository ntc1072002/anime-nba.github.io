import React, { useEffect, useState, useRef } from "react";
import { authFetch, getUserFromToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default function ReadChapterView({ mangaId, chapterId }) {
  const [chapter, setChapter] = useState(null);
  const [manga, setManga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chaptersList, setChaptersList] = useState([]);
  // Reader is fixed to continuous mode only
  const [navVisible, setNavVisible] = useState(true);
  const [navStuck, setNavStuck] = useState(false);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const navRef = useRef(null);
  const navInitTop = useRef(null);

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

    // fetch manga details so we can show poster/cover
    fetch(`${API_BASE}/api/manga/${mangaId}`)
      .then((r) => r.json())
      .then((m) => {
        if (mounted) setManga(m);
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

  // helper to normalize common remote-hosted links so <img> can render them
  function normalizeImageUrl(u) {
    if (!u) return u;
    try {
      const url = String(u).trim();
      // Google Drive file links -> direct preview
      const gdrive = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
      if (gdrive) {
        const id = gdrive[1] || gdrive[2];
        return `https://drive.google.com/uc?export=view&id=${id}`;
      }
      // Dropbox share -> force raw
      if (url.includes('dropbox.com')) {
        return url.replace(/\?dl=0$/, '?raw=1').replace(/\?dl=1$/, '?raw=1');
      }
      // Imgur page link without extension -> append .jpg
      const imgur = url.match(/i?\.imgur\.com\/(.+?)(?:$|\.)/);
      if (imgur && !/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url)) {
        return `https://i.imgur.com/${imgur[1]}.jpg`;
      }
      return url;
    } catch (e) {
      return u;
    }
  }

  // apply normalization
  imgs = imgs.map((i) => ({ ...i, url: normalizeImageUrl(i.url) }));

  const posterUrl = normalizeImageUrl(
    (manga && (manga.cover_url || manga.poster || manga.cover || manga.thumbnail)) ||
      (chapter && (chapter.cover_url || chapter.poster || chapter.cover || chapter.thumbnail)) ||
      null
  );

  // no page state in continuous-only reader

  const currentIndex = chaptersList.findIndex((c) => String(c.id) === String(chapterId));
  const prevChapter = currentIndex > -1 && currentIndex > 0 ? chaptersList[currentIndex - 1] : null;
  const nextChapter = currentIndex > -1 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

  // keyboard navigation removed for continuous-only reader

  // floating nav show/hide on scroll
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      const delta = y - (lastScrollY.current || 0);

      // hide/show behavior
      if (delta > 10 && y > 120) setNavVisible(false);
      if (delta < -8) setNavVisible(true);

      // compute sticky behavior: when we've scrolled past the nav's initial top position
      if (navRef.current && navInitTop.current == null) {
        // get starting position of the nav relative to document
        const rectTop = navRef.current.getBoundingClientRect().top;
        navInitTop.current = window.scrollY + rectTop;
      }
      if (navInitTop.current != null) {
        // when scrolled past the nav's initial position, mark as stuck
        const shouldStuck = y >= Math.max(0, navInitTop.current - 2);
        if (shouldStuck !== navStuck) setNavStuck(shouldStuck);
      }

      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // run once to initialize
    setTimeout(() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('scroll')); }, 50);
    return () => window.removeEventListener("scroll", onScroll);
  }, [navStuck]);

  if (loading) return <div className="app-container"><div className="col">Đang tải...</div></div>;
  if (!chapter || chapter.error) return <div className="app-container"><div className="col">Không tìm thấy chương.</div></div>;

  return (
    <div className="app-container">
      <div ref={navRef} className={`floating-nav ${navVisible ? "" : "hidden"} ${navStuck ? 'stuck' : ''}`}>
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
        {/* <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {posterUrl ? (
            <div style={{ flex: '0 0 auto' }}>
              <img src={posterUrl} alt="poster" style={{ width: 120, height: 'auto', borderRadius: 6 }} />
            </div>
          ) : null}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 className="page-title" style={{ margin: 0 }}>{chapter.title || `Chương ${chapter.number}`}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <FollowLikeControls mangaId={mangaId} />
              </div>
            </div>
            {manga && manga.title ? <div className="muted">{manga.title}</div> : null}
          </div>
        </div> */}

        {imgs.length ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <a className="breadcrumb" href="#/">Home</a> &nbsp;/&nbsp; <a className="breadcrumb" href={`#/read/${mangaId}`}>Manga</a> &nbsp;/&nbsp; <strong>Chương {chapter.number}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
              {imgs.map((im, idx) => (
                <div key={idx} style={{ marginBottom: 0 }}>
                  <img src={im.url} alt={`page-${im.order}`} style={{ width: "100%", display: 'block' }} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card"><p>Không có ảnh cho chương này.</p></div>
        )}

        
      </div>
    </div>
  );
}

  function FollowLikeControls({ mangaId }) {
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
          const f = (data.follows || []).some(x => x.type === 'manga' && String(x.target_id) === String(mangaId));
          const l = (data.likes || []).some(x => x.type === 'manga' && String(x.target_id) === String(mangaId));
          setFollowing(!!f);
          setLiked(!!l);
        }).catch(()=>{});
      }
      return () => { mounted = false; };
    }, [mangaId]);

    async function toggleFollow() {
      if (!user) return window.location.hash = '#/auth';
      try {
  const res = await authFetch('/api/me/follow', { method: 'POST', body: JSON.stringify({ type: 'manga', targetId: mangaId }) });
        const j = await res.json();
        if (res.ok) setFollowing(!!j.following);
      } catch (e) {}
    }

    async function toggleLike() {
      if (!user) return window.location.hash = '#/auth';
      try {
  const res = await authFetch('/api/me/like', { method: 'POST', body: JSON.stringify({ type: 'manga', targetId: mangaId }) });
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
