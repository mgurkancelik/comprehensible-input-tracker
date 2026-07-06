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

  const totalMinutes = contents.reduce((sum, item) => {
    return sum + item.watchedEpisodes * item.minutesPerEpisode;
  }, 0);

  const totalWords = contents.reduce((sum, item) => {
    return sum + item.watchedEpisodes * item.wordsPerEpisode;
  }, 0);

  const totalEpisodes = contents.reduce((sum, item) => {
    return sum + item.watchedEpisodes;
  }, 0);

  const today = new Date();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(today.getDate() - 14);

  const lastDaysMinutes = contents.reduce((total, item) => {
    const logs = item.watchLogs || [];

    const itemMinutes = logs.reduce((sum, log) => {
      const logDate = new Date(log.date);

      if (logDate >= fourteenDaysAgo && logDate <= today) {
        return sum + log.minutes;
      }

      return sum;
    }, 0);

    return total + itemMinutes;
  }, 0);

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
      icon: "⏱️",
      tone: "primary",
      label: "Toplam Input",
      value: `${(totalMinutes / 60).toFixed(1)} saat`,
    },
    {
      key: "last14",
      icon: "📆",
      tone: "primary",
      label: "Son 14 Gün",
      value: `${(lastDaysMinutes / 60).toFixed(1)} saat`,
    },
    {
      key: "words",
      icon: "🧠",
      tone: "success",
      label: "Toplam Kelime",
      value: totalWords.toLocaleString("tr-TR"),
    },
    {
      key: "episodes",
      icon: "▶️",
      tone: "primary",
      label: "İzlenen Bölüm",
      value: totalEpisodes,
    },
    {
      key: "watchLater",
      icon: "📌",
      tone: "neutral",
      label: "İzleyecekler",
      value: watchLaterCount,
    },
    {
      key: "watching",
      icon: "🎬",
      tone: "primary",
      label: "İzleniyor",
      value: watchingCount,
    },
    {
      key: "completed",
      icon: "✅",
      tone: "success",
      label: "İzlediklerim",
      value: completedCount,
    },
    {
      key: "count",
      icon: "📚",
      tone: "neutral",
      label: "İçerik Sayısı",
      value: contents.length,
    },
  ];

  return (
    <section className="stats" aria-label="İstatistikler">
      {stats.map((stat) => (
        <div className={`stat-card stat-card--${stat.tone}`} key={stat.key}>
          <div className="stat-icon" aria-hidden="true">
            {stat.icon}
          </div>

          <div className="stat-body">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}

export default StatsPanel;