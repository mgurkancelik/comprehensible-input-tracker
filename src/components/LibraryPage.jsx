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
  return (
    <section className="content-list">
      <div className="page-title">
        <h2>📚 Kütüphanem</h2>
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

      <h2>📌 İzleyeceğim</h2>
      {watchLaterList.length === 0 ? (
        <p className="empty-text">
          Henüz izleyecek bir içerik eklemedin. Keşfet sayfasından veya
          Dashboard'daki formdan ilk içeriğini ekleyerek input takibine
          başla! 🚀
        </p>
      ) : (
        watchLaterList.map(renderContentCard)
      )}

      <h2>▶️ İzliyorum</h2>
      {watchingList.length === 0 ? (
        <p className="empty-text">
          Şu an aktif izlediğin bir içerik yok. İzleyecekler listenden
          birini başlatarak ilerlemeye devam et.
        </p>
      ) : (
        watchingList.map(renderContentCard)
      )}

      <h2>✅ İzledim</h2>
      {completedList.length === 0 ? (
        <p className="empty-text">
          Henüz tamamlanan içerik yok. İlk içeriğini bitirdiğinde burada
          görünecek.
        </p>
      ) : (
        completedList.map(renderContentCard)
      )}
    </section>
  );
}

export default LibraryPage;
