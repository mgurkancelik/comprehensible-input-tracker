const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_LANGUAGE = "tr-TR";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

async function tmdbFetch(endpoint, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error(
      "TMDb API key bulunamadı. .env dosyanıza VITE_TMDB_API_KEY ekleyin."
    );
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", DEFAULT_LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`TMDb isteği başarısız oldu: ${response.status}`);
  }

  return response.json();
}

// Bu dört fonksiyon, "Daha Fazla Yükle" özelliği için sayfalama bilgisini
// (page, total_pages) kullanabilmesi adına TMDb yanıtının tamamını
// (results + page + total_pages) döndürür.
export function getPopularMovies(page = 1) {
  return tmdbFetch("/movie/popular", { page });
}

export function getTopRatedMovies(page = 1) {
  return tmdbFetch("/movie/top_rated", { page });
}

export function getPopularSeries(page = 1) {
  return tmdbFetch("/tv/popular", { page });
}

export function getTopRatedSeries(page = 1) {
  return tmdbFetch("/tv/top_rated", { page });
}

// Arama fonksiyonları geriye uyumluluk için sadece sonuç dizisini döndürmeye
// devam eder — bu turda arama tarafına pagination eklenmedi.
export async function searchMovies(query, page = 1) {
  const data = await tmdbFetch("/search/movie", { query, page });
  return data.results || [];
}

export async function searchSeries(query, page = 1) {
  const data = await tmdbFetch("/search/tv", { query, page });
  return data.results || [];
}

export async function searchMulti(query, page = 1) {
  const [movies, series] = await Promise.all([
    searchMovies(query, page),
    searchSeries(query, page),
  ]);

  return { movies, series };
}

export function getSeriesDetails(seriesId) {
  return tmdbFetch(`/tv/${seriesId}`);
}

// TmdbMatchPicker: manuel form için film eşleştirmesi seçildiğinde, arama
// sonucu listesinde bulunmayan `runtime` bilgisini almak için kullanılır.
export function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`);
}

export function getSeasonDetails(seriesId, seasonNumber) {
  return tmdbFetch(`/tv/${seriesId}/season/${seasonNumber}`);
}

export function getImageUrl(path, size = "w342") {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
