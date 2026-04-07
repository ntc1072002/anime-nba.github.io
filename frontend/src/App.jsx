import React, { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Admin from "./pages/Admin.jsx";
import ReadView from "./pages/ReadView.jsx";
import WatchView from "./pages/WatchView.jsx";
import ReadChapterView from "./pages/ReadChapterView.jsx";
import Login from "./pages/Login.jsx";
import WatchEpisodeView from "./pages/WatchEpisodeView.jsx";
import MyLibrary from "./pages/MyLibrary.jsx";
import MobileBrowse from "./pages/MobileBrowse.jsx";
import BrowseManga from "./pages/BrowseManga.jsx";
import BrowseAnime from "./pages/BrowseAnime.jsx";

export default function App() {
  const [route, setRoute] = useState(window.location.hash || "#/" );
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/" );
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onResize = () => setIsMobile(mq.matches);
    onResize();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onResize);
      return () => mq.removeEventListener("change", onResize);
    }
    mq.addListener(onResize);
    return () => mq.removeListener(onResize);
  }, []);

  // parse route like '#/read/3' or '#/read/3/chapter/5'
  const seg = (route || "#/").slice(2).split('/');
  const page = seg[0] || '';
  const id = seg[1] || null;
  const sub = seg[2] || null;
  const subId = seg[3] || null;

  let Page = <BrowseManga />;
  if (isMobile && (page === "" || page === "manga")) Page = <MobileBrowse type="manga" />;
  else if (isMobile && page === "anime") Page = <MobileBrowse type="anime" />;
  else if (!isMobile && page === "manga") Page = <BrowseManga />;
  else if (!isMobile && page === "anime") Page = <BrowseAnime />;
  else if (page === 'admin') Page = <Admin />;
  else if (page === 'following') Page = <MyLibrary />;
  else if (page === 'read' && id && sub === 'chapter' && subId) Page = <ReadChapterView mangaId={id} chapterId={subId} />;
  else if (page === 'read' && id) Page = <ReadView id={id} />;
  else if (page === 'auth') Page = <Login />;
  else if (page === 'watch' && id && (sub === 'episode' || sub === 'episodes') && subId) Page = <WatchEpisodeView animeId={id} episodeId={subId} />;
  else if (page === 'watch' && id) Page = <WatchView id={id} />;

  return (
    <div>
      <div style={{ padding: 12 }}>
        <Header />
      </div>
      {Page}
      <div className="app-container">
        <Footer />
      </div>
    </div>
  );
}
