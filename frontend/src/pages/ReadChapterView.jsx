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
  const [navVisible, setNavVisible] = useState(() =>
    typeof window !== "undefined" ? !window.matchMedia("(max-width: 900px)").matches : true
  );
  const [navStuck, setNavStuck] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );
  const [user, setUser] = useState(() => getUserFromToken());
  const [following, setFollowing] = useState(false);

  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const lastScrollTime = useRef(Date.now());
  const upwardDuration = useRef(0);
  const upwardDistance = useRef(0);
  const lastDirection = useRef("idle");
  const navRef = useRef(null);
  const navInitTop = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch(`${API_BASE}/api/manga/${mangaId}/chapters/${chapterId}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setChapter(data);
      })
      .catch(() => {
        if (mounted) setChapter(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    fetch(`${API_BASE}/api/manga/${mangaId}/chapters`)
      .then((r) => r.json())
      .then((items) => {
        if (mounted) setChaptersList(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (mounted) setChaptersList([]);
      });

    fetch(`${API_BASE}/api/manga/${mangaId}`)
      .then((r) => r.json())
      .then((item) => {
        if (mounted) setManga(item || null);
      })
      .catch(() => {
        if (mounted) setManga(null);
      });

    navInitTop.current = null;
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
        setFollowing(!!current);
      })
      .catch(() => {
        if (mounted) setFollowing(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, mangaId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (event) => {
      setIsMobileViewport(event.matches);
      setNavVisible(!event.matches);
      navInitTop.current = null;
      upwardDuration.current = 0;
      upwardDistance.current = 0;
      lastDirection.current = "idle";
      lastScrollY.current = window.scrollY || 0;
      lastScrollTime.current = Date.now();
    };

    setIsMobileViewport(mq.matches);
    setNavVisible(!mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    function resetUpwardIntent() {
      upwardDuration.current = 0;
      upwardDistance.current = 0;
      lastDirection.current = "idle";
    }

    function onScroll() {
      const y = window.scrollY || 0;
      const now = Date.now();
      const delta = y - (lastScrollY.current || 0);

      if (isMobileViewport) {
        const header = document.querySelector(".site-header");
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const headerHidden = headerBottom <= 8;
        const dt = Math.min(500, Math.max(0, now - (lastScrollTime.current || now)));
        const pauseTooLong = now - (lastScrollTime.current || now) > 2200;

        if (y <= 80 || !headerHidden) {
          resetUpwardIntent();
          setNavVisible(false);
          setNavStuck(false);
          lastScrollY.current = y;
          lastScrollTime.current = now;
          return;
        }

        if (delta < -1) {
          if (pauseTooLong || lastDirection.current !== "up") {
            upwardDuration.current = 0;
            upwardDistance.current = 0;
          }
          upwardDuration.current += dt;
          upwardDistance.current += Math.abs(delta);
          lastDirection.current = "up";
          if (upwardDuration.current >= 2000 || upwardDistance.current >= 120) {
            setNavVisible(true);
          }
        } else if (delta > 2) {
          resetUpwardIntent();
          lastDirection.current = "down";
          setNavVisible(false);
        } else if (pauseTooLong) {
          resetUpwardIntent();
        }

        setNavStuck(false);
        lastScrollY.current = y;
        lastScrollTime.current = now;
        return;
      }

      const header = document.querySelector(".site-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const inHeaderZone = y <= 120 || headerBottom > 8;

      if (inHeaderZone) {
        setNavVisible(false);
        setNavStuck(false);
        lastScrollY.current = y;
        lastScrollTime.current = now;
        return;
      }

      setNavVisible((prev) => {
        if (delta > 10) return false;
        if (delta < -6) return true;
        return prev;
      });

      if (navRef.current && navInitTop.current == null) {
        const rectTop = navRef.current.getBoundingClientRect().top;
        navInitTop.current = window.scrollY + rectTop;
      }

      if (navInitTop.current != null) {
        const shouldStuck = y >= Math.max(0, navInitTop.current - 2);
        setNavStuck((prev) => (prev === shouldStuck ? prev : shouldStuck));
      }

      lastScrollY.current = y;
      lastScrollTime.current = now;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobileViewport]);

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
  const nextChapter =
    currentIndex > -1 && currentIndex < chaptersList.length - 1 ? chaptersList[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="app-container">
        <div className="col">Dang tai...</div>
      </div>
    );
  }

  if (!chapter || chapter.error) {
    return (
      <div className="app-container">
        <div className="col">Khong tim thay chuong.</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div
        ref={navRef}
        className={`floating-nav ${isMobileViewport ? "floating-nav-mobile" : ""} ${navVisible ? "" : "hidden"} ${
          !isMobileViewport && navStuck ? "stuck" : ""
        }`}
      >
        <div className="left">
          <a className="nav-button secondary" href={`#/read/${mangaId}`} aria-label="Danh sach chuong">
            M
          </a>
          <button
            className="nav-button"
            disabled={!prevChapter}
            onClick={() => {
              if (prevChapter) window.location.hash = `#/read/${mangaId}/chapter/${prevChapter.id}`;
            }}
            aria-label="Chuong truoc"
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
                Chuong {c.number}
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
            aria-label="Chuong sau"
          >
            {">"}
          </button>
          <button className={`btn-follow ${following ? "active" : ""}`} onClick={toggleFollow}>
            {user ? (following ? "Dang theo doi" : "Theo doi") : "Dang nhap"}
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
                <strong>Chuong {chapter.number}</strong>
              </div>
              <div className="reader-top-actions">
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

            <div className="continuous-bleed reader-continuous reader-content" style={{ marginTop: 12 }}>
              {images.map((image, index) => (
                <div key={index} style={{ marginBottom: 0 }}>
                  <img src={image.url} alt={`page-${image.order}`} style={{ width: "100%", display: "block" }} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card">
            <p>Khong co anh cho chuong nay.</p>
          </div>
        )}
      </div>
    </div>
  );
}
