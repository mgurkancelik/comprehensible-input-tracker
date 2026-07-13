import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import LoadingState from "./ui/LoadingState";
import ErrorState from "./ui/ErrorState";
import EmptyState from "./ui/EmptyState";
import {
  searchMovies,
  searchSeries,
  getSeriesDetails,
  getSeasonDetails,
  getMovieDetails,
  getImageUrl,
} from "../services/tmdb";
import { getMediaTypeFromContentType, buildTmdbSourceId } from "../utils/contentIdentity";

const MAX_RESULTS = 8;

// "Hızlı doldur": arama, sonuç gösterimi, eşleşme özeti ve seçim
// callback'inden sorumludur. Form submit veya MongoDB kaydı bu component'e
// hiç girmez — seçilen eşleşme App.jsx'teki applyTmdbMatch'e teslim edilir,
// orada form state'ine işlenir.
function TmdbMatchPicker({
  type,
  title,
  selectedMatch,
  onSelect,
  onClear,
  manualOverride,
  onManualContinue,
  searchTrigger,
  onRequestTitleFocus,
}) {
  const mediaType = getMediaTypeFromContentType(type);
  const isSupported = Boolean(mediaType);
  const trimmedTitle = (title || "").trim();

  const [results, setResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [applyingResultId, setApplyingResultId] = useState(null);
  const [isChangingMatch, setIsChangingMatch] = useState(false);

  const statusRegionRef = useRef(null);

  // Tür, TMDb'nin desteklemediği bir değere değişince eski sonuçları
  // göstermeye devam etmemek için sıfırla (örn. Dizi sonuçlarıyken
  // Podcast'e geçilmesi).
  useEffect(() => {
    setResults([]);
    setSearchStatus("idle");
    setErrorMessage("");
  }, [mediaType]);

  // Başlık boşalınca (örn. başarılı kayıt sonrası form sıfırlanınca) eski
  // sonuçların ekranda asılı kalmaması için sıfırla.
  useEffect(() => {
    if (trimmedTitle.length === 0) {
      setResults([]);
      setSearchStatus("idle");
      setErrorMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedTitle.length === 0]);

  const isBusy = searchStatus === "loading" || applyingResultId !== null;

  const handleSearch = async () => {
    if (!isSupported || isBusy) {
      return;
    }

    if (trimmedTitle.length === 0) {
      setSearchStatus("titleRequired");
      onRequestTitleFocus?.();
      return;
    }

    setSearchStatus("loading");
    setErrorMessage("");

    // Yumuşak bir kaydırma: kullanıcı "Hızlı doldur"a bastığında sonuç
    // alanı ekran dışındaysa göze batmayan biçimde görünür hâle getirilir.
    // Ani bir sayfa sıçraması olmasın diye smooth + "nearest" kullanılır.
    statusRegionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
      const rawResults =
        mediaType === "movie"
          ? await searchMovies(trimmedTitle)
          : await searchSeries(trimmedTitle);

      const normalized = (rawResults || []).slice(0, MAX_RESULTS).map((result) => ({
        id: result.id,
        title: result.title || result.name || "Başlıksız",
        year: (result.release_date || result.first_air_date || "").slice(0, 4) || null,
        overview: result.overview || "",
        posterUrl: getImageUrl(result.poster_path),
        rating: typeof result.vote_average === "number" ? result.vote_average : null,
      }));

      setResults(normalized);
      setSearchStatus(normalized.length > 0 ? "success" : "empty");
    } catch (error) {
      setErrorMessage(error.message || "TMDb sonuçları yüklenemedi.");
      setSearchStatus("error");
    }
  };

  // Dışarıdan (submit öncesi inline karar alanındaki "TMDb'de ara") tetiklenen
  // arama: searchTrigger değeri her değiştiğinde (0 hariç) aynı handleSearch
  // çağrılır — ayrı bir ikinci arama mantığı yazılmaz.
  useEffect(() => {
    if (searchTrigger) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTrigger]);

  const handleChangeMatch = () => {
    setIsChangingMatch(true);
    handleSearch();
  };

  const handleClear = () => {
    setIsChangingMatch(false);
    onClear();
  };

  // Seçim sonrası, mümkünse mevcut detay servisinden (getSeriesDetails /
  // getMovieDetails) arama sonucu listesinde bulunmayan totalEpisodes/
  // runtime bilgisini çeker. Detay isteği başarısız olursa eşleştirmenin
  // kendisi engellenmez — yalnızca zenginleştirme alanları boş kalır.
  const handleSelect = async (result) => {
    if (applyingResultId !== null) {
      return;
    }

    setApplyingResultId(result.id);

    const sourceId = buildTmdbSourceId(mediaType, result.id);

    const baseMatch = {
      tmdbId: result.id,
      sourceId,
      mediaType,
      title: result.title,
      posterUrl: result.posterUrl || "",
      overview: result.overview || "",
      releaseYear: result.year ? Number(result.year) : null,
      tmdbRating: result.rating,
    };

    let enrichment = {};

    try {
      if (mediaType === "tv") {
        const details = await getSeriesDetails(result.id);

        let seriesMinutesPerEpisode =
          Array.isArray(details.episode_run_time) &&
          typeof details.episode_run_time[0] === "number" &&
          details.episode_run_time[0] > 0
            ? details.episode_run_time[0]
            : null;

        // TMDb'nin tv details endpoint'indeki `episode_run_time` alanı çoğu
        // güncel dizide artık boş dizi dönüyor (deprecated). Güvenilir bir
        // fallback olarak ilk normal sezonun (season_number !== 0) gerçek
        // bölüm runtime'larının ortalaması alınır — aynı hesap yöntemi
        // App.jsx'teki computeAverageRuntime'ın kullandığı gerçek TMDb
        // verisiyle aynı kaynaktır, tahmini/sabit bir sayı DEĞİLDİR.
        if (seriesMinutesPerEpisode === null) {
          const firstRegularSeason = (details.seasons || []).find(
            (season) => season.season_number !== 0 && season.episode_count > 0
          );

          if (firstRegularSeason) {
            try {
              const seasonDetails = await getSeasonDetails(
                result.id,
                firstRegularSeason.season_number
              );

              const runtimes = (seasonDetails.episodes || [])
                .map((episode) => episode.runtime)
                .filter((runtime) => typeof runtime === "number" && runtime > 0);

              if (runtimes.length > 0) {
                seriesMinutesPerEpisode = Math.round(
                  runtimes.reduce((sum, runtime) => sum + runtime, 0) / runtimes.length
                );
              }
            } catch {
              // Fallback isteği başarısız olursa minutesPerEpisode null kalır
              // — eşleştirmenin kendisi bundan etkilenmez, kullanıcı elle
              // girebilir.
            }
          }
        }

        enrichment = {
          totalEpisodes:
            Number.isInteger(details.number_of_episodes) && details.number_of_episodes > 0
              ? details.number_of_episodes
              : null,
          minutesPerEpisode: seriesMinutesPerEpisode,
        };
      } else {
        const details = await getMovieDetails(result.id);

        enrichment = {
          minutesPerEpisode:
            typeof details.runtime === "number" && details.runtime > 0 ? details.runtime : null,
        };
      }
    } catch {
      enrichment = {};
    }

    setApplyingResultId(null);
    setIsChangingMatch(false);
    onSelect({ ...baseMatch, ...enrichment });
  };

  const unsupportedMessage =
    type === "Animasyon"
      ? "Bu tür için TMDb eşleştirmesi desteklenmiyor. Film veya Dizi/Anime türünü seçerek eşleştirebilirsin."
      : "Bu içerik türü TMDb hızlı doldurmayı desteklemiyor. Manuel olarak ekleyebilirsin.";

  const showSearchArea = !selectedMatch || isChangingMatch;

  return (
    <div className="quick-fill-panel tmdb-match-panel">
      <p className="quick-fill-label">Hızlı doldur</p>
      <p className="form-hint">
        {isSupported
          ? "İçerik bilgilerini TMDb'den bul ve formu otomatik doldur."
          : unsupportedMessage}
      </p>

      {selectedMatch && !isChangingMatch && (
        <div className="tmdb-match-summary">
          <div className="tmdb-match-summary-poster">
            {selectedMatch.posterUrl ? (
              <img
                src={selectedMatch.posterUrl}
                alt={`${selectedMatch.title} posteri`}
                loading="lazy"
              />
            ) : (
              <span aria-hidden="true">
                {selectedMatch.mediaType === "movie" ? "🎬" : "📺"}
              </span>
            )}
          </div>

          <div className="tmdb-match-summary-body">
            <p className="tmdb-match-summary-status" role="status" aria-live="polite">
              ✓ TMDb ile eşleştirildi
            </p>
            <p className="tmdb-match-summary-title">
              {selectedMatch.title}
              {selectedMatch.releaseYear ? ` (${selectedMatch.releaseYear})` : ""}
            </p>
          </div>

          <div className="tmdb-match-summary-actions">
            <button
              type="button"
              className="card-notes-btn"
              onClick={handleChangeMatch}
              disabled={isBusy}
            >
              Değiştir
            </button>

            <button
              type="button"
              className="card-notes-btn"
              onClick={handleClear}
              disabled={isBusy}
            >
              Eşleşmeyi kaldır
            </button>
          </div>
        </div>
      )}

      {showSearchArea && (
        <>
          <div className="tmdb-match-actions">
            <Button
              type="button"
              variant="secondary"
              loading={searchStatus === "loading"}
              loadingLabel="Aranıyor..."
              disabled={!isSupported || isBusy}
              onClick={handleSearch}
            >
              Hızlı doldur
            </Button>

            {isChangingMatch && (
              <button
                type="button"
                className="card-notes-btn"
                onClick={() => setIsChangingMatch(false)}
                disabled={isBusy}
              >
                Vazgeç
              </button>
            )}
          </div>

          <div ref={statusRegionRef}>
            {searchStatus === "titleRequired" && (
              <p
                className="tmdb-match-status form-search-feedback form-search-feedback--error"
                role="alert"
              >
                ⚠️ Önce içerik adını yaz.
              </p>
            )}

            {searchStatus === "loading" && (
              <LoadingState className="tmdb-match-status" label="TMDb'de aranıyor..." />
            )}

            {searchStatus !== "loading" &&
              searchStatus !== "titleRequired" &&
              manualOverride &&
              (searchStatus === "idle" || searchStatus === "error" || searchStatus === "empty") && (
                <p
                  className="tmdb-match-status form-search-feedback"
                  role="status"
                  aria-live="polite"
                >
                  Manuel devam ediliyor. TMDb eşleştirmesi olmadan eklediğinde
                  detaylı sezon ve bölüm yönetimi kullanılamaz.
                </p>
              )}

            {!manualOverride && searchStatus === "error" && (
              <ErrorState
                className="tmdb-match-status"
                icon="⚠️"
                description={`${errorMessage || "TMDb sonuçları yüklenemedi."} Manuel eklemeye devam edebilirsin.`}
                onRetry={handleSearch}
                retryLabel="Tekrar dene"
              >
                {onManualContinue && (
                  <button type="button" className="card-notes-btn" onClick={onManualContinue}>
                    Manuel devam et
                  </button>
                )}
              </ErrorState>
            )}

            {!manualOverride && searchStatus === "empty" && (
              <EmptyState
                className="tmdb-match-status"
                description="Bu adla eşleşen bir içerik bulunamadı. Manuel eklemeye devam edebilirsin."
              >
                {onManualContinue && (
                  <button type="button" className="card-notes-btn" onClick={onManualContinue}>
                    Manuel devam et
                  </button>
                )}
              </EmptyState>
            )}

            {searchStatus === "success" && results.length > 0 && (
              <ul className="tmdb-match-results">
                {results.map((result) => (
                  <li className="tmdb-match-result" key={result.id}>
                    <div className="tmdb-match-result-poster">
                      {result.posterUrl ? (
                        <img
                          src={result.posterUrl}
                          alt={`${result.title} posteri`}
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">
                          {mediaType === "movie" ? "🎬" : "📺"}
                        </span>
                      )}
                    </div>

                    <div className="tmdb-match-result-body">
                      <p className="tmdb-match-result-title">{result.title}</p>
                      <p className="tmdb-match-result-meta">
                        {result.year || "—"} · {mediaType === "movie" ? "Film" : "Dizi"}
                        {typeof result.rating === "number"
                          ? ` · ⭐ ${result.rating.toFixed(1)}`
                          : ""}
                      </p>
                      {result.overview && (
                        <p className="tmdb-match-result-overview">{result.overview}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="tmdb-match-result-select"
                      onClick={() => handleSelect(result)}
                      disabled={applyingResultId !== null}
                      aria-label={`${result.title}${
                        result.year ? ` (${result.year})` : ""
                      } ile eşleştir`}
                    >
                      {applyingResultId === result.id ? "Eşleştiriliyor..." : "Eşleştir"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TmdbMatchPicker;
