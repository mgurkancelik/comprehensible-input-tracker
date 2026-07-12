// Toplam input dakikası. Bölümlü içerikler (dizi/anime/podcast) için mevcut
// mantık aynen korunur: izlenen bölüm sayısı x bölüm süresi. Filmler tek
// parça içerik olduğu, "bölüm" kavramı taşımadığı için (watchedEpisodes hep 0
// kalır) ayrı ele alınır: tamamlanmış (status === "İzlediklerim") bir film,
// kendi kayıtlı süresi (minutesPerEpisode) kadar toplam inputa katkı sağlar;
// tamamlanmamışsa 0 döner. Bu değer her çağrıda content'in güncel alanlarından
// türetilir — ayrı bir sayaç olarak saklanmaz, bu sayede status "İzledim"den
// çıkarıldığında kendi süresi otomatik olarak toplamdan düşer ve eski
// watchedEpisodes=0 olan tamamlanmış filmler migration gerekmeden doğru
// hesaplanır. Dashboard, StatsPanel ve Input Hedefi kartının "tüm zamanlar"
// toplamı için tek doğru kaynak budur.
export function getContentTotalMinutes(content) {
  if (content.type === "Film") {
    const isCompleted = content.status === "İzlediklerim";
    const movieMinutes = Number(content.minutesPerEpisode);

    if (isCompleted && Number.isFinite(movieMinutes) && movieMinutes > 0) {
      return movieMinutes;
    }

    return 0;
  }

  const watchedEpisodes = content.watchedEpisodes || 0;
  const minutesPerEpisode = content.minutesPerEpisode || 0;
  return watchedEpisodes * minutesPerEpisode;
}

export function getTotalInputMinutes(contents) {
  return contents.reduce(
    (sum, content) => sum + getContentTotalMinutes(content),
    0
  );
}

// Bir içeriğin TARİHE BAĞLI input girişlerini döndürür. Her giriş, nereden
// geldiğini belirten bir `type` taşır ("manual" | "episode") — eski
// loglarda type alanı yoksa güvenli şekilde "manual" varsayılır.
//
// - seasons verisi varsa (Keşfet üzerinden eklenip bölüm/sezon checkbox
//   sistemiyle takip edilen diziler): her izlenen bölümün kendi watchedAt
//   tarihi kullanılır. Bu sistem watchLogs'a hiç yazmadığı için, bu veri
//   olmadan Tracking sayfası bu izlemeleri tamamen kaçırırdı. Aynı
//   sezon+bölüm için asla birden fazla giriş üretilmemesi bir Set ile
//   garanti edilir (duplicate koruması).
// - seasons verisi yoksa (film veya manuel eklenen/eski içerik): mevcut
//   watchLogs kullanılır (değişmedi).
//
// Bir içerik için ikisi birlikte toplanmaz — bu yüzden aynı bölüm hem
// watchLogs hem seasons üzerinden iki kez sayılamaz.
export function getContentDatedEntries(content) {
  if (content.seasons && content.seasons.length > 0) {
    const seenEpisodeKeys = new Set();

    return content.seasons.flatMap((season) =>
      (season.episodes || [])
        .filter((episode) => episode.watched && episode.watchedAt)
        .filter((episode) => {
          const key = `${season.seasonNumber}-${episode.episodeNumber}`;

          if (seenEpisodeKeys.has(key)) {
            return false;
          }

          seenEpisodeKeys.add(key);
          return true;
        })
        .map((episode) => {
          const minutes =
            typeof episode.runtime === "number" && episode.runtime > 0
              ? episode.runtime
              : content.minutesPerEpisode || 0;

          return {
            date: episode.watchedAt,
            minutes,
            words: minutes * 120,
            type: "episode",
          };
        })
    );
  }

  return (content.watchLogs || []).map((log) => ({
    ...log,
    type: log.type || "manual",
  }));
}

// Tracking sayfasındaki "Input Kaydı" göstergesi için: kaç tanesi kullanıcının
// manuel formdan/eski butonlardan oluşturduğu log, kaç tanesi bölüm
// checkbox'ından gelen otomatik kayıt — ayrı ayrı ve toplam olarak.
export function getInputRecordCounts(contents) {
  let manual = 0;
  let episode = 0;

  contents.forEach((content) => {
    getContentDatedEntries(content).forEach((entry) => {
      if (entry.type === "episode") {
        episode += 1;
      } else {
        manual += 1;
      }
    });
  });

  return { manual, episode, total: manual + episode };
}

export function getMinutesInRange(contents, fromDate, toDate) {
  return contents.reduce((total, content) => {
    const entries = getContentDatedEntries(content);

    const rangeMinutes = entries.reduce((sum, entry) => {
      const entryDate = new Date(entry.date);

      if (entryDate >= fromDate && entryDate <= toDate) {
        return sum + (entry.minutes || 0);
      }

      return sum;
    }, 0);

    return total + rangeMinutes;
  }, 0);
}

// dayBuckets: [{ date: "YYYY-MM-DD", label: "..." }, ...] — App.jsx'te
// hazırlanan günlük iskeleti doldurur.
export function getDailyInputBuckets(contents, dayBuckets) {
  const buckets = dayBuckets.map((day) => ({ ...day, minutes: 0, words: 0 }));

  contents.forEach((content) => {
    getContentDatedEntries(content).forEach((entry) => {
      const bucket = buckets.find((day) => day.date === entry.date);

      if (bucket) {
        bucket.minutes += entry.minutes || 0;
        bucket.words += entry.words || 0;
      }
    });
  });

  return buckets;
}

export function getMonthlyInputSummary(contents) {
  const months = {};

  contents.forEach((content) => {
    getContentDatedEntries(content).forEach((entry) => {
      const date = new Date(entry.date);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const monthKey = date.toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      });

      if (!months[monthKey]) {
        months[monthKey] = {
          label: monthKey,
          minutes: 0,
          words: 0,
          titles: {},
        };
      }

      months[monthKey].minutes += entry.minutes || 0;
      months[monthKey].words += entry.words || 0;

      if (!months[monthKey].titles[content.title]) {
        months[monthKey].titles[content.title] = 0;
      }

      months[monthKey].titles[content.title] += entry.minutes || 0;
    });
  });

  return Object.values(months);
}

// 60 dakikanın altını "dk", üstünü "saat" olarak okunabilir gösterir.
export function formatMinutesLabel(minutes) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(minutes, 0) : 0;

  if (safeMinutes < 60) {
    return `${Math.round(safeMinutes)} dk`;
  }

  return `${(safeMinutes / 60).toFixed(1)} saat`;
}
