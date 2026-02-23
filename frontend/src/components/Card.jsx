import React from "react";

// Card nhỏ dùng để hiển thị item (có thể có ảnh bìa)
export default function Card({ title, children, cover }) {
  return (
    <article className="card">
      <div style={{ marginBottom: 8, width: '100%', height: 180, borderRadius: 6, background: cover ? 'transparent' : '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {cover ? (
          <img src={cover} alt={typeof title === 'string' ? title : 'cover'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>
            <div style={{ marginBottom: 6 }}>📷</div>
            <div>Chưa có ảnh</div>
          </div>
        )}
      </div>
      <h3 style={{ marginTop: 8 }}>{title}</h3>
      <div>{children}</div>
    </article>
  );
}
