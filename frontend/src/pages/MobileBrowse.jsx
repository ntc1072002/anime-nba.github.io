import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config.js";

const MOBILE_LIMIT = 30;

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

function enrichItem(base, detailItems, isManga) {
  const sortedAsc = [...(detailItems || [])].sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0));
  const sortedDesc = [...sortedAsc].reverse();
  const firstItem = sortedAsc[0] || null;
  const latestAt = sortedDesc[0] ? Math.max(toMillis(sortedDesc[0].updated_at), toMillis(sortedDesc[0].created_at)) : 0;
  const rows = sortedDesc.slice(0, 3).map((entry) => {
    const left = `${isManga ? "Chapter" : "Tập"} ${entry?.number ?? "?"}`;
    const right = formatRelative(Math.max(toMillis(entry?.updated_at), toMillis(entry?.created_at)));
    return { left, right };
  });

  const primaryHref = isManga
    ? firstItem
      ? `#/read/${base.id}/chapter/${firstItem.id}`
      : `#/read/${base.id}`
    : firstItem
    ? `#/watch/${base.id}/episodes/${firstItem.id}`
    : `#/watch/${base.id}`;

  return {
    ...base,
    genres: pickGenres(base),
    detailCount: sortedAsc.length,
    latestAt,
    rows,
    primaryHref
  };
}

export default function MobileBrowse({ type = "manga" }) {
  const isManga = type !== "anime";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState("all");
  const [sortBy, setSortBy] = useState("latest");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const listUrl = isManga ? `${API_BASE}/api/manga` : `${API_BASE}/api/anime`;
        const list = await fetchJson(listUrl);
        const base = Array.isArray(list) ? list : [];
        const preSorted = [...base].sort((a, b) => {
          const aScore = Math.max(toMillis(a?.updated_at), toMillis(a?.created_at));
          const bScore = Math.max(toMillis(b?.updated_at), toMillis(b?.created_at));
          return bScore - aScore;
        });
        const detailTargets = preSorted.slice(0, MOBILE_LIMIT);

        const detailPairs = await Promise.all(
          detailTargets.map(async (item) => {
            try {
              const detailUrl = isManga
                ? `${API_BASE}/api/manga/${item.id}/chapters`
                : `${API_BASE}/api/anime/${item.id}/episodes`;
              const detailItems = await fetchJson(detailUrl);
              return [String(item.id), Array.isArray(detailItems) ? detailItems : []];
            } catch {
              return [String(item.id), []];
            }
          })
        );

        const detailMap = new Map(detailPairs);
        const enriched = preSorted.map((item) => enrichItem(item, detailMap.get(String(item.id)) || [], isManga));
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
  }, [isManga]);

  const genres = useMemo(() => {
    const values = new Set();
    items.forEach((item) => item.genres?.forEach((g) => values.add(g)));
    return Array.from(values).slice(0, 30);
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

  const featured = filteredItems.slice(0, 6);

  return (
    <main className="app-container mobile-browse">
      <div className="mobile-switch">
        <a href="#/manga" className={`mobile-switch-btn ${isManga ? "active" : ""}`}>
          Truyện
        </a>
        <a href="#/anime" className={`mobile-switch-btn ${!isManga ? "active" : ""}`}>
          Anime
        </a>
      </div>

      <section className="mobile-highlight">
        <div className="mobile-highlight-title">
          {isManga ? "TRUYỆN ĐỀ CỬ" : "ANIME ĐỀ CỬ"} <span aria-hidden="true">›</span>
        </div>
        {loading ? (
          <div className="mobile-highlight-row">
            {[1, 2].map((i) => (
              <div key={i} className="mobile-highlight-card loading">
                <div className="mobile-highlight-poster" />
                <div className="mobile-line long" />
                <div className="mobile-line short" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="mobile-empty">Chưa có dữ liệu.</div>
        ) : (
          <div className="mobile-highlight-row">
            {featured.map((item) => {
              const firstRow = item.rows?.[0];
              return (
                <a key={item.id} href={item.primaryHref} className="mobile-highlight-card">
                  <div className="mobile-highlight-poster">
                    {item.cover_url ? <img src={item.cover_url} alt={item.title} /> : <div className="mobile-cover-empty">No image</div>}
                  </div>
                  <h3>{item.title || "Không tên"}</h3>
                  <div className="mobile-highlight-meta">
                    <span>{firstRow?.left || `${item.detailCount || 0} ${isManga ? "Chapter" : "Tập"}`}</span>
                    <span>{firstRow?.right || ""}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="mobile-filter">
        <label>
          The loai
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="all">Tat ca</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sap xep theo
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="latest">Thoi gian dang</option>
            <option value="name">Ten A-Z</option>
          </select>
        </label>
      </section>

      <section className="mobile-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="mobile-grid-card loading">
              <div className="mobile-grid-poster" />
              <div className="mobile-line long" />
              <div className="mobile-line short" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="mobile-empty full">Khong tim thay noi dung phu hop.</div>
        ) : (
          filteredItems.map((item) => (
            <a key={item.id} href={item.primaryHref} className="mobile-grid-card">
              <div className="mobile-grid-poster">
                {item.cover_url ? <img src={item.cover_url} alt={item.title} /> : <div className="mobile-cover-empty">No image</div>}
              </div>
              <h4>{item.title || "Khong ten"}</h4>
              <div className="mobile-update-list">
                {(item.rows?.length ? item.rows : [{ left: item.detailCount ? `${item.detailCount} ${isManga ? "chapter" : "tap"}` : "Chua co", right: "" }]).map(
                  (row, idx) => (
                    <div key={`${item.id}-row-${idx}`} className="mobile-update-row">
                      <span>{row.left}</span>
                      <span>{row.right}</span>
                    </div>
                  )
                )}
              </div>
            </a>
          ))
        )}
      </section>
    </main>
  );
}
