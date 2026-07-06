function PosterCard({ item, isAdded, onAdd, onOpenDetail }) {
  const handleCardKeyDown = (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetail();
    }
  };

  return (
    <article
      className="poster-card"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={handleCardKeyDown}
      aria-label={`${item.title} detaylarını görüntüle`}
    >
      <div className="poster-image">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={`${item.title} posteri`} loading="lazy" />
        ) : (
          <div className="poster-fallback" aria-hidden="true">
            {item.type === "Dizi" ? "📺" : "🎬"}
          </div>
        )}

        {item.estimatedLevel && (
          <span className="poster-level-badge">{item.estimatedLevel}</span>
        )}

        <button
          type="button"
          className={`poster-add-btn${isAdded ? " poster-add-btn--added" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          disabled={isAdded}
          aria-label={
            isAdded
              ? `${item.title} zaten İzleyecekler listende`
              : `${item.title} içeriğini İzleyecekler listeme ekle`
          }
        >
          {isAdded ? "✓" : "+"}
        </button>
      </div>

      <div className="poster-body">
        <h3 className="poster-title">{item.title}</h3>

        <p className="poster-meta">
          {item.year} · {item.type} · {item.genre}
        </p>

        <p className="poster-rating">⭐ {(item.rating ?? 0).toFixed(1)}</p>

        <p className="poster-overview">{item.overview}</p>
      </div>
    </article>
  );
}

export default PosterCard;
