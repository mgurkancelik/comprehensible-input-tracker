import Button from "./ui/Button";

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
  const isMovie = form.type === "Film";

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
          <span className="search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M11 11L14.5 14.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
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
              {!isMovie && (
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
              )}

              {!isMovie && (
                <div className="field">
                  <div className="field-label-row">
                    <span className="field-label">İzlenen bölüm</span>
                    <button
                      type="button"
                      className="field-label-action"
                      onClick={markAllInForm}
                    >
                      Tümünü seç
                    </button>
                  </div>
                  <input
                    id="watchedEpisodes"
                    name="watchedEpisodes"
                    value={form.watchedEpisodes}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    placeholder="İzlenen bölüm"
                  />
                </div>
              )}

              <label className="field" htmlFor="minutesPerEpisode">
                <span className="field-label">
                  {isMovie ? "Film süresi (dakika)" : "Bölüm süresi (dk)"}
                </span>
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
          <Button
            type="submit"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 2.5V13.5M2.5 8H13.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            İçerik ekle
          </Button>
        </div>
      </form>
    </section>
  );
}

export default ContentForm;
