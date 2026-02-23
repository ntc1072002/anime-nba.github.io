import React, { useEffect, useState } from "react";
import Read from "./Read.jsx";
import Watch from "./Watch.jsx";
import { API_BASE } from '../config.js';

export default function Home() {
  const [manga, setManga] = useState([]);
  const [anime, setAnime] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJson(url, setter) {
      try {
        const res = await fetch(url);
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text();
          console.error(`Request failed ${url} -> ${res.status}\n`, text.slice(0, 500));
          setter([]);
          return;
        }
        if (!ct.includes("application/json")) {
          const text = await res.text();
          console.error(`Expected JSON from ${url} but got ${ct || 'no content-type'}:\n`, text.slice(0, 500));
          setter([]);
          return;
        }
        const json = await res.json();
        setter(json);
      } catch (err) {
        console.error(`Fetch ${url} error:`, err);
        setter([]);
      }
    }

    Promise.all([
      fetchJson(`${API_BASE}/api/manga`, setManga),
      fetchJson(`${API_BASE}/api/anime`, setAnime)
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <main className="app-container">
      <div className="layout">
        <Read data={manga} loading={loading} />
        <Watch data={anime} loading={loading} />
      </div>
    </main>
  );
}
