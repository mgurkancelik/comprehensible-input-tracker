import { useState } from "react";
import EmptyState from "./ui/EmptyState";
import LibraryPosterGrid from "./LibraryPosterGrid";

const STATUS_TABS = [
  { value: "İzleyecekler", label: "İzleyeceğim" },
  { value: "İzleniyor", label: "İzliyorum" },
  { value: "İzlediklerim", label: "İzledim" },
];

// Üç sekmenin de artık kendi empty-state başlığı/açıklaması var — "İçerikleri
// Keşfet" aksiyonu (mevcut) her üçünde de uygun, çünkü hepsi "henüz içerik
// yok, Keşfet'ten ekle" durumunu anlatıyor.
const EMPTY_STATE_CONTENT = {
  İzleyecekler: {
    title: "İzleme listende henüz içerik yok.",
    description:
      "Daha sonra izlemek istediğin film, dizi veya animeleri eklediğinde burada görünecek.",
  },
  İzleniyor: {
    title: "Şu anda izlediğin bir içerik yok.",
    description: "İzlemeye başladığın içerikler burada görünecek.",
  },
  İzlediklerim: {
    title: "Henüz izlediğin bir içerik yok.",
    description: "İzlediğin film, dizi veya animeleri eklediğinde burada görünecek.",
  },
};

function LibraryPage({
  searchText,
  setSearchText,
  selectedType,
  setSelectedType,
  watchLaterList,
  watchingList,
  completedList,
  onOpenContentDetail,
  onNavigateToDiscover,
}) {
  const [activeTab, setActiveTab] = useState("İzleyecekler");

  const listByStatus = {
    İzleyecekler: watchLaterList,
    İzleniyor: watchingList,
    İzlediklerim: completedList,
  };

  const activeList = listByStatus[activeTab];
  const emptyContent = EMPTY_STATE_CONTENT[activeTab];

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

      <h3 className="watched-section-title">
        {STATUS_TABS.find((tab) => tab.value === activeTab)?.label} ({activeList.length})
      </h3>

      {activeList.length === 0 ? (
        <EmptyState
          title={emptyContent.title}
          description={emptyContent.description}
          action={
            onNavigateToDiscover ? (
              <button
                type="button"
                className="card-notes-btn"
                onClick={onNavigateToDiscover}
              >
                İçerikleri Keşfet
              </button>
            ) : null
          }
        />
      ) : (
        <LibraryPosterGrid
          items={activeList}
          status={activeTab}
          onOpenDetail={onOpenContentDetail}
        />
      )}
    </section>
  );
}

export default LibraryPage;
