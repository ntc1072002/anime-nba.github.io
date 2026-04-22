import React, { useState } from "react";
import { authFetch, getUserFromToken, getToken } from '../utils/auth.js';
import { API_BASE } from '../config.js';

const URL_EXTRACT_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

function parseImageUrlsFromText(rawText) {
  const matches = String(rawText || "").match(URL_EXTRACT_PATTERN) || [];
  const cleaned = matches
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^['"]|['"]$/g, ""))
    .map((s) => s.replace(/[),;]+$/g, ""))
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => !/w3\.org\/2000\/svg/i.test(url));

  return Array.from(new Set(cleaned));
}

function normalizeImageUrls(images) {
  if (!Array.isArray(images)) return [];
  const urls = images
    .map((item) => (typeof item === "string" ? item : item?.url))
    .map((url) => String(url || "").trim())
    .filter(Boolean);
  return Array.from(new Set(urls));
}

function AdminAlert({ status, children, tone = "auto", className = "" }) {
  const message = children ?? status?.msg;
  if (!message) return null;

  const resolvedTone =
    tone === "auto" ? (status?.ok ? "success" : "error") : tone;

  return (
    <div className={`admin-alert admin-alert-${resolvedTone}${className ? ` ${className}` : ""}`}>
      {message}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('content');
  const [type, setType] = useState("manga");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusMenu, setStatusMenu] = useState(null);
  const [statusManga, setStatusManga] = useState(null);
  const [statusAnime, setStatusAnime] = useState(null);
  const [statusChapter, setStatusChapter] = useState(null);
  const [statusEpisode, setStatusEpisode] = useState(null);
  const [statusUser, setStatusUser] = useState(null);
  const [statusRole, setStatusRole] = useState(null);
  const [statusPerm, setStatusPerm] = useState(null);

  const currentUser = getUserFromToken();
  const isOwner = currentUser?.role === 'owner';

  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMenu(null);
    try {
      const payload = type === "manga" ? { title, genre, description } : { title, genre, description, embed_url: embedUrl };
      const res = await authFetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");
      setStatusMenu({
        ok: true,
        msg: type === "manga"
          ? `Đã thêm truyện ${data.title}`
          : `Đã thêm anime ${data.title}`
      });
      // if cover file provided, upload it
      if (coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', coverFile);
          const uploadUrl = `${API_BASE}/api/${type}/${data.id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Tải ảnh lên thất bại');
        } catch (err) {
          console.error('Lỗi tải ảnh bìa', err);
        }
      }
      // reset form
      setTitle(""); setDescription(""); setEmbedUrl(""); setCoverFile(null); setGenre(""); setFileKey(Date.now()); setChapterImages(""); setChapterTitle(""); setEpisodeTitle(""); setEpisodeEmbed("");
      // refresh lists so admin can immediately add chapters/episodes
      try {
        const mangas = await fetchMangaList();
        const animes = await fetchAnimeList();
        if (type === 'manga') setTargetMangaId(data.id);
        if (type === 'anime') setTargetAnimeId(data.id);
      } catch (_) { }
    } catch (err) {
      setStatusMenu({ ok: false, msg: err.message });
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
  const [chapterImages, setChapterImages] = useState("");
  const [editingChapterId, setEditingChapterId] = useState(null);

  const [targetAnimeId, setTargetAnimeId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeEmbed, setEpisodeEmbed] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState(null);

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
    setEditingChapterId(null);
    setChapterTitle("");
    setChapterImages("");
    fetch(`${API_BASE}/api/manga/${targetMangaId}/chapters`).then(r => r.json()).then(d => {
      const arr = d || [];
      const max = arr.reduce((m, i) => Math.max(m, Number(i.number || 0)), 0);
      setChapterNumber(max + 1 || 1);
    }).catch(() => { });
  }, [targetMangaId]);

  // when targetAnimeId changes, fetch episodes to propose next episode number
  React.useEffect(() => {
    if (!targetAnimeId) return;
    setEditingEpisodeId(null);
    setEpisodeTitle("");
    setEpisodeEmbed("");
    fetch(`${API_BASE}/api/anime/${targetAnimeId}/episodes`).then(r => r.json()).then(d => {
      const arr = d || [];
      const max = arr.reduce((m, i) => Math.max(m, Number(i.number || 0)), 0);
      setEpisodeNumber(max + 1 || 1);
    }).catch(() => { });
  }, [targetAnimeId]);

  // Chapters & Episodes lists and edit states for admin management
  const [currentChapters, setCurrentChapters] = useState([]);
  const [currentEpisodes, setCurrentEpisodes] = useState([]);
  const [genre, setGenre] = useState("");

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

  function resetChapterForm(chapters = currentChapters) {
    const max = (chapters || []).reduce((m, i) => Math.max(m, Number(i?.number || 0)), 0);
    setEditingChapterId(null);
    setChapterNumber(max + 1 || 1);
    setChapterTitle("");
    setChapterImages("");
    // setStatusChapter(null);
  }

  function startEditChapter(chapter) {
    const row = chapter || {};
    const imageUrls = normalizeImageUrls(row.images);
    setEditingChapterId(row.id || null);
    setChapterNumber(Number(row.number) || 1);
    setChapterTitle(row.title || "");
    setChapterImages(imageUrls.join(",\n"));
    setStatusChapter({ ok: true, msg: `Đang sửa chapter ${Number(row.number) || ""} manga "${targetMangaId}"` });
  }

  function resetEpisodeForm(episodes = currentEpisodes) {
    const max = (episodes || []).reduce((m, i) => Math.max(m, Number(i?.number || 0)), 0);
    setEditingEpisodeId(null);
    setEpisodeNumber(max + 1 || 1);
    setEpisodeTitle("");
    setEpisodeEmbed("");
    // setStatusEpisode(null);
  }

  function startEditEpisode(episode) {
    const row = episode || {};
    setEditingEpisodeId(row.id || null);
    setEpisodeNumber(Number(row.number) || 1);
    setEpisodeTitle(row.title || "");
    setEpisodeEmbed(row.embed_url || "");
    setStatusEpisode({ ok: true, msg: `Đang sửa tập ${Number(row.number) || ""} anime "${targetAnimeId}"` });
  }

  async function addChapter(e) {
    e.preventDefault();
    setStatusChapter(null);

    try {
      if (!targetMangaId) throw new Error("Vui lòng chọn truyện.");
      if (!Number(chapterNumber) || Number(chapterNumber) <= 0) throw new Error("Số chapter không hợp lệ.");
      const isEditing = !!editingChapterId;
      const images = parseImageUrlsFromText(chapterImages).map((url, idx) => ({
        order: idx + 1,
        url
      }));

      if (!images.length) {
        throw new Error("Không tìm thấy URL ảnh hợp lệ. Hãy dán link trực tiếp bắt đầu bằng http hoặc https.");
      }

      const res = await authFetch(
        isEditing
          ? `/api/manga/${targetMangaId}/chapters/${editingChapterId}`
          : `/api/manga/${targetMangaId}/chapters`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: Number(chapterNumber),
            title: chapterTitle,
            genre: genre || null,
            images
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");

      setStatusChapter({
        ok: true,
        msg: isEditing
          ? `Đã cập nhật chapter ${chapterNumber} truyện "${targetMangaId}"`
          : `Đã thêm chapter "${chapterNumber}" truyện "${targetMangaId}`
      });

      const refreshed = await fetchChapters(targetMangaId);
      resetChapterForm(refreshed);

    } catch (err) {
      setStatusChapter({ ok: false, msg: err.message });
    }
  }

  async function addEpisode(e) {
    e.preventDefault();
    setStatusEpisode(null);

    try {
      if (!targetAnimeId) throw new Error("Vui lòng chọn anime.");
      if (!Number(episodeNumber) || Number(episodeNumber) <= 0) throw new Error("Số tập không hợp lệ.");
      const isEditing = !!editingEpisodeId;
      const res = await authFetch(
        isEditing
          ? `/api/anime/${targetAnimeId}/episodes/${editingEpisodeId}`
          : `/api/anime/${targetAnimeId}/episodes`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: Number(episodeNumber),
            title: episodeTitle,
            genre: genre || null,
            embed_url: episodeEmbed
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thất bại");

      setStatusEpisode({
        ok: true,
        msg: isEditing
          ? `Đã cập nhật tập ${episodeNumber} anime "${targetAnimeId}"`
          : `Đã thêm tập ${episodeNumber} anime "${targetAnimeId}"`
      });

      const refreshed = await fetchEpisodes(targetAnimeId);
      resetEpisodeForm(refreshed);

    } catch (err) {
      setStatusEpisode({ ok: false, msg: err.message });
    }
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
            {isOwner && (
              <>
                <button type="button" className={`tab-button ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>👤 Người dùng</button>
                <button type="button" className={`tab-button ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>⭐ Vai trò</button>
                <button type="button" className={`tab-button ${tab === 'permissions' ? 'active' : ''}`} onClick={() => setTab('permissions')}>🚫 Quyền</button>
              </>
            )}
          </div>

          <div className="tab-panel" style={{ display: tab === 'content' ? 'flex' : 'none', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <AdminAlert status={statusMenu} />
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
                  <input key={fileKey} type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; setCoverFile(file || null); if (file) { const previewUrl = URL.createObjectURL(file); setCoverPreview(previewUrl); } }} required />
                </div>
                <div className="form-row">
                  <label>Thể loại</label>
                  <input
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    placeholder="Action, Romance, Fantasy..."
                    required
                  />
                </div>
                {/* {type === "manga" ? ( */}
                <div className="form-row">
                  <label>Mô tả</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả" required />
                </div>
                {type === "anime" ? (
                  <div className="form-row">
                    <label>Embed URL (ví dụ từ YouTube)</label>
                    <input value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} placeholder="https://www.youtube.com/embed/xxxx" required />
                  </div>
                ) : null
                }

                <div className="form-actions">
                  <button className="btn" type="submit">{type === "manga" ? "Thêm truyện" : "Thêm anime"}</button>
                  <button type="button" className="btn secondary" onClick={() => { setTitle(""); setDescription(""); setFileKey(Date.now()); setEmbedUrl(""); setGenre(""); }}>Đặt lại</button>
                  <div style={{ flex: 1 }} />
                </div>
              </form>
            </div>
            <div style={{ width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <img src={coverPreview || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQf4D2oLTISHdovO5LRK4icyWdGu-oyJV8uOA&s'} alt="Image" style={{ maxWidth: '50%', borderRadius: 6, padding: 8 }} />
            </div>
          </div>

          <div className="tab-panel" style={{ display: tab === 'chapters' ? 'block' : 'none' }}>
            <h3>Quản lý truyện</h3>
            <div className="admin-split">
              <div className="admin-split-col">
                <AdminAlert status={statusChapter} className="admin-alert-tight" />
                <h4>{editingChapterId ? "Chỉnh sửa Chapter" : "Thêm Chapter mới"}</h4>
                <form className="admin-form" onSubmit={addChapter}>
                  <div className="form-row">
                    <label>Chọn truyện</label>
                    <select value={targetMangaId} onChange={e => setTargetMangaId(e.target.value)}>
                      {mangaList.map(m => <option key={m.id} value={m.id}>{m.title} (id:{m.id})</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label>Số Chapter</label><input type="number" value={chapterNumber} onChange={e => setChapterNumber(Number(e.target.value))} min={1} /></div>
                  <div className="form-row"><label>Tiêu đề Chapter</label><input value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} /></div>
                  {/* <div className="form-row"><label>Thể loại</label><input value={chapterGenre} onChange={e => setChapterGenre(e.target.value)} placeholder="Action, Romance, Fantasy..." /></div> */}
                  <div className="form-row"><label>Danh sách ảnh (URL, cách nhau bằng dấu phẩy hoặc xuống dòng)</label><textarea className="chapter-images-textarea" value={chapterImages} onChange={e => setChapterImages(e.target.value)} placeholder="https://.../1.jpg, https://.../2.jpg" /></div>
                  <div className="form-actions">
                    <button className="btn" type="submit">{editingChapterId ? "Cập nhật chapter" : "Thêm chapter"}</button>
                    {editingChapterId && (
                      <button type="button" className="btn secondary" onClick={() => resetChapterForm()}>
                        Hủy sửa
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-split-col chapter-list-panel">
                <h4>Danh sách chương truyện "{mangaList.map(m => m.id === targetMangaId ? m.title : null)}"</h4>
                <div style={{ marginBottom: 8 }}>
                  <button className="btn" onClick={() => fetchChapters(targetMangaId)}>Tải lại</button>
                </div>
                <div className="chapter-list-body">
                  {currentChapters.length === 0 ? (
                    <p style={{ color: '#666' }}>Chưa có chapter</p>
                  ) : (
                    <div className="chapter-list-scroll">
                      {currentChapters.map(c => (
                        <div key={c.id} style={{ background: '#0f0f1a', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <strong>Chap {c.number}</strong> - <span style={{ color: '#aaa' }}>{c.title || 'Không tiêu đề'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => startEditChapter(c)}>
                              {editingChapterId === c.id ? "Đang sửa" : "Sửa"}
                            </button>
                            <button className="btn secondary" onClick={async () => {
                              if (!confirm('Xóa chapter này?')) return;
                              try {
                                const res = await authFetch(`${API_BASE}/api/manga/${targetMangaId}/chapters/${c.id}`, { method: 'DELETE' });
                                if (!res.ok) throw new Error('Failed');
                                const refreshed = await fetchChapters(targetMangaId);
                                setStatusChapter({ ok: true, msg: `Đã xóa chapter ${c.number} truyện "${targetMangaId}"` });
                                if (editingChapterId === c.id) resetChapterForm(refreshed);
                              } catch (err) { setStatusChapter({ ok: false, msg: err.message }); }
                            }}>Xóa</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="tab-panel" style={{ display: tab === 'episodes' ? 'block' : 'none' }}>
            <h3>Quản lý tập</h3>
            <div className="admin-split">
              <div className="admin-split-col">
                <AdminAlert status={statusEpisode} className="admin-alert-tight" />
                <h4>{editingEpisodeId ? "Chỉnh sửa tập" : "Thêm tập mới"}</h4>

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
                  <div className="form-actions">
                    <button className="btn" type="submit">{editingEpisodeId ? "Cập nhật tập" : "Thêm tập"}</button>
                    {editingEpisodeId && (
                      <button type="button" className="btn secondary" onClick={() => resetEpisodeForm()}>
                        Hủy sửa
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-split-col chapter-list-panel">
                <h4>Danh sách tập của anime đã chọn</h4>
                <div style={{ marginBottom: 8 }}>
                  <button className="btn" onClick={() => fetchEpisodes(targetAnimeId)}>Tải lại</button>
                </div>
                <div className="chapter-list-body">
                  {currentEpisodes.length === 0 ? (
                    <p style={{ color: '#666' }}>Chưa có tập</p>
                  ) : (
                    <div className="chapter-list-scroll">
                      {currentEpisodes.map(ep => (
                        <div key={ep.id} style={{ background: '#0f0f1a', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <strong>Tập {ep.number}</strong> - <span style={{ color: '#aaa' }}>{ep.title || 'Không tiêu đề'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => startEditEpisode(ep)}>
                              {editingEpisodeId === ep.id ? "Đang sửa" : "Sửa"}
                            </button>
                            <button className="btn secondary" onClick={async () => {
                              if (!confirm('Xóa tập này?')) return;
                              try {
                                const res = await authFetch(`${API_BASE}/api/anime/${targetAnimeId}/episodes/${ep.id}`, { method: 'DELETE' });
                                if (!res.ok) throw new Error('Failed');
                                const refreshed = await fetchEpisodes(targetAnimeId);
                                setStatusEpisode({ ok: true, msg: `Đã xóa tập ${ep.number} anime "${targetAnimeId}"` });
                                if (editingEpisodeId === ep.id) resetEpisodeForm(refreshed);
                              } catch (err) { setStatusEpisode({ ok: false, msg: err.message }); }
                            }}>Xóa</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="tab-panel" style={{ display: tab === 'mangas' ? 'block' : 'none' }}>
            <MangaManagementPanel mangaList={mangaList} fetchMangaList={fetchMangaList} statusManga={statusManga} setStatusManga={setStatusManga} />
          </div>

          <div className="tab-panel" style={{ display: tab === 'animes' ? 'block' : 'none' }}>
            <AnimeManagementPanel animeList={animeList} fetchAnimeList={fetchAnimeList} statusAnime={statusAnime} setStatusAnime={setStatusAnime} />
          </div>

          <div className="tab-panel" style={{ display: tab === 'users' ? 'block' : 'none' }}>
            {isOwner ? (
              <>
                <h3>Người dùng</h3>
                <UsersManagementPanel />
              </>
            ) : (
              <AdminAlert status={statusUser} />
            )}
          </div>

          <div className="tab-panel" style={{ display: tab === 'roles' ? 'block' : 'none' }}>
            {isOwner ? (
              <>
                <h3>Vai trò</h3>
                <RolesManagementPanel />
              </>
            ) : (
              <AdminAlert status={statusUser} />
            )}
          </div>

          <div className="tab-panel" style={{ display: tab === 'permissions' ? 'block' : 'none' }}>
            {isOwner ? (
              <>
                <h3>Quyền</h3>
                <PermissionsManagementPanel />
              </>
            ) : (
              <AdminAlert tone="warning"><strong>Chỉ Owner mới có quyền truy cập mục này.</strong></AdminAlert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaManagementPanel({ mangaList, fetchMangaList, statusManga, setStatusManga }) {
  const [editId, setEditId] = React.useState(null);
  const [editData, setEditData] = React.useState({});
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleEdit = (manga) => {
    setEditId(manga.id);
    setEditData({ ...manga });
    // setStatusManga(null);
    // setStatusManga({ ok: true, msg: `Đang sửa truyện (id: ${manga.id})` });
  };

  const handleSave = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/manga/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');
      setStatusManga({ ok: true, msg: `Truyện cập nhật "${editData.title}"` });
      setEditId(null);
      fetchMangaList();
    } catch (err) {
      setStatusManga({ ok: false, msg: err.message });
    }
  };

  // Enhanced save: also upload cover if provided
  const handleSaveWithCover = async (id) => {
    try {
      // update metadata first
      const res = await authFetch(`${API_BASE}/api/manga/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');

      // if a new cover file is selected, upload it
      if (editData.coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', editData.coverFile);
          const uploadUrl = `${API_BASE}/api/manga/${id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Tải ảnh lên thất bại');
        } catch (err) {
          console.error('Lỗi tải ảnh bìa', err);
        }
      }

      setStatusManga({ ok: true, msg: `Truyện cập nhật "${editData.title}"` });
      setEditId(null);
      setEditData({});
      fetchMangaList();
    } catch (err) {
      setStatusManga({ ok: false, msg: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa?')) return;
    try {
      const res = await authFetch(`/api/manga/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Xóa thất bại');
      setStatusManga({ ok: true, msg: `Truyện "${editData.title}" đã xóa` });
      fetchMangaList();
    } catch (err) {
      setStatusManga({ ok: false, msg: err.message });
    }
  };

  const filtered = mangaList.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <h3>Quản lý truyện</h3>
      <AdminAlert status={statusManga} />
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
                    <label style={{ fontSize: 12 }}>Thể loại</label>
                    <input
                      value={editData.genre || ''}
                      onChange={e => setEditData({ ...editData, genre: e.target.value })}
                      style={{ fontSize: 12 }}
                      placeholder="Action, Romance, Fantasy..."
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
                  <p style={{ margin: '0 0 12px 0', color: '#9aa', fontSize: 12 }}>
                    Thể loại: {m.genre || '-'}
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

function AnimeManagementPanel({ animeList, fetchAnimeList, statusAnime, setStatusAnime }) {
  const [editId, setEditId] = React.useState(null);
  const [editData, setEditData] = React.useState({});
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleEdit = (anime) => {
    setEditId(anime.id);
    setEditData({ ...anime });
  };

  // Enhanced save for anime: update metadata and upload cover if provided
  const handleSaveWithCoverAnime = async (id) => {
    setStatusAnime(null);
    try {
      const res = await authFetch(`${API_BASE}/api/anime/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');

      if (editData.coverFile) {
        try {
          const token = getToken();
          const fd = new FormData();
          fd.append('image', editData.coverFile);
          const uploadUrl = `${API_BASE}/api/anime/${id}/cover`;
          const uploadRes = await fetch(uploadUrl, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
          const uj = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uj.error || 'Tải ảnh lên thất bại');
        } catch (err) {
          console.error('Lỗi tải ảnh bìa', err);
        }
      }

      setStatusAnime({ ok: true, msg: `Anime cập nhật "${editData.title}` });
      setEditId(null);
      setEditData({});
      fetchAnimeList();
    } catch (err) { 
      setStatusAnime({ ok: false, msg: err.message });
    }
  };
  const handleSave = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/anime/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại');
      setStatusAnime({ ok: true, msg: `Anime cập nhật "${editData.title}"` });
      setEditId(null);
      fetchAnimeList();
    } catch (err) {
      setStatusAnime({ ok: false, msg: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa?')) return;
    try {
      const res = await authFetch(`${API_BASE}/api/anime/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Xóa thất bại');
      setStatusAnime({ ok: true, msg: `Anime "${editData.title}" đã xóa` });
      fetchAnimeList();
    } catch (err) {
      setStatusAnime({ ok: false, msg: err.message });
    }
  };

  const filtered = animeList.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <h3>Quản trị Anime</h3>
      <AdminAlert status={statusAnime} />
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
                    <label style={{ fontSize: 12 }}>Thể loại</label>
                    <input
                      value={editData.genre || ''}
                      onChange={e => setEditData({ ...editData, genre: e.target.value })}
                      style={{ fontSize: 12 }}
                      placeholder="Action, Romance, Fantasy..."
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
                  <p style={{ margin: '0 0 12px 0', color: '#9aa', fontSize: 12 }}>
                    Thể loại: {a.genre || '-'}
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

function UsersManagementPanel() {
  const [users, setUsers] = React.useState([]);
  const [allRoles, setAllRoles] = React.useState([]);
  const [allPermissions, setAllPermissions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [statusUsers, setStatusUsers] = React.useState(null);
  const [selectedUserId, setSelectedUserId] = React.useState(null);
  const [selectedUserData, setSelectedUserData] = React.useState(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/users`);
      if (!res.ok) throw new Error('Không thể lấy users');
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      setStatusUsers({ ok: false, msg: err.message });
    } finally { setLoading(false); }
  }

  async function fetchRoles() {
    try {
      const res = await authFetch(`${API_BASE}/api/admin/roles`);
      if (!res.ok) throw new Error('Không thể lấy roles');
      const data = await res.json();
      setAllRoles(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchPermissions() {
    try {
      const res = await authFetch(`${API_BASE}/api/admin/permissions`);
      if (!res.ok) throw new Error('Không thể lấy permissions');
      const data = await res.json();
      setAllPermissions(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  React.useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchPermissions();
  }, []);

  async function updateUserRole(userId, newRole) {
    setStatusUsers(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusUsers({ ok: true, msg: `Role cập nhật: ${data.username} → ${data.role}` });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
      if (selectedUserId === userId) setSelectedUserData({ ...selectedUserData, ...data });
    } catch (err) {
      setStatusUsers({ ok: false, msg: err.message });
    }
  }

  async function updateUserPermissions(userId, permissions) {
    setStatusUsers(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusUsers({ ok: true, msg: `Quyền đã cập nhật: ${data.username}` });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
      if (selectedUserId === userId) setSelectedUserData({ ...selectedUserData, ...data });
    } catch (err) {
      setStatusUsers({ ok: false, msg: err.message });
    }
  }

  async function deleteUser(userId, username) {
    if (!confirm(`Bạn chắc chắn muốn xóa user "${username}"?`)) return;
    setStatusUsers(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusUsers({ ok: true, msg: `Đã xóa user: ${username}` });
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setSelectedUserData(null);
      }
    } catch (err) {
      setStatusUsers({ ok: false, msg: err.message });
    }
  }

  return (
    <div>
      <AdminAlert status={statusUsers} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <h4>Danh sách người dùng</h4>
          {loading ? <p style={{ color: '#666' }}>Đang tải...</p> : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {users.map(u => (
                <div
                  key={u.id}
                  onClick={() => { setSelectedUserId(u.id); setSelectedUserData(u); }}
                  style={{
                    padding: '10px',
                    margin: '4px 0',
                    background: selectedUserId === u.id ? 'rgba(136, 238, 255, 0.2)' : '#0f0f1a',
                    border: selectedUserId === u.id ? '1px solid #8ef' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#8ef' }}>{u.username}</div>
                  <div style={{ color: '#aaa', fontSize: 11 }}>{u.role}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {selectedUserData ? (
            <div style={{ background: '#0f0f1a', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ marginTop: 0 }}>Chỉnh sửa</h4>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Name:</label>
                <input type="text" value={selectedUserData.username || ''} disabled style={{ opacity: 0.6 }} />
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Role:</label>
                <input type="text" value={selectedUserData.role || ''} disabled style={{ opacity: 0.6 }} />
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Vai trò:</label>
                <select
                  value={selectedUserData.role}
                  onChange={e => updateUserRole(selectedUserId, e.target.value)}
                  style={{ fontSize: 14 }}
                >
                  {allRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Quyền:</label>
                <div style={{ background: '#000', padding: 8, borderRadius: 4, maxHeight: '200px', overflowY: 'auto' }}>
                  {allPermissions.map(p => (
                    <label key={p.id} style={{ display: 'block', margin: '6px 0', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={(selectedUserData.permissions || []).includes(p.id)}
                        onChange={e => {
                          const newPerms = e.target.checked
                            ? [...(selectedUserData.permissions || []), p.id]
                            : (selectedUserData.permissions || []).filter(pid => pid !== p.id);
                          setSelectedUserData({ ...selectedUserData, permissions: newPerms });
                          updateUserPermissions(selectedUserId, newPerms);
                        }}
                      />
                      {' '}{p.name}
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="btn secondary"
                onClick={() => deleteUser(selectedUserId, selectedUserData.username)}
                style={{ marginTop: 12 }}
              >
                Xóa người dùng
              </button>
            </div>
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Chọn user để chỉnh sửa</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RolesManagementPanel() {
  const [roles, setRoles] = React.useState([]);
  const [permissions, setPermissions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [statusRole, setStatusRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState({ id: '', name: '', description: '', permissions: [] });
  const [editingRoleId, setEditingRoleId] = React.useState(null);

  async function fetchRoles() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/roles`);
      if (!res.ok) throw new Error('Không thể lấy roles');
      setRoles(await res.json());
    } catch (err) {
      setStatusRole({ ok: false, msg: err.message });
    } finally { setLoading(false); }
  }

  async function fetchPermissions() {
    try {
      const res = await authFetch(`${API_BASE}/api/admin/permissions`);
      if (!res.ok) throw new Error('Không thể lấy permissions');
      setPermissions(await res.json());
    } catch (err) {
      console.error(err);
    }
  }

  React.useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  async function createRole(e) {
    e.preventDefault();
    if (!newRole.id || !newRole.name) {
      setStatusRole({ ok: false, msg: 'ID và Name không được để trống' });
      return;
    }else if (roles.some(r => r.id === newRole.id) ) {
      setStatusRole({ ok: false, msg: 'ID đã tồn tại, chọn ID khác' });
      return;
    }else if (roles.some(r => r.name === newRole.name) ) {
      setStatusRole({ ok: false, msg: 'Name đã tồn tại, chọn Name khác' });
      return;
    }
    setStatusRole(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusRole({ ok: true, msg: `Role tạo: ${newRole.name}` });
      setRoles([...roles, data]);
      setNewRole({ id: '', name: '', description: '', permissions: [] });
    } catch (err) {
      setStatusRole({ ok: false, msg: err.message });
    }
  }

  async function updateRole(roleId, updates) {
    setStatusRole(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusRole({ ok: true, msg: `Role cập nhật: ${data.name}` });
      setRoles(prev => prev.map(r => r.id === roleId ? data : r));
      setEditingRoleId(null);
      setNewRole({ id: '', name: '', description: '', permissions: [] });
    } catch (err) {
      setStatusRole({ ok: false, msg: err.message });
    }
  }

  async function deleteRole(roleId, roleName) {
    if (!confirm(`Xóa vai trò "${roleName}"?`)) return;
    setStatusRole(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/roles/${roleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Thất bại');
      setStatusRole({ ok: true, msg: `Đã xóa vai trò: ${roleName}` });
      setRoles(prev => prev.filter(r => r.id !== roleId));
    } catch (err) {
      setStatusRole({ ok: false, msg: err.message });
    }
  }

  return (
    <div>
      <AdminAlert status={statusRole} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h4>Tạo Role Mới</h4>
          <form className="admin-form">
            <div className="form-row">
              <label>ID vai trò:</label>
              <input value={newRole.id} onChange={e => setNewRole({ ...newRole, id: e.target.value })} placeholder="vip2024" />
            </div>
            <div className="form-row">
              <label>Tên vai trò:</label>
              <input value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} placeholder="VIP 2024" />
            </div>
            <div className="form-row">
              <label>Mô tả:</label>
              <input value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })} placeholder="Mô tả..." />
            </div>
            <div className="form-row">
              <label>Quyền:</label>
              <div style={{ background: '#000', padding: 8, borderRadius: 4, maxHeight: '150px', overflowY: 'auto' }}>
                {permissions.map(p => (
                  <label key={p.id} style={{ display: 'block', margin: '4px 0', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={newRole.permissions.includes(p.id)}
                      onChange={e => setNewRole({
                        ...newRole,
                        permissions: e.target.checked
                          ? [...newRole.permissions, p.id]
                          : newRole.permissions.filter(pid => pid !== p.id)
                      })}
                    />
                    {' '}{p.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" onClick={editingRoleId ? () => updateRole(newRole.id, newRole) : createRole} className="btn" style={{ width: '100%' }}>➕ {editingRoleId ? 'Cập nhật Role' : 'Tạo Role'}</button>
          </form>
        </div>

        <div>
          <h4>Danh sách vai trò</h4>
          {loading ? <p style={{ color: '#666' }}>Đang tải...</p> : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {roles.map(r => (
                <div key={r.id} style={{ background: '#0f0f1a', padding: 12, margin: '8px 0', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontWeight: 'bold', color: r.is_system ? '#f88' : '#8ef', marginBottom: 4 }}>{r.name}</div>
                  <div style={{ color: '#aaa', fontSize: 11, marginBottom: 6 }}>{r.description}</div>
                  <div style={{ fontSize: 11, color: '#9a9', marginBottom: 6 }}>Số quyền: {r.permissions?.length || 0}</div>
                  {!r.is_system && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" onClick={() => {
                        if (editingRoleId === r.id) {
                          setEditingRoleId(null);
                          setNewRole({ ...newRole, id: '', name: '', description: '', permissions: [] });
                        } else {
                          setEditingRoleId(r.id);
                          setNewRole({ ...newRole, id: r.id , name: r.name, description: r.description, permissions: r.permissions || [] });
                        }
                      }} style={{ fontSize: 11, flex: 1 }}>
                        {editingRoleId === r.id ? '✕' : '✏️'}
                      </button>
                      <button className="btn secondary" onClick={() => deleteRole(r.id, r.name)} style={{ fontSize: 11, flex: 1 }}>🗑️</button>
                    </div>
                  )}
                  {r.is_system && <div style={{ fontSize: 11, color: '#f88' }}>Vai trò hệ thống</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionsManagementPanel() {
  const [permissions, setPermissions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [statusPerm, setStatusPerm] = React.useState(null);
  const [newPerm, setNewPerm] = React.useState({ id: '', name: '', description: '', category: 'custom' });

  async function fetchPermissions() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/permissions`);
      if (!res.ok) throw new Error('Không thể lấy permissions');
      setPermissions(await res.json());
    } catch (err) {
      setStatusPerm({ ok: false, msg: err.message });
    } finally { setLoading(false); }
  }

  React.useEffect(() => { fetchPermissions(); }, []);

  async function createPermission(e) {
    e.preventDefault();
    if (!newPerm.id || !newPerm.name) {
      setStatusPerm({ ok: false, msg: 'ID và Name không được để trống' });
      return;
    }
    setStatusPerm(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPerm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Thất bại');
      setStatusPerm({ ok: true, msg: `Permission tạo: ${newPerm.name}` });
      setPermissions([...permissions, data]);
      setNewPerm({ id: '', name: '', description: '', category: 'custom' });
    } catch (err) {
      setStatusPerm({ ok: false, msg: err.message });
    }
  }

  async function deletePermission(permId, permName) {
    if (!confirm(`Xóa quyền "${permName}"?`)) return;
    setStatusPerm(null);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/permissions/${permId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Thất bại');
      setStatusPerm({ ok: true, msg: `Đã xóa quyền: ${permName}` });
      setPermissions(prev => prev.filter(p => p.id !== permId));
    } catch (err) {
      setStatusPerm({ ok: false, msg: err.message });
    }
  }

  return (
    <div>
      <AdminAlert status={statusPerm} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h4>Tạo Permission Mới</h4>
          <form onSubmit={createPermission} className="admin-form">
            <div className="form-row">
              <label>ID quyền:</label>
              <input value={newPerm.id} onChange={e => setNewPerm({ ...newPerm, id: e.target.value })} placeholder="view_special_content" />
            </div>
            <div className="form-row">
              <label>Tên quyền:</label>
              <input value={newPerm.name} onChange={e => setNewPerm({ ...newPerm, name: e.target.value })} placeholder="Xem nội dung đặc biệt" />
            </div>
            <div className="form-row">
              <label>Mô tả:</label>
              <input value={newPerm.description} onChange={e => setNewPerm({ ...newPerm, description: e.target.value })} placeholder="Mô tả..." />
            </div>
            <div className="form-row">
              <label>Danh mục:</label>
              <select value={newPerm.category} onChange={e => setNewPerm({ ...newPerm, category: e.target.value })}>
                <option value="content">Nội dung</option>
                <option value="admin">Quản trị</option>
                <option value="user">Người dùng</option>
                <option value="access">Truy cập</option>
                <option value="custom">Tùy chỉnh</option>
              </select>
            </div>
            <button type="submit" className="btn" style={{ width: '100%' }}>➕ Tạo Permission</button>
          </form>
        </div>

        <div>
          <h4>Danh sách quyền</h4>
          {loading ? <p style={{ color: '#666' }}>Đang tải...</p> : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {permissions.map(p => (
                <div key={p.id} style={{ background: '#0f0f1a', padding: 12, margin: '8px 0', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontWeight: 'bold', color: '#8ef', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>{p.description}</div>
                  <div style={{ fontSize: 11, color: '#9a9', marginBottom: 6 }}>📂 {p.category}</div>
                  <button className="btn secondary" onClick={() => deletePermission(p.id, p.name)} style={{ fontSize: 11, width: '100%' }}>🗑️ Xóa</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

