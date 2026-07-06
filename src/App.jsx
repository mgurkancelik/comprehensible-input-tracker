import { useEffect, useState } from "react";
import StatsPanel from "./components/StatsPanel";
import RecommendationsPage from "./components/RecommendationsPage";
import ContentForm from "./components/ContentForm";
import DiscoverPage from "./components/DiscoverPage";
import ContentDetailModal from "./components/ContentDetailModal";
import LibraryPage from "./components/LibraryPage";
import "./App.css";

const THEME_STORAGE_KEY = "ciTrackerTheme";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const [contents, setContents] = useState(() => {
    const savedContents = localStorage.getItem("inputContentsV5");

    if (savedContents) {
      return JSON.parse(savedContents);
    }

    return [];
  });

  const [form, setForm] = useState({
    title: "",
    type: "Dizi",
    status: "İzleniyor",
    startDate: "",
    targetEndDate: "",
    completedDate: "",
    totalEpisodes: "",
    watchedEpisodes: "",
    minutesPerEpisode: "",
    wordsPerEpisode: "",
    comprehension: 0,
    difficulty: "",
  });

  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("Tümü");

  const [showSearch, setShowSearch] = useState("");
  const [isFetchingShow, setIsFetchingShow] = useState(false);

  useEffect(() => {
    localStorage.setItem("inputContentsV5", JSON.stringify(contents));
  }, [contents]);

  const toSafeNumber = (value) => {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return 0;
    }

    return Math.max(numberValue, 0);
  };

  const getToday = () => {
    return new Date().toISOString().slice(0, 10);
  };

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

  const getLast14DaysMinutes = () => {
    const today = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    return contents.reduce((total, item) => {
      const logs = item.watchLogs || [];

      const itemMinutes = logs.reduce((sum, log) => {
        const logDate = new Date(log.date);

        if (logDate >= fourteenDaysAgo && logDate <= today) {
          return sum + (log.minutes || 0);
        }

        return sum;
      }, 0);

      return total + itemMinutes;
    }, 0);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm({
      ...form,
      [name]: value,
    });
  };

  const markAllInForm = () => {
    setForm({
      ...form,
      watchedEpisodes: form.totalEpisodes,
      status: "İzlediklerim",
      completedDate: form.completedDate || getToday(),
    });
  };

  const fetchShowInfo = async () => {
    if (showSearch.trim() === "") {
      alert("Önce bir dizi adı yaz.");
      return;
    }

    try {
      setIsFetchingShow(true);

      const response = await fetch(
        `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(
          showSearch
        )}&embed=episodes`
      );

      if (!response.ok) {
        alert("Dizi bulunamadı.");
        return;
      }

      const data = await response.json();

      const episodes = data._embedded?.episodes || [];
      const episodeCount = episodes.length;
      const runtime = data.averageRuntime || data.runtime || 25;

      setForm({
        ...form,
        title: data.name || "",
        type: "Dizi",
        totalEpisodes: episodeCount,
        minutesPerEpisode: runtime,
        wordsPerEpisode: runtime * 120,
      });
    } catch (error) {
      alert("Bilgiler çekilirken hata oluştu.");
      console.log(error);
    } finally {
      setIsFetchingShow(false);
    }
  };

  const addContent = (event) => {
    event.preventDefault();

    if (form.title.trim() === "") {
      alert("İçerik adı boş olamaz.");
      return;
    }

    const totalEpisodes = toSafeNumber(form.totalEpisodes);

    const watchedEpisodes = Math.min(
      toSafeNumber(form.watchedEpisodes),
      totalEpisodes
    );

    const minutesPerEpisode = toSafeNumber(form.minutesPerEpisode);
    const wordsPerEpisode = toSafeNumber(form.wordsPerEpisode);

    const today = getToday();
    const isCompleted = totalEpisodes > 0 && watchedEpisodes >= totalEpisodes;

    const newContent = {
      id: Date.now(),
      title: form.title,
      type: form.type,
      status: isCompleted
        ? "İzlediklerim"
        : watchedEpisodes > 0
        ? "İzleniyor"
        : form.status,
      startDate: form.startDate,
      targetEndDate: form.targetEndDate,
      completedDate: isCompleted
        ? form.completedDate || today
        : form.completedDate,
      totalEpisodes,
      watchedEpisodes,
      minutesPerEpisode,
      wordsPerEpisode,
      comprehension: 0,
      difficulty: "",
      watchLogs:
        watchedEpisodes > 0
          ? [
              {
                date: form.startDate || today,
                minutes: watchedEpisodes * minutesPerEpisode,
                words: watchedEpisodes * wordsPerEpisode,
                title: form.title,
              },
            ]
          : [],
    };

    setContents([...contents, newContent]);

    setForm({
      title: "",
      type: "Dizi",
      status: "İzleniyor",
      startDate: "",
      targetEndDate: "",
      completedDate: "",
      totalEpisodes: "",
      watchedEpisodes: "",
      minutesPerEpisode: "",
      wordsPerEpisode: "",
      comprehension: 0,
      difficulty: "",
    });

    setShowSearch("");
  };

  const deleteContent = (id, title) => {
    const confirmed = window.confirm(
      `"${title}" içeriğini silmek istediğine emin misin? Bu işlem geri alınamaz.`
    );

    if (!confirmed) {
      return;
    }

    setContents(contents.filter((item) => item.id !== id));
  };

  const watchOneEpisode = (id) => {
    const today = getToday();

    setContents(
      contents.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (item.watchedEpisodes >= item.totalEpisodes) {
          return item;
        }

        const newWatchedEpisodes = item.watchedEpisodes + 1;
        const isFinished = newWatchedEpisodes >= item.totalEpisodes;

        return {
          ...item,
          watchedEpisodes: newWatchedEpisodes,
          status: isFinished ? "İzlediklerim" : "İzleniyor",
          completedDate: isFinished ? today : item.completedDate,
          watchLogs: [
            ...(item.watchLogs || []),
            {
              date: today,
              minutes: item.minutesPerEpisode,
              words: item.wordsPerEpisode,
              title: item.title,
            },
          ],
        };
      })
    );
  };

  const markAllWatched = (id) => {
    const today = getToday();

    setContents(
      contents.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const remainingEpisodes = Math.max(
          item.totalEpisodes - item.watchedEpisodes,
          0
        );

        return {
          ...item,
          watchedEpisodes: item.totalEpisodes,
          status: "İzlediklerim",
          completedDate: item.completedDate || today,
          watchLogs: [
            ...(item.watchLogs || []),
            {
              date: today,
              minutes: remainingEpisodes * item.minutesPerEpisode,
              words: remainingEpisodes * item.wordsPerEpisode,
              title: item.title,
            },
          ],
        };
      })
    );
  };

  const buildWatchlistContent = ({
    title,
    type,
    minutesPerEpisode,
    source = "manual",
    sourceId = null,
    mediaType = null,
    posterUrl = null,
    genre = "",
    overview = "",
    estimatedLevel = "",
    tmdbRating = null,
    releaseYear = null,
    seasons = [],
    status = "İzleyecekler",
  }) => {
    const safeMinutes = toSafeNumber(minutesPerEpisode);
    const today = getToday();
    const isCompleted = status === "İzlediklerim";
    const isWatching = status === "İzleniyor";

    return {
      id: Date.now(),
      title,
      type,
      status,
      startDate: isWatching || isCompleted ? today : "",
      targetEndDate: "",
      completedDate: isCompleted ? today : "",
      totalEpisodes: 0,
      watchedEpisodes: 0,
      minutesPerEpisode: safeMinutes,
      wordsPerEpisode: safeMinutes * 120,
      comprehension: 0,
      difficulty: "",
      watchLogs: [],
      source,
      sourceId,
      mediaType,
      posterUrl,
      genre,
      overview,
      estimatedLevel,
      tmdbRating,
      releaseYear,
      seasons,
    };
  };

  const addRecommendationToWatchLater = (recommendation) => {
    const newContent = buildWatchlistContent({
      title: recommendation.title,
      type: recommendation.type,
      minutesPerEpisode: recommendation.minutesPerEpisode,
    });

    setContents([...contents, newContent]);
  };

  // Keşfet öğesine karşılık gelen kayıtlı content'i (varsa) bulur.
  const findDiscoveryContent = (item) => {
    return contents.find((content) => {
      if (content.source !== "tmdb") {
        return false;
      }

      if (item.id) {
        return content.sourceId === item.id;
      }

      return (
        content.title === item.title && content.mediaType === item.mediaType
      );
    });
  };

  const isDiscoveryItemAdded = (item) => Boolean(findDiscoveryContent(item));

  // Bir içeriğin durumunu (İzleyecekler / İzleniyor / İzlediklerim) doğrudan
  // günceller. Bölüm/sezon verisine hiç dokunmaz — sadece status ve
  // buna bağlı start/completed tarihlerini ayarlar.
  const setContentStatus = (contentId, status) => {
    const today = getToday();
    const isCompleted = status === "İzlediklerim";
    const isWatching = status === "İzleniyor";

    setContents((prevContents) =>
      prevContents.map((content) => {
        if (content.id !== contentId) {
          return content;
        }

        return {
          ...content,
          status,
          startDate:
            content.startDate ||
            (isWatching || isCompleted ? today : content.startDate),
          completedDate: isCompleted
            ? content.completedDate || today
            : content.completedDate,
        };
      })
    );
  };

  const addDiscoveryItemToWatchlist = (item, status = "İzleyecekler") => {
    const existingContent = findDiscoveryContent(item);

    if (existingContent) {
      setContentStatus(existingContent.id, status);
      return;
    }

    const newContent = buildWatchlistContent({
      title: item.title,
      type: item.type,
      minutesPerEpisode: item.minutesPerEpisode,
      source: "tmdb",
      sourceId: item.id,
      mediaType: item.mediaType,
      posterUrl: item.posterUrl,
      genre: item.genre,
      overview: item.overview,
      estimatedLevel: item.estimatedLevel,
      tmdbRating: item.rating,
      releaseYear: item.year,
      status,
    });

    setContents([...contents, newContent]);
  };

  const computeAverageRuntime = (seasonsList, fallback) => {
    const runtimes = seasonsList
      .flatMap((season) => season.episodes)
      .map((episode) => episode.runtime)
      .filter((runtime) => typeof runtime === "number" && runtime > 0);

    if (runtimes.length === 0) {
      return fallback;
    }

    const total = runtimes.reduce((sum, runtime) => sum + runtime, 0);
    return Math.round(total / runtimes.length);
  };

  // Dizi detayları (getSeriesDetails) yüklenince gerçek toplam bölüm sayısını
  // yazar. Sadece listeye eklenmiş dizi içerikleri için çalışır; film veya
  // eklenmemiş içeriklerde no-op'tur.
  const syncSeriesTotalEpisodes = (sourceId, totalEpisodeCount) => {
    if (!totalEpisodeCount) {
      return;
    }

    setContents((prevContents) =>
      prevContents.map((content) => {
        if (content.sourceId !== sourceId || content.mediaType !== "tv") {
          return content;
        }

        return {
          ...content,
          totalEpisodes: totalEpisodeCount,
        };
      })
    );
  };

  // Bir sezonun bölümleri (getSeasonDetails) yüklenince content.seasons'ı
  // günceller. Mevcut watched/watchedAt değerleri her zaman korunur, sadece
  // eksik bölümler eklenir veya güncel açıklama/süre bilgisi tazelenir.
  const syncSeasonEpisodes = (sourceId, seasonNumber, seasonName, tmdbEpisodes) => {
    setContents((prevContents) =>
      prevContents.map((content) => {
        if (content.sourceId !== sourceId || content.mediaType !== "tv") {
          return content;
        }

        const existingSeasons = content.seasons || [];
        const existingSeason = existingSeasons.find(
          (season) => season.seasonNumber === seasonNumber
        );

        const existingEpisodesByNumber = new Map(
          (existingSeason?.episodes || []).map((episode) => [
            episode.episodeNumber,
            episode,
          ])
        );

        const mergedEpisodes = tmdbEpisodes.map((episode) => {
          const existingEpisode = existingEpisodesByNumber.get(
            episode.episode_number
          );

          return {
            id: `tmdb-episode-${episode.id}`,
            episodeNumber: episode.episode_number,
            name: episode.name || "",
            runtime:
              typeof episode.runtime === "number" ? episode.runtime : null,
            airDate: episode.air_date || "",
            overview: episode.overview || "",
            watched: existingEpisode?.watched || false,
            watchedAt: existingEpisode?.watchedAt || null,
          };
        });

        const updatedSeasons = [
          ...existingSeasons.filter(
            (season) => season.seasonNumber !== seasonNumber
          ),
          { seasonNumber, name: seasonName, episodes: mergedEpisodes },
        ];

        const watchedEpisodes = updatedSeasons.reduce(
          (sum, season) =>
            sum + season.episodes.filter((episode) => episode.watched).length,
          0
        );

        const averageRuntime = computeAverageRuntime(
          updatedSeasons,
          content.minutesPerEpisode
        );

        return {
          ...content,
          seasons: updatedSeasons,
          watchedEpisodes,
          minutesPerEpisode: averageRuntime,
          wordsPerEpisode: averageRuntime * 120,
        };
      })
    );
  };

  // Tek bir bölümün izlendi durumunu değiştirir. Eski içeriklerde seasons
  // yoksa veya eşleşen bölüm bulunamazsa güvenli şekilde hiçbir şey yapmaz.
  const toggleEpisodeWatched = (sourceId, seasonNumber, episodeId) => {
    const today = getToday();

    setContents((prevContents) =>
      prevContents.map((content) => {
        if (content.sourceId !== sourceId || content.mediaType !== "tv") {
          return content;
        }

        const seasonsList = content.seasons || [];

        const updatedSeasons = seasonsList.map((season) => {
          if (season.seasonNumber !== seasonNumber) {
            return season;
          }

          return {
            ...season,
            episodes: season.episodes.map((episode) => {
              if (episode.id !== episodeId) {
                return episode;
              }

              const nextWatched = !episode.watched;

              return {
                ...episode,
                watched: nextWatched,
                watchedAt: nextWatched ? today : null,
              };
            }),
          };
        });

        const watchedEpisodes = updatedSeasons.reduce(
          (sum, season) =>
            sum + season.episodes.filter((episode) => episode.watched).length,
          0
        );

        const isFinished =
          content.totalEpisodes > 0 &&
          watchedEpisodes >= content.totalEpisodes;

        return {
          ...content,
          seasons: updatedSeasons,
          watchedEpisodes,
          completedDate:
            isFinished && !content.completedDate
              ? today
              : content.completedDate,
        };
      })
    );
  };

  // Bir sezondaki tüm bölümleri tek seferde işaretler/kaldırır.
  // toggleEpisodeWatched ile aynı güvenli desen, sadece tüm bölümlere uygulanır.
  const toggleSeasonWatched = (sourceId, seasonNumber, markWatched) => {
    const today = getToday();

    setContents((prevContents) =>
      prevContents.map((content) => {
        if (content.sourceId !== sourceId || content.mediaType !== "tv") {
          return content;
        }

        const seasonsList = content.seasons || [];

        const updatedSeasons = seasonsList.map((season) => {
          if (season.seasonNumber !== seasonNumber) {
            return season;
          }

          return {
            ...season,
            episodes: season.episodes.map((episode) => ({
              ...episode,
              watched: markWatched,
              watchedAt: markWatched ? today : null,
            })),
          };
        });

        const watchedEpisodes = updatedSeasons.reduce(
          (sum, season) =>
            sum + season.episodes.filter((episode) => episode.watched).length,
          0
        );

        const isFinished =
          content.totalEpisodes > 0 &&
          watchedEpisodes >= content.totalEpisodes;

        return {
          ...content,
          seasons: updatedSeasons,
          watchedEpisodes,
          completedDate:
            isFinished && !content.completedDate
              ? today
              : content.completedDate,
        };
      })
    );
  };

  // Kayıtlı bir content nesnesini ContentDetailModal'ın beklediği (Keşfet
  // sayfasından gelen) alan adlarına çevirir; Dashboard kartından "Bölümleri
  // Yönet" ile aynı modalı açabilmek için kullanılır.
  const buildDiscoverItemFromContent = (content) => ({
    id: content.sourceId,
    title: content.title,
    year: content.releaseYear,
    rating: content.tmdbRating,
    type: content.type,
    mediaType: content.mediaType,
    genre: content.genre,
    estimatedLevel: content.estimatedLevel,
    overview: content.overview,
    posterUrl: content.posterUrl,
    minutesPerEpisode: content.minutesPerEpisode,
  });

  const [managingContentId, setManagingContentId] = useState(null);

  const managedContent =
    managingContentId !== null
      ? contents.find((content) => content.id === managingContentId)
      : null;

  const MAX_VISIBLE_SEASON_CHIPS = 4;

  const getSeriesProgressSummary = (item) => {
    const seasonsList = item.seasons || [];

    const orderedSeasons = [
      ...seasonsList.filter((season) => season.seasonNumber !== 0),
      ...seasonsList.filter((season) => season.seasonNumber === 0),
    ];

    const completionPercent =
      item.totalEpisodes > 0
        ? Math.min(
            100,
            Math.round((item.watchedEpisodes / item.totalEpisodes) * 100)
          )
        : 0;

    const isFullyWatched =
      item.totalEpisodes > 0 && item.watchedEpisodes >= item.totalEpisodes;

    let nextEpisodeLabel =
      "Sıradaki bölümü görmek için sezonları görüntüle.";

    if (isFullyWatched) {
      nextEpisodeLabel = "Tüm bölümler tamamlandı";
    } else {
      for (const season of orderedSeasons) {
        const nextEpisode = [...season.episodes]
          .sort((a, b) => a.episodeNumber - b.episodeNumber)
          .find((episode) => !episode.watched);

        if (nextEpisode) {
          nextEpisodeLabel = `Sıradaki: S${season.seasonNumber}E${
            nextEpisode.episodeNumber
          } - ${nextEpisode.name || "Başlıksız Bölüm"}`;
          break;
        }
      }
    }

    const visibleSeasons = orderedSeasons.slice(0, MAX_VISIBLE_SEASON_CHIPS);
    const hiddenSeasonCount = Math.max(
      orderedSeasons.length - MAX_VISIBLE_SEASON_CHIPS,
      0
    );

    return {
      completionPercent,
      nextEpisodeLabel,
      visibleSeasons,
      hiddenSeasonCount,
    };
  };

  const totalWatchedMinutes = contents.reduce(
    (sum, item) => sum + item.watchedEpisodes * item.minutesPerEpisode,
    0
  );

  const heroHours = (totalWatchedMinutes / 60).toFixed(1);

  const totalWatchedEpisodes = contents.reduce(
    (sum, item) => sum + item.watchedEpisodes,
    0
  );

  const activeWatchingCount = contents.filter(
    (item) => getStatus(item) === "İzleniyor"
  ).length;

  const activeWatchLaterCount = contents.filter(
    (item) => getStatus(item) === "İzleyecekler"
  ).length;

  const headerStatusMessage =
    activeWatchingCount === 0
      ? "İlk içeriğini ekleyerek input takibine başlayabilirsin."
      : "Input yolculuğun devam ediyor.";

  const filteredContents = contents.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchText.toLowerCase());

    const matchesType = selectedType === "Tümü" || item.type === selectedType;

    return matchesSearch && matchesType;
  });

  const watchLaterList = filteredContents.filter(
    (item) => getStatus(item) === "İzleyecekler"
  );

  const watchingList = filteredContents.filter(
    (item) => getStatus(item) === "İzleniyor"
  );

  const completedList = filteredContents.filter(
    (item) => getStatus(item) === "İzlediklerim"
  );

  const getDailyAnalytics = () => {
    const days = [];

    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const isoDate = date.toISOString().slice(0, 10);

      days.push({
        date: isoDate,
        label: date.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "short",
        }),
        minutes: 0,
        words: 0,
      });
    }

    contents.forEach((content) => {
      const logs = content.watchLogs || [];

      logs.forEach((log) => {
        const day = days.find((item) => item.date === log.date);

        if (day) {
          day.minutes += log.minutes || 0;
          day.words += log.words || 0;
        }
      });
    });

    return days;
  };

  const getMonthlyAnalytics = () => {
    const months = {};

    contents.forEach((content) => {
      const logs = content.watchLogs || [];

      logs.forEach((log) => {
        const date = new Date(log.date);

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

        months[monthKey].minutes += log.minutes || 0;
        months[monthKey].words += log.words || 0;

        if (!months[monthKey].titles[content.title]) {
          months[monthKey].titles[content.title] = 0;
        }

        months[monthKey].titles[content.title] += log.minutes || 0;
      });
    });

    return Object.values(months);
  };

  const renderLineChart = (data, valueKey, title, valueLabel) => {
    const maxValue = Math.max(...data.map((item) => item[valueKey]), 1);

    const chartWidth = 700;
    const chartHeight = 260;
    const paddingX = 46;
    const paddingY = 32;
    const innerWidth = chartWidth - paddingX * 2;
    const innerHeight = chartHeight - paddingY * 2;

    const points = data.map((item, index) => {
      const x = paddingX + (index * innerWidth) / (data.length - 1);
      const y =
        paddingY + innerHeight - (item[valueKey] / maxValue) * innerHeight;

      return {
        x,
        y,
        label: item.label,
        value: item[valueKey],
      };
    });

    const polylinePoints = points
      .map((point) => `${point.x},${point.y}`)
      .join(" ");

    return (
      <div className="chart-card">
        <div className="chart-head">
          <h3>{title}</h3>
          <span>{valueLabel}</span>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="line-chart">
          <line
            x1={paddingX}
            y1={paddingY + innerHeight}
            x2={chartWidth - paddingX}
            y2={paddingY + innerHeight}
            className="chart-axis"
          />

          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={paddingY + innerHeight}
            className="chart-axis"
          />

          <polyline points={polylinePoints} className="chart-line" />

          {points.map((point) => (
            <g key={`${title}-${point.label}`}>
              <circle cx={point.x} cy={point.y} r="5" className="chart-dot" />
              <text
                x={point.x}
                y={chartHeight - 8}
                textAnchor="middle"
                className="chart-label"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderTrackingPage = () => {
    const dailyData = getDailyAnalytics();
    const monthlyData = getMonthlyAnalytics();

    const lastDaysMinutes = dailyData.reduce(
      (sum, day) => sum + day.minutes,
      0
    );

    const lastDaysWords = dailyData.reduce((sum, day) => sum + day.words, 0);

    return (
      <section className="tracking-page">
        <div className="page-title">
          <h2>Takip Çizelgesi</h2>
          <p>Günlük, haftalık ve aylık input gelişimini buradan takip et.</p>
        </div>

        <div className="tracking-summary">
          <div className="stat-card big-stat">
            <span>Son 14 Gün Input</span>
            <strong>{(lastDaysMinutes / 60).toFixed(1)} saat</strong>
          </div>

          <div className="stat-card big-stat">
            <span>Son 14 Gün Kelime</span>
            <strong>{lastDaysWords.toLocaleString("tr-TR")}</strong>
          </div>

          <div className="stat-card big-stat">
            <span>Log Sayısı</span>
            <strong>
              {contents.reduce(
                (sum, item) => sum + (item.watchLogs || []).length,
                0
              )}
            </strong>
          </div>
        </div>

        <div className="charts-grid">
          {renderLineChart(
            dailyData,
            "minutes",
            "Günlük Input Süresi",
            "Dakika bazlı"
          )}

          {renderLineChart(
            dailyData,
            "words",
            "Günlük Input Kelimesi",
            "Kelime bazlı"
          )}
        </div>

        <div className="monthly-section">
          <h2>Aylık Özet</h2>

          {monthlyData.length === 0 ? (
            <p className="empty-text">Henüz aylık veri yok.</p>
          ) : (
            monthlyData.map((month) => (
              <div className="month-card" key={month.label}>
                <h3>{month.label}</h3>

                <div className="month-stats">
                  <p>Toplam input: {(month.minutes / 60).toFixed(1)} saat</p>
                  <p>Toplam kelime: {month.words.toLocaleString("tr-TR")}</p>
                </div>

                <ul>
                  {Object.entries(month.titles).map(([title, minutes]) => (
                    <li key={title}>
                      {title}: {(minutes / 60).toFixed(1)} saat
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    );
  };

  const renderContentCard = (item) => {
    const totalEpisodes = Math.max(item.totalEpisodes, 0);
    const watchedEpisodes = Math.min(
      Math.max(item.watchedEpisodes, 0),
      totalEpisodes
    );

    const remainingEpisodes = Math.max(totalEpisodes - watchedEpisodes, 0);
    const remainingMinutes = remainingEpisodes * item.minutesPerEpisode;
    const remainingHours = (remainingMinutes / 60).toFixed(1);

    const watchedMinutes = watchedEpisodes * item.minutesPerEpisode;
    const watchedHours = (watchedMinutes / 60).toFixed(1);

    const estimatedWords = watchedEpisodes * item.wordsPerEpisode;

    const progress =
      totalEpisodes === 0
        ? 0
        : Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100));

    const today = new Date();

    const targetDate = item.targetEndDate ? new Date(item.targetEndDate) : null;

    const daysLeft = targetDate
      ? Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))
      : null;

    const dailyRequiredMinutes =
      daysLeft && daysLeft > 0
        ? Math.ceil(remainingMinutes / daysLeft)
        : remainingMinutes;

    const dailyRequiredHours = (dailyRequiredMinutes / 60).toFixed(1);

    const isFinished = watchedEpisodes >= totalEpisodes && totalEpisodes > 0;

    return (
      <div className="content-card" key={item.id}>
        <div className="card-top">
          <div className="card-top-main">
            {item.posterUrl && (
              <img
                src={item.posterUrl}
                alt={`${item.title} posteri`}
                className="card-thumbnail"
              />
            )}

            <div>
              <h3>{item.title}</h3>
              <p>
                {item.type} · {getStatus(item)}
              </p>

              {(item.tmdbRating || item.estimatedLevel) && (
                <div className="card-badges">
                  {item.tmdbRating ? (
                    <span className="card-badge">
                      ⭐ {item.tmdbRating.toFixed(1)}
                    </span>
                  ) : null}

                  {item.estimatedLevel ? (
                    <span className="card-badge card-badge--level">
                      {item.estimatedLevel}
                    </span>
                  ) : null}
                </div>
              )}

              {item.overview && (
                <p className="card-overview">{item.overview}</p>
              )}
            </div>
          </div>

          <button
            className="delete-btn"
            onClick={() => deleteContent(item.id, item.title)}
          >
            Sil
          </button>
        </div>

        <div className="circle-progress-row">
          <div
            className="circle-progress"
            style={{
              background: `conic-gradient(var(--color-primary) ${progress}%, var(--color-surface-alt) 0)`,
            }}
          >
            <div>{progress}%</div>
          </div>

          <div>
            <strong>
              {watchedEpisodes}/{totalEpisodes} Bölüm
            </strong>
            <p>{remainingEpisodes} bölüm kaldı</p>
          </div>
        </div>

        <div className="details-grid">
          <div>
            <span>İzlenen input</span>
            <strong>{watchedHours} saat</strong>
          </div>

          <div>
            <span>Kalan süre</span>
            <strong>{remainingHours} saat</strong>
          </div>

          <div>
            <span>Kelime</span>
            <strong>{estimatedWords.toLocaleString("tr-TR")}</strong>
          </div>

          <div>
            <span>Günlük gereken</span>
            <strong>
              {item.targetEndDate ? `${dailyRequiredHours} saat` : "Yok"}
            </strong>
          </div>
        </div>

        <div className="date-info">
          <p>Başlama: {item.startDate || "Belirtilmedi"}</p>
          <p>Hedef bitiş: {item.targetEndDate || "Belirtilmedi"}</p>
          <p>Gerçek bitiş: {item.completedDate || "Henüz bitmedi"}</p>
          <p>
            Hedefe kalan gün:{" "}
            {daysLeft === null ? "Belirtilmedi" : Math.max(daysLeft, 0)}
          </p>
        </div>

        {item.mediaType === "tv" && (
          <div className="series-progress">
            {item.seasons && item.seasons.length > 0 ? (
              (() => {
                const {
                  completionPercent,
                  nextEpisodeLabel,
                  visibleSeasons,
                  hiddenSeasonCount,
                } = getSeriesProgressSummary(item);

                return (
                  <>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>

                    <p className="series-progress-text">
                      Tamamlanma: %{completionPercent} · {nextEpisodeLabel}
                    </p>

                    <div className="season-chip-summary">
                      {visibleSeasons.map((season) => {
                        const watchedCount = season.episodes.filter(
                          (episode) => episode.watched
                        ).length;
                        const totalCount = season.episodes.length;
                        const isFull =
                          totalCount > 0 && watchedCount >= totalCount;

                        return (
                          <span
                            className="season-mini-chip"
                            key={season.seasonNumber}
                          >
                            {season.seasonNumber === 0
                              ? "Özel"
                              : `S${season.seasonNumber}`}{" "}
                            {isFull ? "✓" : `${watchedCount}/${totalCount}`}
                          </span>
                        );
                      })}

                      {hiddenSeasonCount > 0 && (
                        <span className="season-mini-chip season-mini-chip--muted">
                          +{hiddenSeasonCount} sezon
                        </span>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="series-progress-text">
                Sezon ve bölüm bilgilerini görmek için "Bölümleri Yönet"e
                bas.
              </p>
            )}

            <button
              type="button"
              className="manage-episodes-btn"
              onClick={() => setManagingContentId(item.id)}
            >
              🎬 Bölümleri Yönet
            </button>
          </div>
        )}

        <div className="card-actions">
          <button
            className="watch-btn"
            onClick={() => watchOneEpisode(item.id)}
            disabled={isFinished}
          >
            +1 bölüm izledim
          </button>

          <button
            className="complete-btn"
            onClick={() => markAllWatched(item.id)}
            disabled={isFinished}
          >
            Tümünü izledim
          </button>
        </div>
      </div>
    );
  };

  const renderDashboardPage = () => {
    const last14DaysMinutes = getLast14DaysMinutes();
    const last14DaysHours = (last14DaysMinutes / 60).toFixed(1);
    const hasRecentMomentum = last14DaysMinutes > 0;

    const snapshotNarrative = hasRecentMomentum
      ? `Bugüne kadar ${heroHours} saat input aldın ve ${totalWatchedEpisodes} bölüm tamamladın. Son 14 günde ${last14DaysHours} saatlik güzel bir ilerleme kaydettin.`
      : `Bugüne kadar ${heroHours} saat input aldın ve ${totalWatchedEpisodes} bölüm tamamladın. Son 14 günde henüz input eklemedin, küçük bir adım atmaya ne dersin?`;

    return (
      <>
        <section className="summary-card">
          <div className="summary-head">
            <h2>🧭 Learning Snapshot</h2>
            <p>{snapshotNarrative}</p>
          </div>

          <div className="summary-metrics">
            <div className="summary-metric">
              <span>Toplam Input</span>
              <strong>{heroHours} saat</strong>
            </div>

            <div className="summary-metric">
              <span>Son 14 Gün</span>
              <strong>{last14DaysHours} saat</strong>
            </div>

            <div className="summary-metric">
              <span>İzlenen Bölüm</span>
              <strong>{totalWatchedEpisodes}</strong>
            </div>

            <div className="summary-metric">
              <span>Aktif İçerik</span>
              <strong>{activeWatchingCount}</strong>
            </div>

            <div className="summary-metric">
              <span>İzleyecekler</span>
              <strong>{activeWatchLaterCount}</strong>
            </div>
          </div>

          <div className="quick-actions">
            <p className="quick-actions-label">Hızlı Aksiyonlar</p>

            <div className="quick-actions-row">
              <a className="quick-action-hint" href="#new-content-anchor">
                ➕ Yeni içerik ekle
              </a>

              <button type="button" onClick={() => setActivePage("discover")}>
                🔎 Keşfet'e git
              </button>

              <button type="button" onClick={() => setActivePage("tracking")}>
                📈 Takip çizelgesini gör
              </button>
            </div>
          </div>
        </section>

        <StatsPanel contents={contents} />

        <div id="new-content-anchor">
          <ContentForm
            form={form}
            handleChange={handleChange}
            addContent={addContent}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
            fetchShowInfo={fetchShowInfo}
            isFetchingShow={isFetchingShow}
            markAllInForm={markAllInForm}
          />
        </div>

      </>
    );
  };

  const renderSimplePage = (title, description) => {
    return (
      <section className="form-section">
        <div className="page-title">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <p className="empty-text">
          Bu bölümün taslağı hazır. Bir sonraki adımda içeriğini dolduracağız.
        </p>
      </section>
    );
  };

  return (
    <div>
      <nav className="top-nav">
        <button
          className={activePage === "dashboard" ? "nav-active" : ""}
          aria-current={activePage === "dashboard" ? "page" : undefined}
          onClick={() => setActivePage("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={activePage === "discover" ? "nav-active" : ""}
          aria-current={activePage === "discover" ? "page" : undefined}
          onClick={() => setActivePage("discover")}
        >
          🔎 Keşfet
        </button>

        <button
          className={activePage === "library" ? "nav-active" : ""}
          aria-current={activePage === "library" ? "page" : undefined}
          onClick={() => setActivePage("library")}
        >
          📚 Kütüphanem
        </button>

        <button
          className={activePage === "tracking" ? "nav-active" : ""}
          aria-current={activePage === "tracking" ? "page" : undefined}
          onClick={() => setActivePage("tracking")}
        >
          Takip Çizelgesi
        </button>

        <button
          className={activePage === "about" ? "nav-active" : ""}
          aria-current={activePage === "about" ? "page" : undefined}
          onClick={() => setActivePage("about")}
        >
          Hakkında
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-pressed={theme === "light"}
          aria-label={
            theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"
          }
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span className="theme-toggle-label">
            {theme === "dark" ? "Açık Tema" : "Koyu Tema"}
          </span>
        </button>
      </nav>

      <main className="app">
        <header className="header">
          <span className="header-kicker">📚 Comprehensible Input Takibi</span>
          <h1>Comprehensible Input Tracker</h1>
          <p>
            İngilizce input süreni, bölüm ilerlemeni, hedeflerini ve kelime
            maruziyetini takip et.
          </p>
          <p className="header-status">{headerStatusMessage}</p>
          <div className="header-highlight">
            <span>⏱️ Toplam input:</span>
            <strong>{heroHours} saat</strong>
          </div>
        </header>

        {activePage === "dashboard" && renderDashboardPage()}

        {activePage === "discover" && (
          <DiscoverPage
            isItemAdded={isDiscoveryItemAdded}
            onAddToWatchlist={addDiscoveryItemToWatchlist}
            contents={contents}
            onSyncSeriesTotalEpisodes={syncSeriesTotalEpisodes}
            onSyncSeasonEpisodes={syncSeasonEpisodes}
            onToggleEpisodeWatched={toggleEpisodeWatched}
            onToggleSeasonWatched={toggleSeasonWatched}
          />
        )}

        {activePage === "library" && (
          <LibraryPage
            searchText={searchText}
            setSearchText={setSearchText}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            watchLaterList={watchLaterList}
            watchingList={watchingList}
            completedList={completedList}
            renderContentCard={renderContentCard}
          />
        )}

        {activePage === "tracking" && renderTrackingPage()}

        {activePage === "recommendations" && (
  <RecommendationsPage
    addRecommendationToWatchLater={addRecommendationToWatchLater}
  />
)}

        {activePage === "topMovies" &&
          renderSimplePage(
            "Top Rated Filmler",
            "Yüksek puanlı filmler burada listelenecek."
          )}

        {activePage === "topSeries" &&
          renderSimplePage(
            "Top Rated Diziler",
            "Yüksek puanlı diziler burada listelenecek."
          )}

        {activePage === "random" &&
          renderSimplePage(
            "Rastgele Öner",
            "Bugün ne izleyeceğine karar veremiyorsan buradan rastgele içerik önerisi alacaksın."
          )}

        {activePage === "about" && (
          <section className="form-section">
            <h2>Hakkında</h2>
            <p>
              Bu uygulama comprehensible input yöntemiyle İngilizce öğrenenlerin
              izlediği içerikleri, input süresini, kelime maruziyetini ve
              ilerleme hedeflerini takip etmesi için geliştiriliyor.
            </p>
          </section>
        )}
      </main>

      {managedContent && (
        <ContentDetailModal
          item={buildDiscoverItemFromContent(managedContent)}
          isAdded={true}
          onAdd={(status) => setContentStatus(managedContent.id, status)}
          onClose={() => setManagingContentId(null)}
          contents={contents}
          onSyncSeriesTotalEpisodes={syncSeriesTotalEpisodes}
          onSyncSeasonEpisodes={syncSeasonEpisodes}
          onToggleEpisodeWatched={toggleEpisodeWatched}
          onToggleSeasonWatched={toggleSeasonWatched}
        />
      )}
    </div>
  );
}

export default App;