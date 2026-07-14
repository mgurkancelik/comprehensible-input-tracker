// TMDb kimliğiyle ilgili ortak, güvenli çözümleme mantığı. App.jsx, ContentForm/
// TmdbMatchPicker ve ContentDetailModal aynı fonksiyonları kullanır — sourceId
// formatını veya "hangi alan güvenilir" kararını birden fazla yerde
// kopyalamamak için tek kaynak burasıdır.

// Yalnızca tam "tmdb-movie-<sayı>" / "tmdb-tv-<sayı>" formatını kabul eder.
// Eskiden kullanılan `id.split("-").pop()` gibi gevşek bir çözümleme,
// MongoDB ObjectId'lerinin veya Date.now() id'lerinin sonundaki rakamları da
// yanlışlıkla "TMDb id" sanabiliyordu.
const TMDB_SOURCE_ID_PATTERN = /^tmdb-(movie|tv)-(\d+)$/;

// Manuel formdaki Türkçe `type` değerini TMDb'nin beklediği mediaType'a
// çevirir. Yalnızca gerçekten TMDb'de karşılığı olan türler için bir değer
// döner; Podcast/YouTube/Animasyon gibi TMDb'de net bir karşılığı olmayan
// türler için boş string döner (bu türlerde TMDb eşleştirmesi sunulmaz).
export function getMediaTypeFromContentType(type) {
  if (type === "Film") {
    return "movie";
  }

  if (type === "Dizi" || type === "Anime") {
    return "tv";
  }

  return "";
}

// "tmdb-tv-1396" -> { mediaType: "tv", tmdbId: 1396 }. Eşleşmezse veya
// tmdbId pozitif bir tam sayı değilse null döner.
export function parseTmdbSourceId(sourceId) {
  if (typeof sourceId !== "string") {
    return null;
  }

  const match = sourceId.match(TMDB_SOURCE_ID_PATTERN);

  if (!match) {
    return null;
  }

  const tmdbId = Number(match[2]);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }

  return { mediaType: match[1], tmdbId };
}

// DiscoverPage.jsx'teki normalizeTmdbItem ile birebir aynı format.
export function buildTmdbSourceId(mediaType, tmdbId) {
  if (mediaType !== "movie" && mediaType !== "tv") {
    return null;
  }

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }

  return `tmdb-${mediaType}-${tmdbId}`;
}

// Bir "content" nesnesinden (frontend content objesi ya da { mediaType,
// sourceId, tmdbId } şeklinde hafif bir obje) güvenilir bir TMDb TV id'si
// çıkarır. content.id (Date.now() veya MongoDB ObjectId) HİÇBİR ZAMAN
// okunmaz — yalnızca content.tmdbId (sayısal) veya content.sourceId'nin tam
// "tmdb-tv-<sayı>" formatına uyup uymadığına bakılır.
export function getTmdbTvId(content) {
  if (!content || content.mediaType !== "tv") {
    return null;
  }

  if (Number.isInteger(content.tmdbId) && content.tmdbId > 0) {
    return content.tmdbId;
  }

  const parsed = parseTmdbSourceId(content.sourceId);
  return parsed && parsed.mediaType === "tv" ? parsed.tmdbId : null;
}

// getTmdbTvId ile birebir aynı mantık, film (movie) için. content.id hiçbir
// zaman okunmaz; yalnızca content.tmdbId veya tam "tmdb-movie-<sayı>"
// formatındaki sourceId kabul edilir.
export function getTmdbMovieId(content) {
  if (!content || content.mediaType !== "movie") {
    return null;
  }

  if (Number.isInteger(content.tmdbId) && content.tmdbId > 0) {
    return content.tmdbId;
  }

  const parsed = parseTmdbSourceId(content.sourceId);
  return parsed && parsed.mediaType === "movie" ? parsed.tmdbId : null;
}

// Film/dizi süresi (dakika) için tek ortak normalizasyon kuralı: Number,
// sonlu ve pozitif olmalı; TMDb ondalık bir değer dönerse tam sayıya
// yuvarlanır. Geçersizse (NaN, negatif, string, 0, null/undefined) her
// zaman null döner — hiçbir çağıran taraf bunun yerine sabit/tahmini bir
// süre üretmemeli.
export function normalizeRuntimeMinutes(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.round(numberValue);
}

// "Bölümleri Yönet" gerçekten çalışabilir mi? — yalnızca güvenilir bir TMDb
// TV id'si çözümlenebiliyorsa true döner. mediaType === "tv" olması tek
// başına yeterli değildir (manuel eklenmiş, TMDb ile eşleştirilmemiş bir
// dizi de mediaType="tv" olabilir).
export function canManageEpisodes(content) {
  return getTmdbTvId(content) !== null;
}
