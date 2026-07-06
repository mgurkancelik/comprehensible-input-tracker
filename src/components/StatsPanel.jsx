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

  return (
    <section className="stats" aria-label="İstatistikler">
      <div className="stat-card">
        <span>Toplam Input</span>
        <strong>{(totalMinutes / 60).toFixed(1)} saat</strong>
      </div>

      <div className="stat-card">
        <span>Son 14 Gün</span>
        <strong>{(lastDaysMinutes / 60).toFixed(1)} saat</strong>
      </div>

      <div className="stat-card">
        <span>Toplam Kelime</span>
        <strong>{totalWords.toLocaleString("tr-TR")}</strong>
      </div>

      <div className="stat-card">
        <span>İzlenen Bölüm</span>
        <strong>{totalEpisodes}</strong>
      </div>

      <div className="stat-card">
        <span>İzleyecekler</span>
        <strong>{watchLaterCount}</strong>
      </div>

      <div className="stat-card">
        <span>İzleniyor</span>
        <strong>{watchingCount}</strong>
      </div>

      <div className="stat-card">
        <span>İzlediklerim</span>
        <strong>{completedCount}</strong>
      </div>

      <div className="stat-card">
        <span>İçerik Sayısı</span>
        <strong>{contents.length}</strong>
      </div>
    </section>
  );
}

export default StatsPanel;