import { useEffect, useState } from "react";
import { getSeriesDetails, getSeasonDetails } from "../services/tmdb";

function ContentDetailModal({
  item,
  isAdded,
  onAdd,
  onClose,
  contents,
  onSyncSeriesTotalEpisodes,
  onSyncSeasonEpisodes,
  onToggleEpisodeWatched,
}) {
  const isSeries = item?.mediaType === "tv";
  const rawSeriesId = item?.id ? item.id.split("-").pop() : null;

  const [seasons, setSeasons] = useState([]);
  const [seasonsStatus, setSeasonsStatus] = useState("idle");
  const [seasonsError, setSeasonsError] = useState("");

  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesStatus, setEpisodesStatus] = useState("idle");
  const [episodesError, setEpisodesError] = useState("");

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

  const estimatedWords = Math.round((item.minutesPerEpisode || 0) * 120);

  const savedContent = isSeries
    ? (contents || []).find((content) => content.sourceId === item.id)
    : null;

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
              <span>Tahmini Süre</span>
              <strong>{item.minutesPerEpisode} dk</strong>
            </div>

            <div className="modal-stat">
              <span>Tahmini Kelime</span>
              <strong>{estimatedWords.toLocaleString("tr-TR")}</strong>
            </div>
          </div>

          <p className="modal-level-note">
            Bu seviye tür ve içerik bilgilerine göre tahmini olarak
            belirlenmiştir.
          </p>

          <p className="modal-overview">{item.overview}</p>

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
                        <p className="modal-season-status modal-season-progress">
                          {selectedSeasonNumber === 0
                            ? "Özel Bölümler"
                            : `Sezon ${selectedSeasonNumber}`}{" "}
                          — {watchedInSelectedSeason}/{episodes.length}{" "}
                          izlendi
                        </p>
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

          <div className="modal-actions">
            <button
              type="button"
              className={`modal-add-btn${isAdded ? " modal-add-btn--added" : ""}`}
              onClick={onAdd}
              disabled={isAdded}
            >
              {isAdded ? "✓ Eklendi" : "İzleyecekler Listeme Ekle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentDetailModal;
