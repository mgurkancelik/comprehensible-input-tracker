import { useEffect, useState } from "react";
import PosterCard from "./PosterCard";
import ContentDetailModal from "./ContentDetailModal";
import { estimateLevel, getGenreLabel } from "../utils/level";
import {
  getPopularMovies,
  getTopRatedMovies,
  getPopularSeries,
  getTopRatedSeries,
  getImageUrl,
} from "../services/tmdb";

const DEFAULT_MOVIE_MINUTES = 110;
const DEFAULT_SERIES_MINUTES = 45;

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
    genre: getGenreLabel(genreIds),
    estimatedLevel: estimateLevel(genreIds),
    overview: result.overview || "Bu içerik için özet bulunmuyor.",
    posterUrl: getImageUrl(result.poster_path),
    minutesPerEpisode:
      type === "Film" ? DEFAULT_MOVIE_MINUTES : DEFAULT_SERIES_MINUTES,
  };
}

function DiscoverPage({ contents, onAddToWatchlist }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const loadCategory = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const category = CATEGORIES.find((item) => item.key === activeCategory);
        const results = await category.fetcher();

        if (isCancelled) {
          return;
        }

        const normalized = results.map((result) =>
          normalizeTmdbItem(result, category.type)
        );

        setItems(normalized);
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

    loadCategory();

    return () => {
      isCancelled = true;
    };
  }, [activeCategory, reloadToken]);

  const retryLoading = () => {
    setReloadToken((token) => token + 1);
  };

  return (
    <section className="form-section discover-page">
      <div className="page-title">
        <h2>🔎 Keşfet</h2>
        <p>
          Popüler ve en çok beğenilen film/dizileri keşfet, tek tıkla
          İzleyecekler listene ekle.
        </p>
      </div>

      <div className="discover-tabs">
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            className={activeCategory === category.key ? "nav-active" : ""}
            aria-current={activeCategory === category.key ? "page" : undefined}
            onClick={() => setActiveCategory(category.key)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {status === "error" && (
        <div className="discover-error">
          <p>⚠️ {errorMessage}</p>
          <button type="button" onClick={retryLoading}>
            Tekrar Dene
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="poster-grid" aria-busy="true" aria-label="Yükleniyor">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="poster-skeleton" key={index} />
          ))}
        </div>
      )}

      {status === "success" && items.length === 0 && (
        <p className="empty-text">Bu kategoride şu anda gösterilecek içerik yok.</p>
      )}

      {status === "success" && items.length > 0 && (
        <div className="poster-grid">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              isAdded={contents.some((content) => content.sourceId === item.id)}
              onAdd={() => onAddToWatchlist(item)}
              onOpenDetail={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </section>
  );
}

export default DiscoverPage;
