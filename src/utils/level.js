const GENRE_NAMES = {
  28: "Aksiyon",
  12: "Macera",
  16: "Animasyon",
  35: "Komedi",
  80: "Suç",
  99: "Belgesel",
  18: "Dram",
  10751: "Aile",
  14: "Fantastik",
  36: "Tarih",
  27: "Korku",
  10402: "Müzik",
  9648: "Gizem",
  10749: "Romantik",
  878: "Bilim Kurgu",
  10770: "TV Filmi",
  53: "Gerilim",
  10752: "Savaş",
  37: "Vahşi Batı",
  10759: "Aksiyon ve Macera",
  10762: "Çocuk",
  10763: "Haber",
  10764: "Reality",
  10765: "Bilim Kurgu ve Fantastik",
  10766: "Pembe Dizi",
  10767: "Talk Show",
  10768: "Savaş ve Politika",
};

const EASY_GENRE_IDS = new Set([16, 10751, 10762]);
const HARD_GENRE_IDS = new Set([80, 878, 18, 10768, 10765, 10759, 53, 9648]);
const MEDIUM_GENRE_IDS = new Set([35, 10749, 10766, 10767]);

const DEFAULT_LEVEL = "B1-B2";

export function estimateLevel(genreIds = []) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) {
    return DEFAULT_LEVEL;
  }

  if (genreIds.some((id) => EASY_GENRE_IDS.has(id))) {
    return "A2-B1";
  }

  if (genreIds.some((id) => HARD_GENRE_IDS.has(id))) {
    return "B2";
  }

  if (genreIds.some((id) => MEDIUM_GENRE_IDS.has(id))) {
    return "B1-B2";
  }

  return DEFAULT_LEVEL;
}

export function getGenreLabel(genreIds = []) {
  if (!Array.isArray(genreIds) || genreIds.length === 0) {
    return "";
  }

  return genreIds
    .map((id) => GENRE_NAMES[id])
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

const ANIMATION_GENRE_ID = 16;

const DEFAULT_MOVIE_MINUTES = 110;
const DEFAULT_SERIES_MINUTES = 45;
const ANIMATED_MOVIE_MINUTES = 90;
const ANIMATED_SERIES_MINUTES = 22;

export function estimateMinutesPerEpisode(type, genreIds = []) {
  const isAnimation =
    Array.isArray(genreIds) && genreIds.includes(ANIMATION_GENRE_ID);

  if (type === "Film") {
    return isAnimation ? ANIMATED_MOVIE_MINUTES : DEFAULT_MOVIE_MINUTES;
  }

  return isAnimation ? ANIMATED_SERIES_MINUTES : DEFAULT_SERIES_MINUTES;
}
