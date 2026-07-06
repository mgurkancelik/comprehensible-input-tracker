import { useEffect } from "react";

function ContentDetailModal({ item, isAdded, onAdd, onClose }) {
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

  if (!item) {
    return null;
  }

  const estimatedWords = Math.round((item.minutesPerEpisode || 0) * 120);

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
