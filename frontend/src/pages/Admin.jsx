import React, { useState } from "react";
import { authFetch, getUserFromToken, getToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

export default function Admin() {
  const [tab, setTab] = useState('content');
  const [type, setType] = useState("manga");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    try {
      const payload = type === "manga" ? { title, description } : { title, embed_url: embedUrl };
      const res = await authFetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus({ ok: true, msg: `${type} added (id: ${data.id})` });
      // if cover file provided, upload it
      if (coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', coverFile);
          const uploadUrl = `${API_BASE}/api/${type}/${data.id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Upload failed');
        } catch (err) {
          console.error('Cover upload error', err);
        }
      }
      // reset form
      setTitle(""); setDescription(""); setEmbedUrl(""); setCoverFile(null);
      // refresh lists so admin can immediately add chapters/episodes
      try {
        const mangas = await fetchMangaList();
        const animes = await fetchAnimeList();
        if (type === 'manga') setTargetMangaId(data.id);
        if (type === 'anime') setTargetAnimeId(data.id);
      } catch (_) { }
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  }

  // extra: add chapter/episode to existing item
  const [mangaList, setMangaList] = React.useState([]);
  const [animeList, setAnimeList] = React.useState([]);

  const fetchMangaList = React.useCallback(() => {
    return fetch(`${API_BASE}/api/manga`)
      .then(r => r.json())
      .then(d => { setMangaList(d || []); return d || []; })
      .catch(() => { setMangaList([]); return []; });
  }, []);

  const fetchAnimeList = React.useCallback(() => {
    return fetch(`${API_BASE}/api/anime`)
      .then(r => r.json())
      .then(d => { setAnimeList(d || []); return d || []; })
      .catch(() => { setAnimeList([]); return []; });
  }, []);

  React.useEffect(() => {
    fetchMangaList();
    fetchAnimeList();
  }, [fetchMangaList, fetchAnimeList]);

  const [fileKey, setFileKey] = useState(0);
  // chapter form state
  const [targetMangaId, setTargetMangaId] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterImages, setChapterImages] = useState(""); // deprecated (kept for compatibility)
  const [chapterImagesList, setChapterImagesList] = useState([{ url: '', order: 1 }]);

  const [targetAnimeId, setTargetAnimeId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeEmbed, setEpisodeEmbed] = useState("");
  const [episodeImagesList, setEpisodeImagesList] = useState([{ url: '', order: 1 }]);

  // ensure defaults when lists load
  React.useEffect(() => {
    if (mangaList && mangaList.length && !targetMangaId) setTargetMangaId(mangaList[0].id);
  }, [mangaList]);
  React.useEffect(() => {
    if (animeList && animeList.length && !targetAnimeId) setTargetAnimeId(animeList[0].id);
  }, [animeList]);

  // when targetMangaId changes, fetch chapters to propose next chapter number
  React.useEffect(() => {
    if (!targetMangaId) return;
    fetch(`${API_BASE}/api/manga/${targetMangaId}/chapters`).then(r => r.json()).then(d => {
      const arr = d || [];
      const max = arr.reduce((m, i) => Math.max(m, Number(i.number || 0)), 0);
      setChapterNumber(max + 1 || 1);
    }).catch(() => { });
  }, [targetMangaId]);

  // when targetAnimeId changes, fetch episodes to propose next episode number
  React.useEffect(() => {
    if (!targetAnimeId) return;
    fetch(`${API_BASE}/api/anime/${targetAnimeId}/episodes`).then(r => r.json()).then(d => {
      const arr = d || [];
      const max = arr.reduce((m, i) => Math.max(m, Number(i.number || 0)), 0);
      setEpisodeNumber(max + 1 || 1);
    }).catch(() => { });
  }, [targetAnimeId]);

  // Chapters & Episodes lists and edit states for admin management
  const [currentChapters, setCurrentChapters] = useState([]);
  const [currentEpisodes, setCurrentEpisodes] = useState([]);
  const [editChapterId, setEditChapterId] = useState(null);
  const [editChapterData, setEditChapterData] = useState({});
  const [editEpisodeId, setEditEpisodeId] = useState(null);
  const [editEpisodeData, setEditEpisodeData] = useState({});

  const fetchChapters = React.useCallback((mid) => {
    if (!mid) return Promise.resolve([]);
    return fetch(`${API_BASE}/api/manga/${mid}/chapters`)
      .then(r => r.json())
      .then(d => { setCurrentChapters(d || []); return d || []; })
      .catch(() => { setCurrentChapters([]); return []; });
  }, []);

  const fetchEpisodes = React.useCallback((aid) => {
    if (!aid) return Promise.resolve([]);
    return fetch(`${API_BASE}/api/anime/${aid}/episodes`)
      .then(r => r.json())
      .then(d => { setCurrentEpisodes(d || []); return d || []; })
      .catch(() => { setCurrentEpisodes([]); return []; });
  }, []);

  // call fetch lists when targets change
  React.useEffect(() => { if (targetMangaId) fetchChapters(targetMangaId); }, [targetMangaId, fetchChapters]);
  React.useEffect(() => { if (targetAnimeId) fetchEpisodes(targetAnimeId); }, [targetAnimeId, fetchEpisodes]);

  async function addChapter(e) {
    e.preventDefault();
    try {
      // build images array from structured list; keep compatibility if list empty
      let images = [];
      const hasStructured = chapterImagesList && chapterImagesList.some(i => i.url && i.url.trim());
      if (hasStructured) {
        images = chapterImagesList
          .filter(i => i.url && i.url.trim())
          .map(i => ({ order: Number(i.order) || 1, url: i.url.trim() }))
          .sort((a, b) => a.order - b.order);
      } else {
        images = chapterImages.split(',').map(s => s.trim()).filter(Boolean).map((u, idx) => ({ order: idx + 1, url: u }));
      }

      const res = await authFetch(`/api/manga/${targetMangaId}/chapters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: Number(chapterNumber), title: chapterTitle, images }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus({ ok: true, msg: `Chapter added (id: ${data.id})` });
      setChapterTitle(''); setChapterImages(''); setChapterNumber(chapterNumber + 1);
      setChapterImagesList([{ url: '', order: chapterNumber + 1 }]);
    } catch (err) { setStatus({ ok: false, msg: err.message }); }
  }

  async function addEpisode(e) {
    e.preventDefault();
    try {
      // build images array from structured list; keep compatibility if list empty
      let images = [];
      const hasStructured = episodeImagesList && episodeImagesList.some(i => i.url && i.url.trim());
      if (hasStructured) {
        images = episodeImagesList
          .filter(i => i.url && i.url.trim())
          .map(i => ({ order: Number(i.order) || 1, url: i.url.trim() }))
          .sort((a, b) => a.order - b.order);
      } else {
        images = episodeImagesList.split(',').map(s => s.trim()).filter(Boolean).map((u, idx) => ({ order: idx + 1, url: u }));
      }
      const res = await authFetch(`/api/anime/${targetAnimeId}/episodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: Number(episodeNumber), title: episodeTitle, embed_url: episodeEmbed, images }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus({ ok: true, msg: `Episode added (id: ${data.id})` });
      setEpisodeTitle(''); setEpisodeEmbed(''); setEpisodeNumber(episodeNumber + 1);
      setEpisodeImagesList([{ url: '', order: episodeNumber + 1 }]);
    } catch (err) { setStatus({ ok: false, msg: err.message }); }
  }

  return (
    <div className="app-container">
      <div className="col">
        <h2 className="page-title">Quản trị</h2>

        <div className="tabs">
          <div className="tab-buttons">
            <button type="button" className={`tab-button ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>➕ Thêm nội dung</button>
            <button type="button" className={`tab-button ${tab === 'mangas' ? 'active' : ''}`} onClick={() => setTab('mangas')}>📖 Quản trị Truyện</button>
            <button type="button" className={`tab-button ${tab === 'animes' ? 'active' : ''}`} onClick={() => setTab('animes')}>🎬 Quản trị Anime</button>
            <button type="button" className={`tab-button ${tab === 'chapters' ? 'active' : ''}`} onClick={() => setTab('chapters')}>📄 Thêm chương</button>
            <button type="button" className={`tab-button ${tab === 'episodes' ? 'active' : ''}`} onClick={() => setTab('episodes')}>🎞️ Thêm tập</button>
            <button type="button" className={`tab-button ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>👥 Users</button>
          </div>

          <div className="tab-panel" style={{ display: tab === 'content' ? 'block' : 'none' }}>
            <h3>Thêm truyện / anime</h3>
            <form className="admin-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Loại</label>
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="manga">Truyện (manga)</option>
                  <option value="anime">Anime (video)</option>
                </select>
              </div>

              <div className="form-row">
                <label>Tiêu đề</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề" required />
              </div>

              <div className="form-row">
                <label>Ảnh bìa (tùy chọn)</label>
                <input key={fileKey} type="file" accept="image/*" onChange={e => { setCoverFile(e.target.files?.[0] || null); }} />
              </div>

              {/* {type === "manga" ? ( */}
              <div className="form-row">
                <label>Mô tả</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả" />
              </div>
              {type === "anime" ? (
                <div className="form-row">
                  <label>Embed URL (ví dụ từ YouTube)</label>
                  <input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://www.youtube.com/embed/xxxx" required />
                </div>
              ) : null
              }

              <div className="form-actions">
                <button className="btn" type="submit">Thêm {type}</button>
                <button type="button" className="btn secondary" onClick={() => { setTitle(""); setDescription(""); setEmbedUrl(""); setCoverFile(null); setStatus(null); setCoverFile(null); setEpisodeImagesList([{ url: '', order: 1 }]); }}>Reset</button>
                <div style={{ flex: 1 }} />
                {status && (
                  <div className="notice" style={{ color: status.ok ? "#8ef" : "#f88" }}>{status.msg}</div>
                )}
              </div>
            </form>
          </div>

          <div className="tab-panel" style={{ display: tab === 'chapters' ? 'block' : 'none' }}>
            <h3>Quản lý chương</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h4>Thêm chương mới</h4>
                <form className="admin-form" onSubmit={addChapter}>
                  <div className="form-row">
                    <label>Chọn truyện</label>
                    <select value={targetMangaId} onChange={e => setTargetMangaId(e.target.value)}>
                      {mangaList.map(m => <option key={m.id} value={m.id}>{m.title} (id:{m.id})</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label>Số chương</label><input type="number" value={chapterNumber} onChange={e => setChapterNumber(Number(e.target.value))} min={1} /></div>
                  <div className="form-row"><label>Tiêu đề chương</label><input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} /></div>
                  <div className="form-row"><label>Danh sách ảnh (URL phân tách bằng dấu phẩy)</label><textarea value={chapterImages} onChange={e => setChapterImages(e.target.value)} placeholder="https://.../1.jpg, https://.../2.jpg" /></div>
                  <div className="form-actions"><button className="btn" type="submit">Thêm chương</button></div>
                </form>
              </div>

              <div style={{ flex: 1 }}>
                <h4>Danh sách chương của truyện đã chọn</h4>
                <div style={{ marginBottom: 8 }}>
                  <button className="btn" onClick={() => fetchChapters(targetMangaId)}>Tải lại</button>
                </div>
                {currentChapters.length === 0 ? (
                  <p style={{ color: '#666' }}>Chưa có chương</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentChapters.map(c => (
                      <div key={c.id} style={{ background: '#0f0f1a', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {editChapterId === c.id ? (
                          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                            <input style={{ width: 80 }} value={editChapterData.number || ''} onChange={e => setEditChapterData(prev => ({ ...prev, number: e.target.value }))} />
                            <input style={{ flex: 1 }} value={editChapterData.title || ''} onChange={e => setEditChapterData(prev => ({ ...prev, title: e.target.value }))} />
                            <button className="btn" onClick={async () => {
                              try {
                                const res = await authFetch(`/api/manga/${targetMangaId}/chapters/${editChapterId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editChapterData) });
                                const j = await res.json();
                                if (!res.ok) throw new Error(j.error || 'Failed');
                                setEditChapterId(null); setEditChapterData({}); fetchChapters(targetMangaId);
                              } catch (err) { alert(err.message); }
                            }}>Lưu</button>
                            <button className="btn secondary" onClick={() => { setEditChapterId(null); setEditChapterData({}); }}>Hủy</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1 }}>
                              <strong>Chap {c.number}</strong> — <span style={{ color: '#aaa' }}>{c.title || 'Không tiêu đề'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn" onClick={() => { setEditChapterId(c.id); setEditChapterData({ number: c.number, title: c.title, images: c.images }); }}>Sửa</button>
                              <button className="btn secondary" onClick={async () => {
                                if (!confirm('Xóa chương này?')) return;
                                try {
                                  const res = await authFetch(`/api/manga/${targetMangaId}/chapters/${c.id}`, { method: 'DELETE' });
                                  if (!res.ok) throw new Error('Failed');
                                  fetchChapters(targetMangaId);
                                } catch (err) { alert(err.message); }
                              }}>Xóa</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tab-panel" style={{ display: tab === 'episodes' ? 'block' : 'none' }}>
            <h3>Quản lý tập</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h4>Thêm tập mới</h4>
                <form className="admin-form" onSubmit={addEpisode}>
                  <div className="form-row">
                    <label>Chọn anime</label>
                    <select value={targetAnimeId} onChange={e => setTargetAnimeId(e.target.value)}>
                      {animeList.map(a => <option key={a.id} value={a.id}>{a.title} (id:{a.id})</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label>Số tập</label><input type="number" value={episodeNumber} onChange={e => setEpisodeNumber(e.target.value)} min={1} /></div>
                  <div className="form-row"><label>Tiêu đề tập</label><input value={episodeTitle} onChange={e => setEpisodeTitle(e.target.value)} /></div>
                  <div className="form-row"><label>Embed URL</label><input value={episodeEmbed} onChange={e => setEpisodeEmbed(e.target.value)} placeholder="https://www.youtube.com/embed/xxxx" /></div>
                  <div className="form-actions"><button className="btn" type="submit">Thêm tập</button></div>
                </form>
              </div>

              <div style={{ flex: 1 }}>
                <h4>Danh sách tập của anime đã chọn</h4>
                <div style={{ marginBottom: 8 }}>
                  <button className="btn" onClick={() => fetchEpisodes(targetAnimeId)}>Tải lại</button>
                </div>
                {currentEpisodes.length === 0 ? (
                  <p style={{ color: '#666' }}>Chưa có tập</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentEpisodes.map(ep => (
                      <div key={ep.id} style={{ background: '#0f0f1a', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {editEpisodeId === ep.id ? (
                          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                            <input style={{ width: 80 }} value={editEpisodeData.number || ''} onChange={e => setEditEpisodeData(prev => ({ ...prev, number: e.target.value }))} />
                            <input style={{ flex: 1 }} value={editEpisodeData.title || ''} onChange={e => setEditEpisodeData(prev => ({ ...prev, title: e.target.value }))} />
                            <input style={{ flex: 1 }} value={editEpisodeData.embed_url || ''} onChange={e => setEditEpisodeData(prev => ({ ...prev, embed_url: e.target.value }))} />
                            <button className="btn" onClick={async () => {
                              try {
                                const res = await authFetch(`/api/anime/${targetAnimeId}/episodes/${editEpisodeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editEpisodeData) });
                                const j = await res.json();
                                if (!res.ok) throw new Error(j.error || 'Failed');
                                setEditEpisodeId(null); setEditEpisodeData({}); fetchEpisodes(targetAnimeId);
                              } catch (err) { alert(err.message); }
                            }}>Lưu</button>
                            <button className="btn secondary" onClick={() => { setEditEpisodeId(null); setEditEpisodeData({}); }}>Hủy</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1 }}>
                              <strong>Tập {ep.number}</strong> — <span style={{ color: '#aaa' }}>{ep.title || 'Không tiêu đề'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn" onClick={() => { setEditEpisodeId(ep.id); setEditEpisodeData({ number: ep.number, title: ep.title, embed_url: ep.embed_url }); }}>Sửa</button>
                              <button className="btn secondary" onClick={async () => {
                                if (!confirm('Xóa tập này?')) return;
                                try {
                                  const res = await authFetch(`/api/anime/${targetAnimeId}/episodes/${ep.id}`, { method: 'DELETE' });
                                  if (!res.ok) throw new Error('Failed');
                                  fetchEpisodes(targetAnimeId);
                                } catch (err) { alert(err.message); }
                              }}>Xóa</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tab-panel" style={{ display: tab === 'mangas' ? 'block' : 'none' }}>
            <MangaManagementPanel mangaList={mangaList} fetchMangaList={fetchMangaList} status={status} setStatus={setStatus} />
          </div>

          <div className="tab-panel" style={{ display: tab === 'animes' ? 'block' : 'none' }}>
            <AnimeManagementPanel animeList={animeList} fetchAnimeList={fetchAnimeList} status={status} setStatus={setStatus} />
          </div>

          <div className="tab-panel" style={{ display: tab === 'users' ? 'block' : 'none' }}>
            <h3>Quản lý users</h3>
            <UsersPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaManagementPanel({ mangaList, fetchMangaList, status, setStatus }) {
  const [editId, setEditId] = React.useState(null);
  const [editData, setEditData] = React.useState({});
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleEdit = (manga) => {
    setEditId(manga.id);
    setEditData({ ...manga });
  };

  const handleSave = async (id) => {
    try {
      const res = await authFetch(`/api/manga/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setStatus({ ok: true, msg: `Truyện cập nhật (${editData.title})` });
      setEditId(null);
      fetchMangaList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  // Enhanced save for anime: update metadata and upload cover if provided
  const handleSaveWithCoverAnime = async (id) => {
    try {
      const res = await authFetch(`/api/anime/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      if (editData.coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', editData.coverFile);
          const uploadUrl = `${API_BASE}/api/anime/${id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Upload failed');
        } catch (err) {
          console.error('Cover upload error', err);
        }
      }

      setStatus({ ok: true, msg: `Anime cập nhật (${editData.title})` });
      setEditId(null);
      setEditData({});
      fetchAnimeList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  // Enhanced save: also upload cover if provided
  const handleSaveWithCover = async (id) => {
    try {
      // update metadata first
      const res = await authFetch(`/api/manga/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      // if a new cover file is selected, upload it
      if (editData.coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', editData.coverFile);
          const uploadUrl = `${API_BASE}/api/manga/${id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Upload failed');
        } catch (err) {
          console.error('Cover upload error', err);
        }
      }

      setStatus({ ok: true, msg: `Truyện cập nhật (${editData.title})` });
      setEditId(null);
      setEditData({});
      fetchMangaList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa?')) return;
    try {
      const res = await authFetch(`/api/manga/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setStatus({ ok: true, msg: 'Truyện đã xóa' });
      fetchMangaList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  const filtered = mangaList.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <h3>Quản trị Truyện (Manga)</h3>
      {status && <div className="notice" style={{ color: status.ok ? '#8ef' : '#f88', marginBottom: 12 }}>{status.msg}</div>}
      <div className="form-row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="🔍 Tìm kiếm truyện..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '8px 12px' }}
        />
      </div>
      {filtered.length === 0 ? (
        <p style={{ color: '#666' }}>Không có truyện nào</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(m => (
            <div key={m.id} style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
              {editId === m.id ? (
                <form onSubmit={e => { e.preventDefault(); handleSaveWithCover(m.id); }}>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Tiêu đề</label>
                    <input
                      value={editData.title || ''}
                      onChange={e => setEditData({ ...editData, title: e.target.value })}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Mô tả</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={e => setEditData({ ...editData, description: e.target.value })}
                      style={{ fontSize: 12, minHeight: 60 }}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Ảnh bìa mới (tùy chọn)</label>
                    <input type="file" accept="image/*" onChange={e => setEditData({ ...editData, coverFile: e.target.files && e.target.files[0] ? e.target.files[0] : null })} />
                    {editData.cover_url && !editData.coverFile && (
                      <div style={{ marginTop: 8 }}>
                        <img src={editData.cover_url} alt="cover" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 4 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>💾 Lưu</button>
                    <button type="button" className="btn secondary" onClick={() => { setEditId(null); setEditData({}); }} style={{ fontSize: 12 }}>✕ Hủy</button>
                  </div>
                </form>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    {m.cover_url && <img src={m.cover_url} alt={m.title} style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 4, marginRight: 8, float: 'left' }} />}
                    {m.title}
                  </h4>
                  <p style={{ margin: '0 0 8px 0', color: '#aaa', fontSize: 12, clear: 'both' }}>
                    ID: <code style={{ color: '#8ef' }}>{m.id}</code>
                  </p>
                  <p style={{ margin: '0 0 12px 0', color: '#888', fontSize: 12, maxHeight: 60, overflow: 'hidden' }}>
                    {m.description}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleEdit(m)} style={{ fontSize: 12, flex: 1 }}>✏️ Sửa</button>
                    <button className="btn secondary" onClick={() => handleDelete(m.id)} style={{ fontSize: 12, flex: 1 }}>🗑️ Xóa</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnimeManagementPanel({ animeList, fetchAnimeList, status, setStatus }) {
  const [editId, setEditId] = React.useState(null);
  const [editData, setEditData] = React.useState({});
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleEdit = (anime) => {
    setEditId(anime.id);
    setEditData({ ...anime });
  };

  const handleSave = async (id) => {
    try {
      const res = await authFetch(`/api/anime/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setStatus({ ok: true, msg: `Anime cập nhật (${editData.title})` });
      setEditId(null);
      fetchAnimeList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa?')) return;
    try {
      const res = await authFetch(`/api/anime/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setStatus({ ok: true, msg: 'Anime đã xóa' });
      fetchAnimeList();
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  const filtered = animeList.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <h3>Quản trị Anime</h3>
      {status && <div className="notice" style={{ color: status.ok ? '#8ef' : '#f88', marginBottom: 12 }}>{status.msg}</div>}
      <div className="form-row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="🔍 Tìm kiếm anime..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '8px 12px' }}
        />
      </div>
      {filtered.length === 0 ? (
        <p style={{ color: '#666' }}>Không có anime nào</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(a => (
            <div key={a.id} style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
              {editId === a.id ? (
                <form onSubmit={e => { e.preventDefault(); handleSaveWithCoverAnime(a.id); }}>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Tiêu đề</label>
                    <input
                      value={editData.title || ''}
                      onChange={e => setEditData({ ...editData, title: e.target.value })}
                      style={{ fontSize: 12 }}
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Mô tả</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={e => setEditData({ ...editData, description: e.target.value })}
                      style={{ fontSize: 12, minHeight: 60 }}
                      placeholder="Mô tả phim.."
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Embed URL</label>
                    <input
                      value={editData.embed_url || ''}
                      onChange={e => setEditData({ ...editData, embed_url: e.target.value })}
                      style={{ fontSize: 12 }}
                      placeholder="https://www.youtube.com/embed/xxxx"
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Ảnh bìa mới (tùy chọn)</label>
                    <input type="file" accept="image/*" onChange={e => setEditData({ ...editData, coverFile: e.target.files && e.target.files[0] ? e.target.files[0] : null })} />
                    {editData.cover_url && !editData.coverFile && (
                      <div style={{ marginTop: 8 }}>
                        <img src={editData.cover_url} alt="cover" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 4 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn" style={{ fontSize: 12 }}>💾 Lưu</button>
                    <button type="button" className="btn secondary" onClick={() => setEditId(null)} style={{ fontSize: 12 }}>✕ Hủy</button>
                  </div>
                </form>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    {a.cover_url && <img src={a.cover_url} alt={a.title} style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 4, marginRight: 8, float: 'left' }} />}
                    {a.title}
                  </h4>
                  <p style={{ margin: '0 0 8px 0', color: '#aaa', fontSize: 12, clear: 'both' }}>
                    ID: <code style={{ color: '#8ef' }}>{a.id}</code>
                  </p>
                  <p style={{ margin: '0 0 12px 0', color: '#888', fontSize: 12, maxHeight: 60, overflow: 'hidden' }}>
                    {a.embed_url ? '▶️ ' + a.embed_url : 'Chưa có video'}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => handleEdit(a)} style={{ fontSize: 12, flex: 1 }}>✏️ Sửa</button>
                    <button className="btn secondary" onClick={() => handleDelete(a.id)} style={{ fontSize: 12, flex: 1 }}>🗑️ Xóa</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/users`);
      if (!res.ok) throw new Error('Không thể lấy users');
      // const data = await res.json();
      // console.log(API_BASE);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('NOT JSON:', text);
        throw new Error('Server returned non-JSON');
      }
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally { setLoading(false); }
  }

  React.useEffect(() => { fetchUsers(); }, []);

  async function changeRole(userId, role) {
    setStatus(null);
    try {
      const res = await authFetch(`/api/admin/users/${userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Thất bại!');
      setStatus({ ok: true, msg: `Quyền hạn đã được cấp cho ${j.username} : ${j.role}` });
      // update local list
      setUsers(prev =>
        prev.map(u =>
          u.id === j.id
            ? { ...u, ...j } // ✅ merge
            : u
        )
      );
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  }
  const formatDate = (date) => {
    if (!date) return '-';

    // Firestore Timestamp (client SDK)
    if (date?.toDate) {
      return date.toDate().toLocaleDateString('vi-VN');
    }

    // Firestore Timestamp (server JSON)
    if (date?.seconds) {
      return new Date(date.seconds * 1000)
        .toLocaleDateString('vi-VN');
    }

    // ISO string / number
    const d = new Date(date);

    return isNaN(d) ? '-' : d.toLocaleDateString('vi-VN');
  };
  const [updatingId, setUpdatingId] = useState(null);
  const currentUser = getUserFromToken();

  return (
    <div>
      {status && <div className="notice" style={{ color: status.ok ? '#8ef' : '#f88' }}>{status.msg}</div>}
      {loading ? <div className="notice">Đang tải danh sách users...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ textAlign: 'center' }}><th>ID</th><th>Username</th><th>Role</th><th>Created</th><th>Action</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'default' }}>
                <td style={{ width: '28%' }}>{u.id.slice(0, 10)}...</td>
                <td style={{ width: '36%' }}>{u.username.slice(0, 20)}...</td>
                <td style={{ width: '12%', textAlign: 'center' }}>{u.role}</td>
                <td style={{ width: '16%' }}>{formatDate(u.created_at)}</td>
                <td style={{ width: '16%', textAlign: 'center' }}>
                  {currentUser && currentUser.id === u.id ? <em>My Account</em> : (
                    <>
                      <button className={u.role === 'admin' ? 'btn' : 'btn secondary'} disabled={updatingId === u.id} onClick={async () => { setUpdatingId(u.id); await changeRole(u.id, u.role === 'admin' ? 'user' : 'admin'); setUpdatingId(null); }}>{u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
