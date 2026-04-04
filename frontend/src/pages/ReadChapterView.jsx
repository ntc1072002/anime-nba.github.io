import React, { useEffect, useRef, useState } from "react";
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
  const [chaptersList, setChaptersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );
  const [controlVisible, setControlVisible] = useState(false);

  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const lastScrollTs = useRef(Date.now());

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
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (event) => {
      setIsMobileViewport(event.matches);
      setControlVisible(false);
      lastScrollY.current = window.scrollY || 0;
      lastScrollTs.current = Date.now();
    };

    setIsMobileViewport(mq.matches);
    setControlVisible(false);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      const now = Date.now();
      const dy = y - (lastScrollY.current || 0);
      const header = document.querySelector(".site-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : -1;
      const inTopZone = y <= 120 || headerBottom > 8;
      const revealThreshold = isMobileViewport ? -8 : -6;
      const hideThreshold = isMobileViewport ? 8 : 10;

      if (inTopZone) {
        setControlVisible(false);
        lastScrollY.current = y;
        lastScrollTs.current = now;
        return;
      }

      if (dy >= hideThreshold) {
        setControlVisible(false);
      } else if (dy <= revealThreshold) {
        setControlVisible(true);
      }

      lastScrollY.current = y;
      lastScrollTs.current = now;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [isMobileViewport]);

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
      <div className={`reader-control-bar ${isMobileViewport ? "mobile" : "desktop"} ${controlVisible ? "show" : ""}`}>
        <div className="reader-control-group">
          <a className="reader-ctrl-btn ghost" href="#/">
            Home
          </a>
          <button
            className="reader-ctrl-btn"
            disabled={!prevChapter}
            onClick={() => {
              if (prevChapter) window.location.hash = `#/read/${mangaId}/chapter/${prevChapter.id}`;
            }}
          >
            {"<"}
          </button>
        </div>

        <div className="reader-control-center">
          <select
            className="reader-ctrl-select"
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

        <div className="reader-control-group">
          <button
            className="reader-ctrl-btn"
            disabled={!nextChapter}
            onClick={() => {
              if (nextChapter) window.location.hash = `#/read/${mangaId}/chapter/${nextChapter.id}`;
            }}
          >
            {">"}
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
            <p>Khong co anh cho chuong nay.</p>
          </div>
        )}
      </div>
    </div>
  );
}
