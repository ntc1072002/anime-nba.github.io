import React, { useEffect, useState } from "react";
import { API_BASE } from "../config.js";
import firebaseClient from "../firebaseClient.js";

export default function Recommendations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        // Try to get Firebase ID token for personalized recommendations
        let idToken = null;
        try {
          idToken = await firebaseClient.getIdTokenForUser();
        } catch {
          // Silent fail — will serve public trending
        }

        const headers = idToken ? { Authorization: `Bearer ${idToken}` } : {};
        const url = `${API_BASE}/api/recommendations?limit=12`;
        
        const res = await fetch(url, { headers });
        const ct = res.headers.get("content-type") || "";
        
        if (!res.ok || !ct.includes("application/json")) {
          if (mounted) setItems([]);
          return;
        }
        
        const json = await res.json();
        if (mounted) {
          const recommended = Array.isArray(json.items) ? json.items : [];
          setItems(recommended);
        }
      } catch (err) {
        console.error("Fetch recommendations error:", err);
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

  if (loading) {
    return (
      <aside className="recommendations">
        <h2>ĐỀ CỬ CHO BẠN</h2>
        <div className="recommendations-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card loading">
              <div style={{ height: 180, marginBottom: 8, borderRadius: 6, background: "#1a1a2e" }} />
              <div style={{ height: 16, background: "rgba(255,255,255,0.1)", marginBottom: 6, borderRadius: 4 }} />
              <div style={{ height: 12, background: "rgba(255,255,255,0.08)", borderRadius: 4, width: "80%" }} />
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (items.length === 0) {
    return (
      <aside className="recommendations">
        <h2>ĐỀ CỬ CHO BẠN</h2>
        <div className="recommendations-empty">Chưa có dữ liệu</div>
      </aside>
    );
  }

  return (
    <aside className="recommendations">
      <h2>ĐỀ CỬ CHO BẠN</h2>
      <div className="recommendations-grid">
        {items.map((item) => {
          const href =
            item.type === "manga"
              ? `#/read/${item.id}`
              : `#/watch/${item.id}`;
          
          const metaText = item.genres && item.genres.length > 0 
            ? item.genres.slice(0, 2).join(", ")
            : (item.type === "manga" ? "Truyện" : "Anime");
          
          return (
            <a key={item.id} href={href} className="recommendation-item">
              <div className="recommendation-cover">
                {item.cover_url ? (
                  <img src={item.cover_url} alt={item.title} />
                ) : (
                  <div className="rec-cover-empty">No image</div>
                )}
              </div>
              <h4 className="recommendation-title">{item.title || "Không tên"}</h4>
              <p className="recommendation-meta">{metaText}</p>
            </a>
          );
        })}
      </div>
    </aside>
  );
}
