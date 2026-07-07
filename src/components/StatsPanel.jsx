import { getTotalInputMinutes, getMinutesInRange } from "../utils/stats";

function StatsPanel({ contents }) {
  const getStatus = (item) => {
    if (item.totalEpisodes > 0 && item.watchedEpisodes >= item.totalEpisodes) {
      return "İzlediklerim";
    }

    if (item.status === "İzlediklerim") {
      return "İzlediklerim";
    }

    if (item.watchedEpisodes > 0) {
      return "İzleniyor";
    }

    return item.status || "İzleyecekler";
  };

  const totalMinutes = getTotalInputMinutes(contents);

  const totalWords = contents.reduce((sum, item) => {
    return sum + item.watchedEpisodes * item.wordsPerEpisode;
  }, 0);

  const totalEpisodes = contents.reduce((sum, item) => {
    return sum + item.watchedEpisodes;
  }, 0);

  const today = new Date();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(today.getDate() - 14);

  const lastDaysMinutes = getMinutesInRange(contents, fourteenDaysAgo, today);

  const watchLaterCount = contents.filter(
    (item) => getStatus(item) === "İzleyecekler"
  ).length;

  const watchingCount = contents.filter(
    (item) => getStatus(item) === "İzleniyor"
  ).length;

  const completedCount = contents.filter(
    (item) => getStatus(item) === "İzlediklerim"
  ).length;

  const stats = [
    {
      key: "total",
      label: "Toplam Input",
      value: `${(totalMinutes / 60).toFixed(1)} saat`,
    },
    {
      key: "last14",
      label: "Son 14 Gün",
      value: `${(lastDaysMinutes / 60).toFixed(1)} saat`,
    },
    {
      key: "words",
      label: "Toplam Kelime",
      value: totalWords.toLocaleString("tr-TR"),
    },
    {
      key: "episodes",
      label: "İzlenen Bölüm",
      value: totalEpisodes,
    },
    {
      key: "watchLater",
      label: "İzleyecekler",
      value: watchLaterCount,
    },
    {
      key: "watching",
      label: "İzleniyor",
      value: watchingCount,
    },
    {
      key: "completed",
      label: "İzlediklerim",
      value: completedCount,
    },
    {
      key: "count",
      label: "İçerik Sayısı",
      value: contents.length,
    },
  ];

  return (
    <section className="stats" aria-label="İstatistikler">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.key}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </div>
      ))}
    </section>
  );
}

export default StatsPanel;