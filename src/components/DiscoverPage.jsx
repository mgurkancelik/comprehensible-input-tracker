import { useEffect, useState } from "react";
import PosterCard from "./PosterCard";
import ContentDetailModal from "./ContentDetailModal";
import Chip from "./ui/Chip";
import ErrorState from "./ui/ErrorState";
import {
  estimateLevel,
  getGenreLabel,
  estimateMinutesPerEpisode,
  matchesLevelFilter,
} from "../utils/level";
import {
  getPopularMovies,
  getTopRatedMovies,
  getPopularSeries,
  getTopRatedSeries,
  searchMulti,
  getImageUrl,
} from "../services/tmdb";

const TYPE_FILTER_OPTIONS = ["Tümü", "Film", "Dizi"];
const LEVEL_FILTER_OPTIONS = ["Tümü", "A2-B1", "B1-B2", "B2"];
const RATING_FILTER_OPTIONS = ["Tümü", "7+", "8+"];

const CATEGORIES = [
  {
    key: "popularMovies",
    label: "Popüler Filmler",
    type: "Film",
    fetcher: getPopularMovies,
  },
  {
    key: "topRatedMovies",
    label: "Top Rated Filmler",
    type: "Film",
    fetcher: getTopRatedMovies,
  },
  {
    key: "popularSeries",
    label: "Popüler Diziler",
    type: "Dizi",
    fetcher: getPopularSeries,
  },
  {
    key: "topRatedSeries",
    label: "Top Rated Diziler",
    type: "Dizi",
    fetcher: getTopRatedSeries,
  },
];

function normalizeTmdbItem(result, type) {
  const title = result.title || result.name || "Başlıksız";
  const releaseDate = result.release_date || result.first_air_date || "";
  const year = releaseDate ? releaseDate.slice(0, 4) : "—";
  const rating =
    typeof result.vote_average === "number" ? result.vote_average : 0;
  const genreIds = result.genre_ids || [];

  return {
    id: `tmdb-${type === "Film" ? "movie" : "tv"}-${result.id}`,
    title,
    year,
    rating,
    type,
    mediaType: type === "Film" ? "movie" : "tv",
    genre: getGenreLabel(genreIds),
    estimatedLevel: estimateLevel(genreIds),
    overview: result.overview || "Bu içerik için özet bulunmuyor.",
    posterUrl: getImageUrl(result.poster_path),
    minutesPerEpisode: estimateMinutesPerEpisode(type, genreIds),
  };
}

function DiscoverPage({
  isItemAdded,
  onAddToWatchlist,
  contents,
  onSyncSeriesTotalEpisodes,
  onSyncSeasonEpisodes,
  onToggleEpisodeWatched,
  onToggleSeasonWatched,
}) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [typeFilter, setTypeFilter] = useState("Tümü");
  const [levelFilter, setLevelFilter] = useState("Tümü");
  const [ratingFilter, setRatingFilter] = useState("Tümü");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    let isCancelled = false;

    const loadItems = async () => {
      setStatus("loading");
      setErrorMessage("");
      setCurrentPage(1);
      setTotalPages(1);

      try {
        let normalized;
        let newTotalPages = 1;

        if (searchQuery) {
          const { movies, series } = await searchMulti(searchQuery);

          normalized = [
            ...movies.map((result) => normalizeTmdbItem(result, "Film")),
            ...series.map((result) => normalizeTmdbItem(result, "Dizi")),
          ];
        } else {
          const category = CATEGORIES.find(
            (item) => item.key === activeCategory
          );
          const data = await category.fetcher(1);

          normalized = (data.results || []).map((result) =>
            normalizeTmdbItem(result, category.type)
          );
          newTotalPages = data.total_pages || 1;
        }

        if (isCancelled) {
          return;
        }

        setItems(normalized);
        setTotalPages(newTotalPages);
        setStatus("success");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          error.message || "İçerikler yüklenirken bir sorun oluştu."
        );
        setStatus("error");
      }
    };

    loadItems();

    return () => {
      isCancelled = true;
    };
  }, [activeCategory, reloadToken, searchQuery]);

  const retryLoading = () => {
    setReloadToken((token) => token + 1);
  };

  const selectCategory = (categoryKey) => {
    setActiveCategory(categoryKey);
    setSearchInput("");
    setSearchQuery("");
    setTypeFilter("Tümü");
  };

  const isSearchMode = Boolean(searchQuery);

  const hasMore = !searchQuery && currentPage < totalPages;

  const loadMore = async () => {
    if (searchQuery || isLoadingMore || !hasMore) {
      return;
    }

    const nextPage = currentPage + 1;
    setIsLoadingMore(true);

    try {
      const category = CATEGORIES.find((item) => item.key === activeCategory);
      const data = await category.fetcher(nextPage);

      const normalized = (data.results || []).map((result) =>
        normalizeTmdbItem(result, category.type)
      );

      setItems((prevItems) => {
        const existingIds = new Set(prevItems.map((item) => item.id));
        const uniqueNewItems = normalized.filter(
          (item) => !existingIds.has(item.id)
        );

        return [...prevItems, ...uniqueNewItems];
      });

      setCurrentPage(nextPage);
      setTotalPages(data.total_pages || nextPage);
    } catch (error) {
      setErrorMessage(
        error.message || "Daha fazla içerik yüklenirken bir sorun oluştu."
      );
      setStatus("error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const filteredItems = items.filter((item) => {
    // Kategori modunda tür zaten seçilen sekmeyle sabit (Film ya da Dizi),
    // bu yüzden tür filtresi sadece arama modunda uygulanır. Aksi halde
    // arama modundan kalma bir typeFilter değeri, kategori sonuçlarının
    // tamamını yanlışlıkla gizleyebilir.
    const matchesType =
      !isSearchMode || typeFilter === "Tümü" || item.type === typeFilter;
    const matchesLevel = matchesLevelFilter(item.estimatedLevel, levelFilter);
    const matchesRating =
      ratingFilter === "Tümü" ||
      (ratingFilter === "7+" && item.rating >= 7) ||
      (ratingFilter === "8+" && item.rating >= 8);

    return matchesType && matchesLevel && matchesRating;
  });

  const hasActiveFilters =
    (isSearchMode && typeFilter !== "Tümü") ||
    levelFilter !== "Tümü" ||
    ratingFilter !== "Tümü";

  return (
    <section className="form-section discover-page">
      <div className="page-title">
        <h2>Keşfet</h2>
        <p>
          Popüler ve en çok beğenilen film/dizileri keşfet, arayarak bul, tek
          tıkla İzleyecekler listene ekle.
        </p>
      </div>

      <div className="discover-search">
        <label className="visually-hidden" htmlFor="discover-search-input">
          Film, dizi veya animasyon ara
        </label>
        <input
          id="discover-search-input"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Film, dizi veya animasyon ara..."
        />
      </div>

      <div className="discover-tabs">
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            className={
              !searchQuery && activeCategory === category.key
                ? "nav-active"
                : ""
            }
            aria-current={
              !searchQuery && activeCategory === category.key
                ? "page"
                : undefined
            }
            onClick={() => selectCategory(category.key)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="discover-filters">
        {isSearchMode && (
          <div className="filter-group">
            <span className="filter-group-label">Tür</span>
            <div className="filter-chip-row">
              {TYPE_FILTER_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  variant="filter"
                  selected={typeFilter === option}
                  onClick={() => setTypeFilter(option)}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="filter-group">
          <span className="filter-group-label">Seviye</span>
          <div className="filter-chip-row">
            {LEVEL_FILTER_OPTIONS.map((option) => (
              <Chip
                key={option}
                variant="filter"
                selected={levelFilter === option}
                onClick={() => setLevelFilter(option)}
              >
                {option}
              </Chip>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group-label">Puan</span>
          <div className="filter-chip-row">
            {RATING_FILTER_OPTIONS.map((option) => (
              <Chip
                key={option}
                variant="filter"
                selected={ratingFilter === option}
                onClick={() => setRatingFilter(option)}
              >
                {option}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {status === "error" && (
        <ErrorState
          className="discover-error"
          description={errorMessage}
          onRetry={retryLoading}
        />
      )}

      {status === "loading" && (
        <div className="poster-grid" aria-busy="true" aria-label="Yükleniyor">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="poster-skeleton" key={index} />
          ))}
        </div>
      )}

      {status === "success" && filteredItems.length > 0 && (
        <p className="discover-result-count">
          {searchQuery
            ? `Arama sonucunda ${filteredItems.length} içerik bulundu`
            : `${filteredItems.length} içerik gösteriliyor`}
        </p>
      )}

      {status === "success" && filteredItems.length === 0 && (
        <p className="empty-text">
          {searchQuery
            ? "Bu arama için uygun içerik bulunamadı. Farklı bir başlık deneyebilirsin."
            : hasActiveFilters
            ? "Bu filtrelerle az sonuç var. Filtreyi genişletmeyi deneyebilirsin."
            : "Bu kategoride şu anda gösterilecek içerik yok."}
        </p>
      )}

      {status === "success" && filteredItems.length > 0 && (
        <div className="poster-grid">
          {filteredItems.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              isAdded={isItemAdded(item)}
              onAdd={() => onAddToWatchlist(item)}
              onOpenDetail={() => setSelectedItem(item)}
              levelFilter={levelFilter}
            />
          ))}
        </div>
      )}

      {status === "success" && hasMore && (
        <div className="discover-load-more">
          <button type="button" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Yükleniyor..." : "Daha Fazla Yükle"}
          </button>
        </div>
      )}

      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          isAdded={isItemAdded(selectedItem)}
          onAdd={(status) => onAddToWatchlist(selectedItem, status)}
          onClose={() => setSelectedItem(null)}
          contents={contents}
          onSyncSeriesTotalEpisodes={onSyncSeriesTotalEpisodes}
          onSyncSeasonEpisodes={onSyncSeasonEpisodes}
          onToggleEpisodeWatched={onToggleEpisodeWatched}
          onToggleSeasonWatched={onToggleSeasonWatched}
        />
      )}
    </section>
  );
}

export default DiscoverPage;
