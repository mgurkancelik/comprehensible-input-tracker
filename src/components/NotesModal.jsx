import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

function NotesModal({ title, initialNotes, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(initialNotes || "");

  const handleSave = () => {
    onSave(draft.trim());
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <Modal open onClose={onClose} ariaLabel="Kişisel Not" size="md">
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
            <Button variant="danger" onClick={handleDelete}>
              Notu Sil
            </Button>
          )}

          <div className="notes-modal-actions-right">
            <Button variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>

            <Button variant="primary" onClick={handleSave}>
              Kaydet
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default NotesModal;
