import { useEffect, useState } from "react";

function NotesModal({ title, initialNotes, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(initialNotes || "");

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

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSave = () => {
    onSave(draft.trim());
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-modal-title"
      >
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Kapat"
        >
          ✕
        </button>

        <div className="modal-body">
          <h2 id="notes-modal-title">Kişisel Not</h2>
          <p className="modal-meta">{title}</p>

          <label className="visually-hidden" htmlFor="notes-textarea">
            Kişisel not
          </label>
          <textarea
            id="notes-textarea"
            className="notes-textarea"
            rows={6}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Bu içerikte dikkatini çeken kelimeleri, aksanı, zorluk seviyesini veya tekrar izleme notlarını yaz..."
          />

          <div className="notes-modal-actions">
            {initialNotes && (
              <button
                type="button"
                className="notes-delete-btn"
                onClick={handleDelete}
              >
                Notu Sil
              </button>
            )}

            <div className="notes-modal-actions-right">
              <button
                type="button"
                className="notes-cancel-btn"
                onClick={onClose}
              >
                Vazgeç
              </button>

              <button type="button" onClick={handleSave}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotesModal;
