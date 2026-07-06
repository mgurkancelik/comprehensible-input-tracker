import PosterCard from "./PosterCard";

const MOCK_DISCOVER_ITEMS = [
  {
    id: "mock-movie-1",
    title: "Inception",
    year: 2010,
    rating: 8.4,
    type: "Film",
    genre: "Bilim Kurgu",
    estimatedLevel: "B2",
    overview:
      "Rüyalara girip fikir çalabilen bir hırsızın, bu sefer bir fikir ekmesi gereken imkansız görevi.",
    posterUrl: null,
    minutesPerEpisode: 148,
  },
  {
    id: "mock-movie-2",
    title: "Zindan ve Ejderha",
    year: 2023,
    rating: 7.3,
    type: "Film",
    genre: "Fantastik",
    estimatedLevel: "B1",
    overview:
      "Bir grup maceracının kayıp bir eşyayı bulmak için çıktığı, mizahla dolu bir fantastik yolculuk.",
    posterUrl: null,
    minutesPerEpisode: 134,
  },
  {
    id: "mock-movie-3",
    title: "Kayıp Şehir",
    year: 2022,
    rating: 6.8,
    type: "Film",
    genre: "Macera",
    estimatedLevel: "A2-B1",
    overview:
      "Bir romans yazarının, kitaplarındaki maceraların içinde bulduğu gerçek bir kurtarma operasyonu.",
    posterUrl: null,
    minutesPerEpisode: 112,
  },
  {
    id: "mock-series-1",
    title: "Breaking Bad",
    year: 2008,
    rating: 8.9,
    type: "Dizi",
    genre: "Suç, Dram",
    estimatedLevel: "B2",
    overview:
      "Kimya öğretmeni Walter White'ın uyuşturucu dünyasına adım atmasını konu alan gerilim dolu bir dizi.",
    posterUrl: null,
    minutesPerEpisode: 47,
  },
  {
    id: "mock-series-2",
    title: "Modern Family",
    year: 2009,
    rating: 8.5,
    type: "Dizi",
    genre: "Komedi",
    estimatedLevel: "B1-B2",
    overview:
      "Üç farklı ailenin günlük hayatını mockumentary tarzında anlatan sevilen bir aile komedisi.",
    posterUrl: null,
    minutesPerEpisode: 25,
  },
  {
    id: "mock-series-3",
    title: "Avatar: The Last Airbender",
    year: 2005,
    rating: 8.6,
    type: "Dizi",
    genre: "Animasyon, Macera",
    estimatedLevel: "A2-B1",
    overview:
      "Dört elementi kontrol edebilen halkların dünyasında barışı geri getirmeye çalışan genç bir Avatar'ın hikayesi.",
    posterUrl: null,
    minutesPerEpisode: 23,
  },
];

function DiscoverPage({ contents, onAddToWatchlist }) {
  return (
    <section className="form-section discover-page">
      <div className="page-title">
        <h2>🔎 Keşfet</h2>
        <p>
          Popüler ve en çok beğenilen film/dizileri keşfet, tek tıkla
          İzleyecekler listene ekle.
        </p>
      </div>

      <p className="empty-text">
        Şu anda örnek (mock) verilerle önizleme yapıyorsun — gerçek TMDb
        verisi bir sonraki adımda bağlanacak.
      </p>

      <div className="poster-grid">
        {MOCK_DISCOVER_ITEMS.map((item) => (
          <PosterCard
            key={item.id}
            item={item}
            isAdded={contents.some((content) => content.sourceId === item.id)}
            onAdd={() => onAddToWatchlist(item)}
          />
        ))}
      </div>
    </section>
  );
}

export default DiscoverPage;
