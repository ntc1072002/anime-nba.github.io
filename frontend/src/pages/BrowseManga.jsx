import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config.js";

const BROWSE_LIMIT = 50;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return 0;
}

function formatRelative(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return "vừa xong";
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const month = Math.floor(days / 30);
  if (month < 12) return `${month} tháng trước`;
  const year = Math.floor(month / 12);
  return `${year} năm trước`;
}

function pickGenres(item) {
  const out = [];
  if (Array.isArray(item?.genres)) out.push(...item.genres);
  if (Array.isArray(item?.tags)) out.push(...item.tags);
  if (typeof item?.genre === "string") out.push(...item.genre.split(","));
  if (typeof item?.tags === "string") out.push(...item.tags.split(","));
  return Array.from(new Set(out.map((v) => String(v || "").trim()).filter(Boolean)));
}

async function fetchJson(url) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.includes("application/json")) return [];
  return res.json();
}

function enrichItem(base, detailItems) {
  const sortedAsc = [...(detailItems || [])].sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0));
  const sortedDesc = [...sortedAsc].reverse();
  const firstItem = sortedAsc[0] || null;
  const latestAt = sortedDesc[0] ? Math.max(toMillis(sortedDesc[0].updated_at), toMillis(sortedDesc[0].created_at)) : 0;
  const rows = sortedDesc.slice(0, 2).map((entry) => {
    const left = `Chapter ${entry?.number ?? "?"}`;
    const right = formatRelative(Math.max(toMillis(entry?.updated_at), toMillis(entry?.created_at)));
    return { left, right };
  });

  const primaryHref = `#/read/${base.id}`;

  return {
    ...base,
    genres: pickGenres(base),
    detailCount: sortedAsc.length,
    latestAt,
    rows,
    primaryHref
  };
}

export default function BrowseManga() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState("all");
  const [sortBy, setSortBy] = useState("latest");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const listUrl = `${API_BASE}/api/manga`;
        const list = await fetchJson(listUrl);
        const base = Array.isArray(list) ? list : [];
        const preSorted = [...base].sort((a, b) => {
          const aScore = Math.max(toMillis(a?.updated_at), toMillis(a?.created_at));
          const bScore = Math.max(toMillis(b?.updated_at), toMillis(b?.created_at));
          return bScore - aScore;
        });
        const detailTargets = preSorted.slice(0, BROWSE_LIMIT);

        const detailPairs = await Promise.all(
          detailTargets.map(async (item) => {
            try {
              const detailUrl = `${API_BASE}/api/manga/${item.id}/chapters`;
              const detailItems = await fetchJson(detailUrl);
              return [String(item.id), Array.isArray(detailItems) ? detailItems : []];
            } catch {
              return [String(item.id), []];
            }
          })
        );

        const detailMap = new Map(detailPairs);
        const enriched = preSorted.map((item) => enrichItem(item, detailMap.get(String(item.id)) || []));
        if (mounted) setItems(enriched);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const genres = useMemo(() => {
    const values = new Set();
    items.forEach((item) => item.genres?.forEach((g) => values.add(g)));
    return Array.from(values).slice(0, 50);
  }, [items]);

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      if (genre === "all") return true;
      return item.genres?.includes(genre);
    });

    if (sortBy === "name") {
      return next.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "vi"));
    }

    return next.sort((a, b) => {
      const aScore = Math.max(a.latestAt || 0, toMillis(a.updated_at), toMillis(a.created_at));
      const bScore = Math.max(b.latestAt || 0, toMillis(b.updated_at), toMillis(b.created_at));
      return bScore - aScore;
    });
  }, [items, genre, sortBy]);

  return (
    <main className="app-container">
      <div className="browse-page">
        <div className="home-browse-links">
          <a href="#/manga" className="browse-link-btn active">📚 Truyện</a>
          <a href="#/anime" className="browse-link-btn">🎬 Anime</a>
        </div>
        <h1 className="page-title">TRUYỆN</h1>
        
        <div className="browse-filters">
          <div className="filter-group">
            <label>Thể loại:</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
              <option value="all">Tất cả</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Sắp xếp:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
              <option value="latest">Cập nhật mới</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="browse-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="media-card">
                <div className="media-skeleton-card">
                  <div className="media-skeleton-cover" />
                  <div className="media-skeleton-line long" />
                  <div className="media-skeleton-line medium" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-block">Chưa có truyện nào.</div>
        ) : (
          <div className="browse-grid">
            {filteredItems.map((item) => {
              const firstRow = item.rows?.[0];
              return (
                <a key={item.id} href={item.primaryHref} className="browse-card">
                  <div className="browse-poster">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt={item.title} />
                    ) : (
                      <div className="browse-poster-empty">No image</div>
                    )}
                  </div>
                  <h3 className="browse-title">{item.title || "Không tên"}</h3>
                  <div className="browse-meta">
                    <span>{firstRow?.left || `${item.detailCount || 0} Chapter`}</span>
                    <span className="browse-time">{firstRow?.right || "Chưa rõ"}</span>
                  </div>
                  <p className="browse-genres">
                    {item.genres && item.genres.length > 0
                      ? item.genres.slice(0, 3).join(", ")
                      : "Không có thể loại"}
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
