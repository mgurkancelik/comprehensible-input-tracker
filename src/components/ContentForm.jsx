import { useRef } from "react";
import Button from "./ui/Button";
import TmdbMatchPicker from "./TmdbMatchPicker";

function ContentForm({
  form,
  handleChange,
  addContent,
  markAllInForm,
  tmdbMatch,
  onTmdbMatchSelect,
  onClearTmdbMatch,
  tmdbManualOverride,
  onTmdbManualContinue,
  tmdbSearchTrigger,
  showTmdbDecision,
  onTmdbDecisionSearch,
  onTmdbDecisionManual,
  isSavingContent,
}) {
  const isMovie = form.type === "Film";
  const titleInputRef = useRef(null);

  return (
    <section className="form-section">
      <div className="page-title">
        <h2>Hızlı İçerik Ekle</h2>
        <p>
          İçerik adını yaz, "Hızlı doldur" ile TMDb'den bilgileri getir, sonra
          input takibine ekle.
        </p>
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
                ref={titleInputRef}
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

        <TmdbMatchPicker
          type={form.type}
          title={form.title}
          selectedMatch={tmdbMatch}
          onSelect={onTmdbMatchSelect}
          onClear={onClearTmdbMatch}
          manualOverride={tmdbManualOverride}
          onManualContinue={onTmdbManualContinue}
          searchTrigger={tmdbSearchTrigger}
          onRequestTitleFocus={() => titleInputRef.current?.focus()}
        />

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

        {showTmdbDecision && (
          <div className="tmdb-decision-panel" role="alert">
            <p className="tmdb-decision-text">
              Bu içeriği TMDb ile eşleştirmeden ekliyorsun. Eşleştirmeden
              eklersen detaylı sezon ve bölüm yönetimi kullanılamaz.
            </p>

            <div className="tmdb-decision-actions">
              <Button type="button" variant="primary" onClick={onTmdbDecisionSearch}>
                TMDb&apos;de ara
              </Button>

              <Button type="button" variant="secondary" onClick={onTmdbDecisionManual}>
                Manuel ekle
              </Button>
            </div>
          </div>
        )}

        <div className="form-submit-row">
          <Button
            type="submit"
            loading={isSavingContent}
            loadingLabel="Kaydediliyor..."
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
