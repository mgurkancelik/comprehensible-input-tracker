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

// Bir filmin İZLENDİ olarak sayılabilecek TEK olayını (varsa) çözer.
// Film için tek canonical kaynak: geçerli bir bitiş tarihi (finishDate/
// completedDate — mapUserContentToFrontendContent ikisini de aynı değere
// eşler) + gerçek (kayıtlı) bir süre. Film ASLA watchLogs/seasons üzerinden
// ayrıca sayılmaz (bkz. getContentDatedEntries) — bu yüzden double-count
// riski tanım gereği yoktur. Tarih veya süre eksikse/geçersizse null döner;
// sahte bir tarih (bugün) veya sahte bir süre (110dk, dakika×120 vb.)
// ASLA üretilmez.
function resolveMovieWatchEvent(content) {
  if (content.status !== "İzlediklerim") {
    return null;
  }

  const date = content.completedDate || content.finishDate || "";

  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const minutes = Number(content.minutesPerEpisode);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  // TMDb konuşulan kelime sayısı sağlamaz. Kullanıcı gerçekten bir değer
  // girmediyse (wordsPerEpisode) kelime alanı 0 kalır — "dakika × 120" gibi
  // bir formülle ASLA doldurulmaz.
  const userWords = Number(content.wordsPerEpisode);

  return {
    date,
    minutes,
    words: Number.isFinite(userWords) && userWords > 0 ? userWords : 0,
  };
}

// Bir içeriğin TARİHE BAĞLI input girişlerini döndürür. Her giriş, nereden
// geldiğini belirten bir `type` taşır ("manual" | "episode" | "movie") —
// eski loglarda type alanı yoksa güvenli şekilde "manual" varsayılır.
//
// - Film ise (content.type === "Film"): yukarıdaki resolveMovieWatchEvent
//   TEK kaynaktır — watchLogs/seasons'a hiç bakılmaz (filmler bu alanları
//   zaten hiçbir akışta doldurmuyor, ama tanım gereği de karışamaz).
// - seasons verisi varsa (Keşfet üzerinden eklenip bölüm/sezon checkbox
//   sistemiyle takip edilen diziler): her izlenen bölümün kendi watchedAt
//   tarihi kullanılır. Bu sistem watchLogs'a hiç yazmadığı için, bu veri
//   olmadan Tracking sayfası bu izlemeleri tamamen kaçırırdı. Aynı
//   sezon+bölüm için asla birden fazla giriş üretilmemesi bir Set ile
//   garanti edilir (duplicate koruması).
// - seasons verisi yoksa (manuel eklenen/eski dizi içeriği): mevcut
//   watchLogs kullanılır (değişmedi).
//
// Bir içerik için ikisi birlikte toplanmaz — bu yüzden aynı bölüm hem
// watchLogs hem seasons üzerinden iki kez sayılamaz.
export function getContentDatedEntries(content) {
  if (content.type === "Film") {
    const movieEvent = resolveMovieWatchEvent(content);

    return movieEvent
      ? [{ date: movieEvent.date, minutes: movieEvent.minutes, words: movieEvent.words, type: "movie" }]
      : [];
  }

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
          // Film ile bölümlü içerik (dizi/anime) süresi ayrı ayrı da
          // tutulur — "minutes" toplamı geriye dönük uyumluluk için
          // korunur, movieCount/movieMinutes yalnızca bu ayda GERÇEKTEN
          // tarihli+süreli bir film varsa artar (her film en fazla bir kez).
          movieCount: 0,
          movieMinutes: 0,
          episodeMinutes: 0,
        };
      }

      months[monthKey].minutes += entry.minutes || 0;
      months[monthKey].words += entry.words || 0;

      if (entry.type === "movie") {
        months[monthKey].movieCount += 1;
        months[monthKey].movieMinutes += entry.minutes || 0;
      } else {
        months[monthKey].episodeMinutes += entry.minutes || 0;
      }

      if (!months[monthKey].titles[content.title]) {
        months[monthKey].titles[content.title] = 0;
      }

      months[monthKey].titles[content.title] += entry.minutes || 0;
    });
  });

  return Object.values(months);
}

// Kütüphanedeki TÜM "İzlediklerim" filmlerin toplam sayısı ve toplam
// süresi (tarihe bağlı değil — bir film tarihsiz de olsa "izlenmiş film"
// sayısına dahildir, ama süresi yalnızca gerçek bir runtime kayıtlıysa
// toplama eklenir). Süre hesabı getContentTotalMinutes ile aynı, tek
// kaynaktan gelir — burada ayrıca bir formül türetilmez.
export function getMovieStats(contents) {
  let count = 0;
  let minutes = 0;

  contents.forEach((content) => {
    if (content.type !== "Film" || content.status !== "İzlediklerim") {
      return;
    }

    count += 1;
    minutes += getContentTotalMinutes(content);
  });

  return { count, minutes };
}

// Takip Çizelgesi'nde "Film adı — tarih — süre" şeklinde listelenebilecek
// izlenmiş filmler. Yalnızca GEÇERLİ bir tarihi olan filmler listelenir
// (tarihsiz bir filmin kronolojik bir listede anlamlı bir yeri yoktur —
// bu durum ayrıca içerik kartında kullanıcıya açıklanır). Süre bilgisi
// yoksa `minutes: null` döner; çağıran taraf bunu "—" olarak göstermeli,
// asla 0 veya tahmini bir sayı üretmemelidir. En yeni izlenen film başta
// olacak şekilde sıralanır.
export function getWatchedMovies(contents) {
  return contents
    .reduce((movies, content) => {
      if (content.type !== "Film" || content.status !== "İzlediklerim") {
        return movies;
      }

      const date = content.completedDate || content.finishDate || "";

      if (!date || Number.isNaN(new Date(date).getTime())) {
        return movies;
      }

      const minutesValue = Number(content.minutesPerEpisode);

      movies.push({
        title: content.title,
        date,
        minutes: Number.isFinite(minutesValue) && minutesValue > 0 ? minutesValue : null,
      });

      return movies;
    }, [])
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// "YYYY-MM-DD" gibi bir tarihi "14 Temmuz 2026" biçiminde okunabilir hale
// getirir — Takip Çizelgesi'nde (İzlenen Filmler listesi) zaten kullanılan
// aynı tr-TR biçimidir, tek kaynaktan tutarlılık için burada da kullanılır.
// Geçersiz/boş bir tarihte boş string döner — sahte bir tarih ASLA üretilmez.
export function formatDateLabel(dateString) {
  if (!dateString) {
    return "";
  }

  const parsedDate = new Date(dateString);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// 60 dakikanın altını "dk", üstünü "saat" olarak okunabilir gösterir.
export function formatMinutesLabel(minutes) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(minutes, 0) : 0;

  if (safeMinutes < 60) {
    return `${Math.round(safeMinutes)} dk`;
  }

  return `${(safeMinutes / 60).toFixed(1)} saat`;
}
