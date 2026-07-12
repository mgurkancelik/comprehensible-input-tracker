import { useState } from "react";
import EmptyState from "./ui/EmptyState";

const STATUS_TABS = [
  { value: "İzleyecekler", label: "İzleyeceğim" },
  { value: "İzleniyor", label: "İzliyorum" },
  { value: "İzlediklerim", label: "İzledim" },
];

const EMPTY_MESSAGES = {
  İzleyecekler:
    "Henüz izleyeceğin içerik yok. Keşfet sayfasından içerik ekleyebilirsin.",
  İzleniyor: "Şu an izlediğin bir dizi/film yok.",
  İzlediklerim: "Tamamladığın içerikler burada görünecek.",
};

function LibraryPage({
  searchText,
  setSearchText,
  selectedType,
  setSelectedType,
  watchLaterList,
  watchingList,
  completedList,
  renderContentCard,
}) {
  const [activeTab, setActiveTab] = useState("İzleyecekler");

  const listByStatus = {
    İzleyecekler: watchLaterList,
    İzleniyor: watchingList,
    İzlediklerim: completedList,
  };

  const activeList = listByStatus[activeTab];

  return (
    <section className="content-list">
      <div className="page-title">
        <h2>Kütüphanem</h2>
        <p>
          İzleyecekler, şu an izlediklerin ve tamamladığın tüm içerikler
          burada.
        </p>
      </div>

      <div className="filters">
        <label className="visually-hidden" htmlFor="content-search">
          İçerik ara
        </label>
        <input
          id="content-search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="İçerik ara..."
        />

        <label className="visually-hidden" htmlFor="content-type-filter">
          Türe göre filtrele
        </label>
        <select
          id="content-type-filter"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option>Tümü</option>
          <option>Dizi</option>
          <option>Film</option>
          <option>Animasyon</option>
          <option>Anime</option>
          <option>YouTube</option>
          <option>Podcast</option>
        </select>
      </div>

      <div className="library-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={activeTab === tab.value ? "nav-active" : ""}
            aria-current={activeTab === tab.value ? "page" : undefined}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label} ({listByStatus[tab.value].length})
          </button>
        ))}
      </div>

      {activeList.length === 0 ? (
        <EmptyState description={EMPTY_MESSAGES[activeTab]} />
      ) : (
        activeList.map(renderContentCard)
      )}
    </section>
  );
}

export default LibraryPage;
