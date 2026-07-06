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

  const data = await response.json();

  return data.results || [];
}

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

export function getImageUrl(path, size = "w342") {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
