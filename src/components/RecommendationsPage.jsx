import { useState } from "react";
import { recommendations } from "../data/recommendations";

function RecommendationsPage({ addRecommendationToWatchLater }) {
  const [selectedLevel, setSelectedLevel] = useState("Tümü");
  const [selectedType, setSelectedType] = useState("Tümü");
  const [randomRecommendation, setRandomRecommendation] = useState(null);

  const filteredRecommendations = recommendations.filter((item) => {
    const levelMatch = selectedLevel === "Tümü" || item.level === selectedLevel;
    const typeMatch = selectedType === "Tümü" || item.type === selectedType;

    return levelMatch && typeMatch;
  });

  const suggestRandomContent = () => {
    if (filteredRecommendations.length === 0) {
      setRandomRecommendation(null);
      return;
    }

    const randomIndex = Math.floor(Math.random() * filteredRecommendations.length);
    setRandomRecommendation(filteredRecommendations[randomIndex]);
  };

  const handleAddToWatchLater = (item) => {
    addRecommendationToWatchLater(item);
  };

  return (
    <section className="form-section">
      <div className="page-title">
        <h2>Öneriler</h2>
        <p>
          Seviyene ve içerik türüne göre İngilizce input önerileri.
        </p>
      </div>

      <div className="filters">
        <label className="visually-hidden" htmlFor="rec-level-filter">
          Seviyeye göre filtrele
        </label>
        <select
          id="rec-level-filter"
          value={selectedLevel}
          onChange={(event) => setSelectedLevel(event.target.value)}
        >
          <option>Tümü</option>
          <option>A1-A2</option>
          <option>A2-B1</option>
          <option>B1</option>
          <option>B1-B2</option>
          <option>B2</option>
        </select>

        <label className="visually-hidden" htmlFor="rec-type-filter">
          Türe göre filtrele
        </label>
        <select
          id="rec-type-filter"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
        >
          <option>Tümü</option>
          <option>Dizi</option>
          <option>Animasyon</option>
          <option>Film</option>
          <option>YouTube</option>
          <option>Podcast</option>
        </select>
      </div>

      <div className="card-actions">
        <button type="button" onClick={suggestRandomContent}>
          Bu filtrelerden rastgele öner
        </button>
      </div>

      {randomRecommendation && (
        <div className="content-card">
          <div className="card-top">
            <div>
              <h3>Bugünkü Öneri: {randomRecommendation.title}</h3>
              <p>
                {randomRecommendation.type} · {randomRecommendation.level}
              </p>
            </div>
          </div>

          <div className="details-grid">
            <div>
              <span>Seviye</span>
              <strong>{randomRecommendation.level}</strong>
            </div>

            <div>
              <span>Tür</span>
              <strong>{randomRecommendation.type}</strong>
            </div>

            <div>
              <span>Bölüm Süresi</span>
              <strong>{randomRecommendation.minutesPerEpisode} dk</strong>
            </div>

            <div>
              <span>Tahmini Kelime</span>
              <strong>
                {(randomRecommendation.minutesPerEpisode * 120).toLocaleString(
                  "tr-TR"
                )}
              </strong>
            </div>
          </div>

          <p className="empty-text">{randomRecommendation.reason}</p>

          <div className="card-actions">
            <button
              type="button"
              className="complete-btn"
              onClick={() => handleAddToWatchLater(randomRecommendation)}
            >
              İzleyecekler Listeme Ekle
            </button>
          </div>
        </div>
      )}

      <h2>Öneri Listesi</h2>

      {filteredRecommendations.length === 0 ? (
        <p className="empty-text">
          Bu filtrelere uygun öneri bulunamadı. Farklı bir seviye veya tür
          seçerek tekrar dene.
        </p>
      ) : (
        filteredRecommendations.map((item) => (
          <div className="content-card" key={item.id}>
            <div className="card-top">
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.type} · {item.level}
                </p>
              </div>
            </div>

            <div className="details-grid">
              <div>
                <span>Seviye</span>
                <strong>{item.level}</strong>
              </div>

              <div>
                <span>Tür</span>
                <strong>{item.type}</strong>
              </div>

              <div>
                <span>Bölüm Süresi</span>
                <strong>{item.minutesPerEpisode} dk</strong>
              </div>

              <div>
                <span>Tahmini Kelime</span>
                <strong>
                  {(item.minutesPerEpisode * 120).toLocaleString("tr-TR")}
                </strong>
              </div>
            </div>

            <p className="empty-text">{item.reason}</p>

            <div className="card-actions">
              <button
                type="button"
                className="complete-btn"
                onClick={() => handleAddToWatchLater(item)}
              >
                İzleyecekler Listeme Ekle
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export default RecommendationsPage;