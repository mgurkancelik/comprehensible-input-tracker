import { useEffect, useRef, useState } from "react";
import { getSeriesDetails, getSeasonDetails, getMovieDetails } from "../services/tmdb";
import { getTmdbTvId, getTmdbMovieId, normalizeRuntimeMinutes } from "../utils/contentIdentity";
import { getContentTotalMinutes, formatMinutesLabel, formatDateLabel } from "../utils/stats";

const STATUS_OPTIONS = [
  { value: "İzleyecekler", label: "İzleyeceğim" },
  { value: "İzleniyor", label: "İzliyorum" },
  { value: "İzlediklerim", label: "İzledim" },
];

function ContentDetailModal({
  item,
  isAdded,
  onAdd,
  onClose,
  contents,
  updatingContentId,
  onSyncSeriesTotalEpisodes,
  onSyncSeasonEpisodes,
  onToggleEpisodeWatched,
  onToggleSeasonWatched,
  onSyncMovieRuntime,
  onEditNotes,
  onDeleteContent,
  onSaveDates,
  onWatchOneEpisode,
  onMarkAllWatched,
}) {
  const isSeries = item?.mediaType === "tv";
  // Güvensiz `item.id.split("-").pop()` yerine: yalnızca content.tmdbId
  // (sayısal) veya tam "tmdb-tv-<sayı>" formatındaki sourceId kabul edilir.
  // Bu, MongoDB ObjectId'lerinin veya Date.now() id'lerinin sonundaki
  // rakamların yanlışlıkla TMDb id'si sanılmasını engeller.
  const rawSeriesId = getTmdbTvId({
    mediaType: item?.mediaType,
    sourceId: item?.id,
    tmdbId: item?.tmdbId,
  });

  const isMovie = item?.mediaType === "movie";
  const rawMovieId = getTmdbMovieId({
    mediaType: item?.mediaType,
    sourceId: item?.id,
    tmdbId: item?.tmdbId,
  });

  // Keşfet grid'i (liste/arama endpoint'leri runtime döndürmediği için)
  // film süresini tahmin etmiyor artık (bkz. utils/level.js) — gerçek
  // TMDb runtime'ı yalnızca burada, içerik gerçekten açıldığında, tek bir
  // istekle (getMovieDetails) çekilir.
  const [movieRuntime, setMovieRuntime] = useState(null);
  const [movieRuntimeStatus, setMovieRuntimeStatus] = useState("idle");

  useEffect(() => {
    if (!isMovie || !rawMovieId) {
      return;
    }

    let isCancelled = false;

    const loadMovieRuntime = async () => {
      setMovieRuntimeStatus("loading");

      try {
        const details = await getMovieDetails(rawMovieId);

        if (isCancelled) {
          return;
        }

        setMovieRuntime(normalizeRuntimeMinutes(details.runtime));
        setMovieRuntimeStatus("success");
      } catch {
        if (isCancelled) {
          return;
        }

        setMovieRuntimeStatus("error");
      }
    };

    loadMovieRuntime();

    return () => {
      isCancelled = true;
    };
  }, [isMovie, rawMovieId]);

  // Yukarıdaki fetch yalnızca bu modal'ın LOCAL state'ini doldurur — MongoDB
  // Content kaydına hiç yazmaz. Bu içerik zaten kütüphanede kayıtlıysa
  // (backendContentId var) ve kayıtlı süresi hâlâ eksikse (0/null), gerçek
  // runtime bulunur bulunmaz App.jsx'teki dar kapsamlı sync akışına (bkz.
  // syncMovieRuntime) bir kez bildirilir — kalıcı hâle gelsin diye. Aynı
  // (backendContentId) için tekrar tekrar istek atılmaması syncedContentIdsRef
  // ile garanti edilir; App.jsx tarafı da ayrıca "zaten süresi var mı"
  // kontrolü yapar (çift güvence).
  const syncedContentIdsRef = useRef(new Set());

  useEffect(() => {
    if (
      !isMovie ||
      movieRuntimeStatus !== "success" ||
      !movieRuntime ||
      !onSyncMovieRuntime
    ) {
      return;
    }

    const savedContentForSync = (contents || []).find(
      (content) => content.sourceId === item?.id
    );

    const backendContentId = savedContentForSync?.backendContentId;
    const hasPersistedRuntime = Number(savedContentForSync?.minutesPerEpisode) > 0;

    if (!backendContentId || hasPersistedRuntime) {
      return;
    }

    const syncKey = String(backendContentId);

    if (syncedContentIdsRef.current.has(syncKey)) {
      return;
    }

    syncedContentIdsRef.current.add(syncKey);
    onSyncMovieRuntime(backendContentId, rawMovieId, movieRuntime);
  }, [isMovie, movieRuntimeStatus, movieRuntime, rawMovieId, contents, item?.id, onSyncMovieRuntime]);

  const [seasons, setSeasons] = useState([]);
  const [seasonsStatus, setSeasonsStatus] = useState("idle");
  const [seasonsError, setSeasonsError] = useState("");

  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesStatus, setEpisodesStatus] = useState("idle");
  const [episodesError, setEpisodesError] = useState("");

  // "Detayları Düzenle" tarih formu — App.jsx'e hiç network isteği atmadan
  // yalnızca yerel taslak tutar. Kaydet'e basılana kadar hiçbir PUT gitmez.
  // Input'tan gelen "YYYY-MM-DD" değeri (tarayıcının <input type="date">
  // ürettiği ham metin) hiçbir zaman bir Date nesnesine çevrilip geri
  // okunmaz — bu yüzden timezone kaynaklı gün kayması riski yoktur.
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState("");
  const [finishDateDraft, setFinishDateDraft] = useState("");
  const [dateValidationError, setDateValidationError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!isSeries || !rawSeriesId) {
      return;
    }

    let isCancelled = false;

    const loadSeasons = async () => {
      setSeasonsStatus("loading");
      setSeasonsError("");

      try {
        const details = await getSeriesDetails(rawSeriesId);

        if (isCancelled) {
          return;
        }

        const validSeasons = (details.seasons || []).filter(
          (season) => season.episode_count > 0
        );

        const sortedSeasons = [
          ...validSeasons.filter((season) => season.season_number !== 0),
          ...validSeasons.filter((season) => season.season_number === 0),
        ];

        setSeasons(sortedSeasons);
        setSeasonsStatus("success");

        const defaultSeason =
          sortedSeasons.find((season) => season.season_number !== 0) ||
          sortedSeasons[0];

        setSelectedSeasonNumber(
          defaultSeason ? defaultSeason.season_number : null
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSeasonsError(
          error.message || "Sezon bilgileri yüklenirken bir sorun oluştu."
        );
        setSeasonsStatus("error");
      }
    };

    loadSeasons();

    return () => {
      isCancelled = true;
    };
  }, [isSeries, rawSeriesId]);

  useEffect(() => {
    if (!isSeries || !rawSeriesId || selectedSeasonNumber === null) {
      return;
    }

    let isCancelled = false;

    const loadEpisodes = async () => {
      setEpisodesStatus("loading");
      setEpisodesError("");

      try {
        const seasonData = await getSeasonDetails(
          rawSeriesId,
          selectedSeasonNumber
        );

        if (isCancelled) {
          return;
        }

        setEpisodes(seasonData.episodes || []);
        setEpisodesStatus("success");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setEpisodesError(
          error.message || "Bölüm bilgileri yüklenirken bir sorun oluştu."
        );
        setEpisodesStatus("error");
      }
    };

    loadEpisodes();

    return () => {
      isCancelled = true;
    };
  }, [isSeries, rawSeriesId, selectedSeasonNumber]);

  // Sezon listesi geldiğinde (veya kullanıcı içeriği modal açıkken listeye
  // eklediğinde), diziye ait gerçek toplam bölüm sayısını App.jsx'e bildirir.
  // "contents" veya callback prop'ları dependency'e alınmıyor — sadece
  // isAdded/seasonsStatus/item.id değişince tetiklenir (döngü riski yok).
  useEffect(() => {
    if (!isAdded || seasonsStatus !== "success" || !onSyncSeriesTotalEpisodes) {
      return;
    }

    const totalEpisodeCount = seasons
      .filter((season) => season.season_number !== 0)
      .reduce((sum, season) => sum + (season.episode_count || 0), 0);

    if (totalEpisodeCount > 0) {
      onSyncSeriesTotalEpisodes(item.id, totalEpisodeCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdded, seasonsStatus, item?.id]);

  // Bir sezonun bölümleri geldiğinde (veya içerik modal açıkken listeye
  // eklendiğinde) o sezonu content.seasons'a senkronlar.
  useEffect(() => {
    if (
      !isAdded ||
      episodesStatus !== "success" ||
      selectedSeasonNumber === null ||
      !onSyncSeasonEpisodes
    ) {
      return;
    }

    const currentSeason = seasons.find(
      (season) => season.season_number === selectedSeasonNumber
    );

    const seasonName =
      currentSeason?.name ||
      (selectedSeasonNumber === 0 ? "Özel Bölümler" : `Sezon ${selectedSeasonNumber}`);

    onSyncSeasonEpisodes(item.id, selectedSeasonNumber, seasonName, episodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdded, episodesStatus, selectedSeasonNumber, item?.id]);

  if (!item) {
    return null;
  }

  // Film için: Keşfet grid'inden gelen item.minutesPerEpisode artık hiçbir
  // zaman tahmini bir sayı değil — ya gerçek TMDb runtime'ı (yukarıdaki
  // fetch başarılıysa movieRuntime) ya da null'dur. Dizi için mevcut
  // (tahmini olarak açıkça etiketlenen) minutesPerEpisode kullanılmaya
  // devam eder.
  const displayMinutes = isMovie ? movieRuntime : item.minutesPerEpisode;
  const estimatedWords =
    typeof displayMinutes === "number" ? Math.round(displayMinutes * 120) : null;

  const savedContent = (contents || []).find(
    (content) => content.sourceId === item.id
  );

  // Durum butonları yalnızca bu içerik için GERÇEKTEN bir güncelleme
  // isteği sürerken (App.jsx'teki updatingContentId) geçici olarak
  // disabled edilir — kalıcı/açıklanamayan bir inaktiflik durumu yoktur.
  const isUpdatingStatus =
    Boolean(savedContent) && updatingContentId === savedContent.id;

  const savedSeasonForSelected = savedContent?.seasons?.find(
    (season) => season.seasonNumber === selectedSeasonNumber
  );

  const watchedInSelectedSeason =
    savedSeasonForSelected?.episodes.filter((episode) => episode.watched)
      .length || 0;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const openDateEditor = () => {
    setStartDateDraft(savedContent?.startDate || "");
    setFinishDateDraft(savedContent?.completedDate || "");
    setDateValidationError("");
    setIsEditingDates(true);
  };

  const closeDateEditor = () => {
    setIsEditingDates(false);
    setDateValidationError("");
  };

  // Her iki tarih de doluysa başlangıç bitişten sonra olamaz — "YYYY-MM-DD"
  // formatındaki string'lerin doğrudan karşılaştırılması (Date'e çevirmeden)
  // kronolojik olarak doğru sonucu verir, timezone riski taşımaz.
  const handleSaveDates = async () => {
    setDateValidationError("");

    if (startDateDraft && finishDateDraft && startDateDraft > finishDateDraft) {
      setDateValidationError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }

    if (!savedContent || !onSaveDates || isUpdatingStatus) {
      return;
    }

    const result = await onSaveDates(savedContent.id, {
      startDate: startDateDraft,
      finishDate: finishDateDraft,
    });

    // Yalnızca gerçek bir hata durumunda ("error") form açık kalır ve
    // kullanıcının yazdığı değerler korunur — başarı veya "local"/"not_found"
    // gibi yerel state'in zaten güncellendiği durumlarda form kapanır.
    if (result?.status !== "error") {
      closeDateEditor();
    }
  };

  const totalEpisodesForQuickActions = Math.max(savedContent?.totalEpisodes || 0, 0);
  const watchedEpisodesForQuickActions = Math.min(
    Math.max(savedContent?.watchedEpisodes || 0, 0),
    totalEpisodesForQuickActions
  );
  const isSeasonTracked = Boolean(
    savedContent?.mediaType === "tv" &&
      savedContent?.seasons &&
      savedContent.seasons.length > 0
  );
  const quickEpisodeActionsDisabled =
    totalEpisodesForQuickActions <= 0 ||
    watchedEpisodesForQuickActions >= totalEpisodesForQuickActions;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-detail-title"
      >
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Kapat"
        >
          ✕
        </button>

        <div className="modal-poster">
          {item.posterUrl ? (
            <img src={item.posterUrl} alt={`${item.title} posteri`} />
          ) : (
            <div className="poster-fallback" aria-hidden="true">
              {item.type === "Dizi" ? "📺" : "🎬"}
            </div>
          )}
        </div>

        <div className="modal-body">
          <h2 id="content-detail-title">{item.title}</h2>

          <p className="modal-meta">
            {item.year} · {item.type} · {item.genre}
          </p>

          <div className="modal-stats">
            <div className="modal-stat">
              <span>TMDb Puanı</span>
              <strong>⭐ {(item.rating ?? 0).toFixed(1)}</strong>
            </div>

            <div className="modal-stat">
              <span>Tahmini Seviye</span>
              <strong>{item.estimatedLevel || "—"}</strong>
            </div>

            <div className="modal-stat">
              <span>{isMovie ? "Süre" : "Tahmini Süre"}</span>
              <strong>
                {isMovie && movieRuntimeStatus === "loading"
                  ? "Yükleniyor..."
                  : typeof displayMinutes === "number"
                  ? `${displayMinutes} dk`
                  : "—"}
              </strong>
            </div>

            <div className="modal-stat">
              <span>Tahmini Kelime</span>
              <strong>
                {estimatedWords !== null ? estimatedWords.toLocaleString("tr-TR") : "—"}
              </strong>
            </div>
          </div>

          <p className="modal-level-note">
            Bu seviye tür ve içerik bilgilerine göre tahmini olarak
            belirlenmiştir.
          </p>

          <p className="modal-overview">{item.overview}</p>

          {/* Kütüphanede zaten kayıtlı içerikler için: canonical durum/tarih/
              toplam input bilgisi. Tarih için tek canonical alan kullanılır —
              frontend completedDate (backend UserContent.finishDate'ten
              gelir, bkz. App.jsx mapUserContentToFrontendContent) — yeni bir
              tarih alanı üretilmez, sahte bir "bugün" asla gösterilmez.
              Toplam input, karttaki/Dashboard'daki/Takip Çizelgesi'ndeki ile
              AYNI tek kaynaktan (stats.js getContentTotalMinutes) gelir. */}
          {isAdded && savedContent && (
            <div className="modal-tracking-info">
              <p className="modal-tracking-line">
                Durum:{" "}
                {STATUS_OPTIONS.find((option) => option.value === savedContent.status)
                  ?.label || savedContent.status}
              </p>

              <p className="modal-tracking-line">
                {(() => {
                  const finishLabel = item.type === "Film" ? "İzlenme tarihi" : "Bitiş tarihi";
                  const formattedFinishDate = formatDateLabel(savedContent.completedDate);

                  return formattedFinishDate
                    ? `${finishLabel}: ${formattedFinishDate}`
                    : `${finishLabel} belirtilmedi.`;
                })()}
              </p>

              <p className="modal-tracking-line">
                Toplam input: {formatMinutesLabel(getContentTotalMinutes(savedContent))}
              </p>

              {savedContent.startDate && (
                <p className="modal-tracking-line">
                  Başlangıç tarihi:{" "}
                  {formatDateLabel(savedContent.startDate) || savedContent.startDate}
                </p>
              )}

              {savedContent.targetEndDate && (
                <p className="modal-tracking-line">
                  Hedef bitiş tarihi:{" "}
                  {formatDateLabel(savedContent.targetEndDate) ||
                    savedContent.targetEndDate}
                </p>
              )}

              <p className="modal-tracking-line modal-tracking-notes">
                {savedContent.notes ? `Not: ${savedContent.notes}` : "Henüz not eklenmedi."}
              </p>
            </div>
          )}

          {/* Detayları Düzenle: başlangıç ve bitiş/izlenme tarihi. Frontend
              canonical alanları (startDate, completedDate) App.jsx'teki
              mapUserContentToFrontendContent ile birebir aynı — yeni bir
              tarih alanı üretilmez. Kaydet, mevcut UserContent PUT akışını
              (onSaveDates → App.jsx updateContentDates → saveUserContentUpdate)
              kullanır; ownership/JWT App.jsx tarafında zaten korunuyor. */}
          {isAdded && savedContent && onSaveDates && (
            <div className="modal-edit-dates">
              <div className="modal-edit-dates-header">
                <p className="modal-status-label">Detayları Düzenle</p>

                <button
                  type="button"
                  className="card-notes-btn"
                  onClick={isEditingDates ? closeDateEditor : openDateEditor}
                >
                  {isEditingDates ? "Vazgeç" : "Tarihleri Düzenle"}
                </button>
              </div>

              {isEditingDates && (
                <div className="modal-edit-dates-form">
                  <label className="field" htmlFor="modal-start-date">
                    <span className="field-label">Başlangıç tarihi</span>
                    <input
                      id="modal-start-date"
                      type="date"
                      value={startDateDraft}
                      onChange={(event) => setStartDateDraft(event.target.value)}
                    />
                  </label>

                  <label className="field" htmlFor="modal-finish-date">
                    <span className="field-label">
                      {item.type === "Film" ? "İzlenme tarihi" : "Bitiş tarihi"}
                    </span>
                    <input
                      id="modal-finish-date"
                      type="date"
                      value={finishDateDraft}
                      onChange={(event) => setFinishDateDraft(event.target.value)}
                    />
                  </label>

                  {dateValidationError && (
                    <p className="modal-date-error" role="alert">
                      {dateValidationError}
                    </p>
                  )}

                  <div className="modal-secondary-actions">
                    <button type="button" className="card-notes-btn" onClick={closeDateEditor}>
                      Vazgeç
                    </button>

                    <button
                      type="button"
                      className="modal-status-btn modal-status-btn--active"
                      onClick={handleSaveDates}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Basit bölüm sayacı: TMDb sezon yönetimi (aşağıdaki Sezonlar
              bloğu) kullanılamayan veya henüz hiç açılmamış bölümlü içerikler
              (dizi/anime/podcast/YouTube) için "+1 bölüm izledim" / "Tümünü
              izledim" — eskiden geniş kart görünümünde (renderContentCard)
              bulunan, App.jsx'teki watchOneEpisode/markAllWatched mantığına
              hiç dokunulmadan buraya taşınan aynı aksiyon. */}
          {isAdded && savedContent && savedContent.type !== "Film" && (
            <div className="modal-episode-quick-actions">
              {!isSeries && (
                <p className="modal-tracking-line">
                  {watchedEpisodesForQuickActions} / {totalEpisodesForQuickActions} bölüm
                </p>
              )}

              <div className="modal-secondary-actions">
                {onWatchOneEpisode && (
                  <button
                    type="button"
                    className="card-notes-btn"
                    onClick={() => onWatchOneEpisode(savedContent.id)}
                    disabled={quickEpisodeActionsDisabled}
                  >
                    +1 bölüm izledim
                  </button>
                )}

                {onMarkAllWatched && !isSeasonTracked && (
                  <button
                    type="button"
                    className="card-notes-btn"
                    onClick={() => onMarkAllWatched(savedContent.id)}
                    disabled={quickEpisodeActionsDisabled}
                  >
                    Tümünü izledim
                  </button>
                )}
              </div>
            </div>
          )}

          {isSeries && (
            <div className="modal-seasons">
              <h3 className="modal-section-title">Sezonlar</h3>

              {isAdded && savedContent && savedContent.totalEpisodes > 0 && (
                <p className="modal-overall-progress">
                  Toplam ilerleme: {savedContent.watchedEpisodes}/
                  {savedContent.totalEpisodes} bölüm
                </p>
              )}

              {seasonsStatus === "loading" && (
                <p className="modal-season-status">Sezonlar yükleniyor...</p>
              )}

              {seasonsStatus === "error" && (
                <p className="modal-season-status">⚠️ {seasonsError}</p>
              )}

              {seasonsStatus === "success" && seasons.length === 0 && (
                <p className="modal-season-status">
                  Bu dizi için sezon bilgisi bulunamadı.
                </p>
              )}

              {seasonsStatus === "success" && seasons.length > 0 && (
                <>
                  <div className="filter-chip-row">
                    {seasons.map((season) => (
                      <button
                        key={season.season_number}
                        type="button"
                        className={
                          selectedSeasonNumber === season.season_number
                            ? "filter-chip filter-chip--active"
                            : "filter-chip"
                        }
                        aria-pressed={
                          selectedSeasonNumber === season.season_number
                        }
                        onClick={() =>
                          setSelectedSeasonNumber(season.season_number)
                        }
                      >
                        {season.season_number === 0
                          ? "Özel Bölümler"
                          : `Sezon ${season.season_number}`}
                      </button>
                    ))}
                  </div>

                  {!isAdded && (
                    <p className="modal-season-status">
                      Bölümleri izlendi olarak işaretlemek için önce
                      listene ekle.
                    </p>
                  )}

                  {episodesStatus === "loading" && (
                    <p className="modal-season-status">
                      Bölümler yükleniyor...
                    </p>
                  )}

                  {episodesStatus === "error" && (
                    <p className="modal-season-status">
                      ⚠️ {episodesError}
                    </p>
                  )}

                  {episodesStatus === "success" && episodes.length === 0 && (
                    <p className="modal-season-status">
                      Bu sezon için bölüm bilgisi bulunamadı.
                    </p>
                  )}

                  {episodesStatus === "success" && episodes.length > 0 && (
                    <>
                      {isAdded && savedContent && (
                        <div className="season-quick-actions">
                          <p className="modal-season-status modal-season-progress">
                            {selectedSeasonNumber === 0
                              ? "Özel Bölümler"
                              : `Sezon ${selectedSeasonNumber}`}{" "}
                            — {watchedInSelectedSeason}/{episodes.length}{" "}
                            izlendi
                          </p>

                          <button
                            type="button"
                            className="season-quick-action-btn"
                            onClick={() =>
                              onToggleSeasonWatched(
                                item.id,
                                selectedSeasonNumber,
                                watchedInSelectedSeason < episodes.length
                              )
                            }
                          >
                            {watchedInSelectedSeason >= episodes.length
                              ? "İşaretleri Kaldır"
                              : "Sezonu İzledim"}
                          </button>
                        </div>
                      )}

                      <ul className="episode-list">
                        {episodes.map((episode) => {
                          const episodeUid = `tmdb-episode-${episode.id}`;
                          const savedEpisode =
                            savedSeasonForSelected?.episodes.find(
                              (savedEp) => savedEp.id === episodeUid
                            );
                          const isWatched = savedEpisode?.watched || false;

                          return (
                            <li
                              className={`episode-item${
                                isWatched ? " episode-item--watched" : ""
                              }`}
                              key={episode.id ?? episode.episode_number}
                            >
                              <div className="episode-item-head">
                                <span className="episode-number-group">
                                  {isAdded && savedContent && (
                                    <input
                                      type="checkbox"
                                      className="episode-checkbox"
                                      checked={isWatched}
                                      onChange={() =>
                                        onToggleEpisodeWatched(
                                          item.id,
                                          selectedSeasonNumber,
                                          episodeUid
                                        )
                                      }
                                      aria-label={`${episode.episode_number}. bölümü izledim olarak işaretle`}
                                    />
                                  )}

                                  <span className="episode-number">
                                    {episode.episode_number}. Bölüm
                                  </span>
                                </span>

                                {episode.runtime ? (
                                  <span className="episode-runtime">
                                    {episode.runtime} dk
                                  </span>
                                ) : null}
                              </div>

                              <p className="episode-name">
                                {episode.name || "Başlıksız Bölüm"}
                              </p>

                              {episode.air_date && (
                                <p className="episode-air-date">
                                  {episode.air_date}
                                </p>
                              )}

                              {episode.overview && (
                                <p className="episode-overview">
                                  {episode.overview}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div className="modal-status-actions">
            <p className="modal-status-label">
              {isAdded ? "Durumu değiştir" : "Durum seç"}
            </p>

            <div className="modal-status-row">
              {STATUS_OPTIONS.map((option) => {
                const isActive = isAdded && savedContent?.status === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`modal-status-btn${
                      isActive ? " modal-status-btn--active" : ""
                    }`}
                    aria-pressed={isActive}
                    disabled={isUpdatingStatus}
                    onClick={() => onAdd(option.value)}
                  >
                    {isActive ? `✓ ${option.label}` : option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isAdded && savedContent && (onEditNotes || onDeleteContent) && (
            <div className="modal-secondary-actions">
              {onEditNotes && (
                <button
                  type="button"
                  className="card-notes-btn"
                  onClick={onEditNotes}
                >
                  {savedContent.notes ? "Notu Düzenle" : "Not Ekle"}
                </button>
              )}

              {onDeleteContent && (
                <button
                  type="button"
                  className="delete-btn"
                  onClick={onDeleteContent}
                >
                  Sil
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentDetailModal;
