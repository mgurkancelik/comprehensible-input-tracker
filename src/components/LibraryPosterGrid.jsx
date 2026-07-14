import { getContentTotalMinutes, formatMinutesLabel, formatDateLabel } from "../utils/stats";

// Kütüphanenin üç durumu (İzleyecekler/İzleniyor/İzlediklerim) için ortak
// poster grid — eskiden yalnızca "İzlediklerim" için yazılan WatchedPosterGrid'in
// genelleştirilmiş hâli. Üç ayrı poster component'i kopyalamak yerine tek
// component, `status` prop'una göre rozet/glif ve gösterilen ek bilgiyi
// (bölüm ilerlemesi, tarih) değiştirir. "İzlediklerim" için DOM/CSS sınıfları
// (watched-poster-*) bilerek AYNEN korunmuştur — bu görünüm zaten çalışıyordu
// ve bozulmaması gerekiyordu.
const STATUS_BADGE = {
  İzleyecekler: { glyph: "🔖", label: "izleyeceğim", modifier: "planned" },
  İzleniyor: { glyph: "▶", label: "izliyorum", modifier: "watching" },
  İzlediklerim: { glyph: "✓", label: "izlendi", modifier: null },
};

function LibraryPosterCard({ item, status, onOpenDetail }) {
  const isSeriesLike = item.type !== "Film";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.İzleyecekler;
  const isWatched = status === "İzlediklerim";

  // Film yanlışlıkla İzliyorum durumunda olsa bile (film bölüm kavramı
  // taşımaz) bölüm ilerlemesi ASLA üretilmez — yalnızca gerçekten bölümlü
  // içerik (isSeriesLike) ve İzleyecekler DIŞINDA (henüz başlanmamış bir
  // içeriğin "0/0 bölüm" göstermesi anlamsız) bir durumda gösterilir.
  const progressLabel =
    isSeriesLike && status !== "İzleyecekler" && item.totalEpisodes > 0
      ? `${item.watchedEpisodes || 0} / ${item.totalEpisodes} bölüm`
      : null;

  const dateLabel = isWatched
    ? formatDateLabel(item.completedDate || item.finishDate)
    : formatDateLabel(item.startDate);

  const dateFallback = isWatched
    ? "İzlenme tarihi belirtilmedi"
    : "Başlangıç tarihi belirtilmedi";

  const durationLabel = isWatched ? formatMinutesLabel(getContentTotalMinutes(item)) : null;

  const ariaLabel = `${item.title} — ${badge.label}${
    progressLabel ? `, ${progressLabel}` : ""
  }. Detayları görüntüle.`;

  const badgeClassName = badge.modifier
    ? `watched-poster-badge watched-poster-badge--${badge.modifier}`
    : "watched-poster-badge";

  return (
    <button
      type="button"
      className="watched-poster-card"
      onClick={onOpenDetail}
      aria-label={ariaLabel}
    >
      <span className="watched-poster-image">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" />
        ) : (
          <span className="poster-fallback" aria-hidden="true">
            {isSeriesLike ? "📺" : "🎬"}
          </span>
        )}

        <span className={badgeClassName} aria-hidden="true">
          {badge.glyph}
        </span>

        <span className="watched-poster-overlay">
          <span className="watched-poster-overlay-title">{item.title}</span>

          {progressLabel && (
            <span className="watched-poster-overlay-meta">{progressLabel}</span>
          )}

          <span className="watched-poster-overlay-meta">{dateLabel || dateFallback}</span>

          {durationLabel && (
            <span className="watched-poster-overlay-meta">{durationLabel}</span>
          )}

          <span className="watched-poster-overlay-cta">Detayları görüntüle</span>
        </span>
      </span>

      <span className="watched-poster-title">
        {item.title}
        {item.type ? <span className="watched-poster-type"> · {item.type}</span> : null}
      </span>

      {/* Bölüm ilerlemesi mobilde de her zaman görünür olmalı — yalnızca
          hover/focus overlay'e bağımlı kalmaz (bkz. yukarıdaki overlay). */}
      {progressLabel && <span className="watched-poster-progress">{progressLabel}</span>}
    </button>
  );
}

function LibraryPosterGrid({ items, status, onOpenDetail }) {
  return (
    <div className="watched-poster-grid">
      {items.map((item) => (
        <LibraryPosterCard
          key={item.id}
          item={item}
          status={status}
          onOpenDetail={() => onOpenDetail(item)}
        />
      ))}
    </div>
  );
}

export default LibraryPosterGrid;
