function ContentForm({
  form,
  handleChange,
  addContent,
  showSearch,
  setShowSearch,
  fetchShowInfo,
  isFetchingShow,
  markAllInForm,
}) {
  return (
    <section className="form-section">
      <h2>Yeni İçerik Ekle</h2>

      <div className="api-search">
        <input
          value={showSearch}
          onChange={(e) => setShowSearch(e.target.value)}
          placeholder="Dizi adı yaz: Breaking Bad"
        />

        <button type="button" onClick={fetchShowInfo} disabled={isFetchingShow}>
          {isFetchingShow ? "Çekiliyor..." : "Bilgileri Çek"}
        </button>
      </div>

      <form onSubmit={addContent} className="content-form">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="İçerik adı"
        />

        <select name="type" value={form.type} onChange={handleChange}>
          <option>Dizi</option>
          <option>Film</option>
          <option>Animasyon</option>
          <option>Anime</option>
          <option>YouTube</option>
          <option>Podcast</option>
        </select>

        <select name="status" value={form.status} onChange={handleChange}>
          <option>İzleyecekler</option>
          <option>İzleniyor</option>
          <option>İzlediklerim</option>
        </select>

        <input
          name="startDate"
          value={form.startDate}
          onChange={handleChange}
          type="date"
        />

        <input
          name="targetEndDate"
          value={form.targetEndDate}
          onChange={handleChange}
          type="date"
        />

        <input
          name="completedDate"
          value={form.completedDate}
          onChange={handleChange}
          type="date"
        />

        <input
          name="totalEpisodes"
          value={form.totalEpisodes}
          onChange={handleChange}
          type="number"
          min="0"
          placeholder="Toplam bölüm"
        />

        <div className="inline-field">
          <input
            name="watchedEpisodes"
            value={form.watchedEpisodes}
            onChange={handleChange}
            type="number"
            min="0"
            placeholder="İzlenen bölüm"
          />

          <button type="button" onClick={markAllInForm}>
            Tümünü seç
          </button>
        </div>

        <input
          name="minutesPerEpisode"
          value={form.minutesPerEpisode}
          onChange={handleChange}
          type="number"
          min="0"
          placeholder="Bölüm süresi/dk"
        />

        <input
          name="wordsPerEpisode"
          value={form.wordsPerEpisode}
          onChange={handleChange}
          type="number"
          min="0"
          placeholder="Kelime/bölüm"
        />

        <button type="submit">Ekle</button>
      </form>
    </section>
  );
}

export default ContentForm;