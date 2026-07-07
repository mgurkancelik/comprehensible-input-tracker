function ContentForm({
  form,
  handleChange,
  addContent,
  showSearch,
  setShowSearch,
  fetchShowInfo,
  isFetchingShow,
  markAllInForm,
  showSearchFeedback,
}) {
  return (
    <section className="form-section">
      <div className="page-title">
        <h2>Hızlı İçerik Ekle</h2>
        <p>
          Dizi adını yaz, bilgileri otomatik çek, sonra input takibine ekle.
        </p>
      </div>

      <div className="quick-fill-panel">
        <p className="quick-fill-label">Hızlı Doldur</p>
        <p className="form-hint">
          Dizi adını yazıp bilgileri otomatik çekebilir, ardından formu
          tamamlayabilirsin.
        </p>

        <div className="api-search">
          <label className="visually-hidden" htmlFor="showSearch">
            Dizi adı ile bilgi çek
          </label>
          <input
            id="showSearch"
            value={showSearch}
            onChange={(e) => setShowSearch(e.target.value)}
            placeholder="Dizi adı yaz: Breaking Bad"
          />

          <button
            type="button"
            onClick={fetchShowInfo}
            disabled={isFetchingShow}
          >
            {isFetchingShow ? "Çekiliyor..." : "Bilgileri Çek"}
          </button>
        </div>

        {showSearchFeedback && (
          <p
            className={`form-search-feedback form-search-feedback--${showSearchFeedback.type}`}
          >
            {showSearchFeedback.type === "success" ? "✓" : "⚠️"}{" "}
            {showSearchFeedback.text}
          </p>
        )}
      </div>

      <form onSubmit={addContent} className="content-form">
        <fieldset className="form-fieldset">
          <legend className="fieldset-legend">İçerik Bilgisi</legend>

          <div className="field-grid field-grid--primary">
            <label className="field" htmlFor="title">
              <span className="field-label">İçerik adı</span>
              <input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="İçerik adı"
              />
            </label>

            <label className="field" htmlFor="type">
              <span className="field-label">Tür</span>
              <select id="type" name="type" value={form.type} onChange={handleChange}>
                <option>Dizi</option>
                <option>Film</option>
                <option>Animasyon</option>
                <option>Anime</option>
                <option>YouTube</option>
                <option>Podcast</option>
              </select>
            </label>

            <label className="field" htmlFor="status">
              <span className="field-label">Durum</span>
              <select id="status" name="status" value={form.status} onChange={handleChange}>
                <option>İzleyecekler</option>
                <option>İzleniyor</option>
                <option>İzlediklerim</option>
              </select>
            </label>
          </div>
        </fieldset>

        <details className="advanced-fields" open>
          <summary className="advanced-fields-summary">
            Detayları Düzenle (tarih, bölüm, kelime bilgisi)
          </summary>

          <fieldset className="form-fieldset">
            <legend className="fieldset-legend">Tarih Bilgisi</legend>

            <div className="field-grid field-grid--dates">
              <label className="field" htmlFor="startDate">
                <span className="field-label">Başlangıç tarihi</span>
                <input
                  id="startDate"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  type="date"
                />
              </label>

              <label className="field" htmlFor="targetEndDate">
                <span className="field-label">Hedef bitiş tarihi</span>
                <input
                  id="targetEndDate"
                  name="targetEndDate"
                  value={form.targetEndDate}
                  onChange={handleChange}
                  type="date"
                />
              </label>

              <label className="field" htmlFor="completedDate">
                <span className="field-label">Gerçek bitiş tarihi</span>
                <input
                  id="completedDate"
                  name="completedDate"
                  value={form.completedDate}
                  onChange={handleChange}
                  type="date"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend className="fieldset-legend">
              Bölüm ve Kelime Bilgisi
            </legend>

            <div className="field-grid">
              <label className="field" htmlFor="totalEpisodes">
                <span className="field-label">Toplam bölüm</span>
                <input
                  id="totalEpisodes"
                  name="totalEpisodes"
                  value={form.totalEpisodes}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  placeholder="Toplam bölüm"
                />
              </label>

              <div className="field">
                <span className="field-label">İzlenen bölüm</span>
                <div className="inline-field">
                  <input
                    id="watchedEpisodes"
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
              </div>

              <label className="field" htmlFor="minutesPerEpisode">
                <span className="field-label">Bölüm süresi (dk)</span>
                <input
                  id="minutesPerEpisode"
                  name="minutesPerEpisode"
                  value={form.minutesPerEpisode}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  placeholder="Bölüm süresi/dk"
                />
              </label>

              <label className="field" htmlFor="wordsPerEpisode">
                <span className="field-label">Kelime / bölüm</span>
                <input
                  id="wordsPerEpisode"
                  name="wordsPerEpisode"
                  value={form.wordsPerEpisode}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  placeholder="Kelime/bölüm"
                />
              </label>
            </div>
          </fieldset>
        </details>

        <div className="form-submit-row">
          <button type="submit">Ekle</button>
        </div>
      </form>
    </section>
  );
}

export default ContentForm;
