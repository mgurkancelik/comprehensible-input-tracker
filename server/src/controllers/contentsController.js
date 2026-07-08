const mongoose = require("mongoose");
const Content = require("../models/Content");

// error.message'ı olduğu gibi client'a döndürmüyoruz; sadece bilinen ve
// güvenli (secret içermeyen) hata tiplerinde mesajı geçiriyoruz, aksi halde
// genel bir mesaj dönüyoruz. Ayrıntı yalnızca sunucu logunda kalır.
function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage + ":", error.name, error.message);

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ ok: false, message: error.message });
  }

  return res.status(500).json({ ok: false, message: fallbackMessage });
}

function buildIdQuery(id) {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { id }] }
    : { id };
}

async function getContents(req, res) {
  try {
    const contents = await Content.find().sort({ createdAt: -1 });
    res.json({ ok: true, count: contents.length, data: contents });
  } catch (error) {
    handleError(res, error, "Failed to fetch contents");
  }
}

async function createContent(req, res) {
  try {
    const created = await Content.create(req.body);
    res.status(201).json({ ok: true, data: created });
  } catch (error) {
    handleError(res, error, "Failed to create content");
  }
}

async function updateContent(req, res) {
  try {
    const { id } = req.params;

    const updated = await Content.findOneAndUpdate(buildIdQuery(id), req.body, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, message: "Content not found" });
    }

    res.json({ ok: true, data: updated });
  } catch (error) {
    handleError(res, error, "Failed to update content");
  }
}

async function deleteContent(req, res) {
  try {
    const { id } = req.params;

    const deleted = await Content.findOneAndDelete(buildIdQuery(id));

    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Content not found" });
    }

    res.json({ ok: true, message: "Content deleted", data: deleted });
  } catch (error) {
    handleError(res, error, "Failed to delete content");
  }
}

async function bulkImportContents(req, res) {
  try {
    const items = req.body;

    if (!Array.isArray(items)) {
      return res
        .status(400)
        .json({ ok: false, message: "Request body must be an array of contents" });
    }

    if (items.length === 0) {
      return res.json({ ok: true, insertedCount: 0, skippedCount: 0, total: 0 });
    }

    const existing = await Content.find({}, { id: 1, tmdbId: 1, title: 1 }).lean();

    const existingIds = new Set(existing.map((c) => c.id).filter(Boolean));
    const existingTmdbIds = new Set(
      existing.map((c) => c.tmdbId).filter((v) => v !== undefined && v !== null)
    );
    const existingTitles = new Set(
      existing.map((c) => (c.title || "").trim().toLowerCase()).filter(Boolean)
    );

    const seenInBatch = new Set();
    const toInsert = [];
    let skippedCount = 0;

    for (const item of items) {
      const idKey = item && item.id;
      const tmdbKey = item && item.tmdbId;
      const titleKey = ((item && item.title) || "").trim().toLowerCase();

      const isDuplicate =
        (idKey && existingIds.has(idKey)) ||
        (tmdbKey !== undefined && tmdbKey !== null && existingTmdbIds.has(tmdbKey)) ||
        (titleKey && existingTitles.has(titleKey)) ||
        (idKey && seenInBatch.has(`id:${idKey}`)) ||
        (tmdbKey !== undefined && tmdbKey !== null && seenInBatch.has(`tmdb:${tmdbKey}`)) ||
        (titleKey && seenInBatch.has(`title:${titleKey}`));

      if (isDuplicate) {
        skippedCount += 1;
        continue;
      }

      if (idKey) seenInBatch.add(`id:${idKey}`);
      if (tmdbKey !== undefined && tmdbKey !== null) seenInBatch.add(`tmdb:${tmdbKey}`);
      if (titleKey) seenInBatch.add(`title:${titleKey}`);

      toInsert.push(item);
    }

    const inserted =
      toInsert.length > 0 ? await Content.insertMany(toInsert, { ordered: false }) : [];

    res.status(201).json({
      ok: true,
      insertedCount: inserted.length,
      skippedCount,
      total: items.length,
    });
  } catch (error) {
    handleError(res, error, "Failed to bulk import contents");
  }
}

module.exports = {
  getContents,
  createContent,
  updateContent,
  deleteContent,
  bulkImportContents,
};
