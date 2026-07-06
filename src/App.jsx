import { useEffect, useState } from "react";
import StatsPanel from "./components/StatsPanel";
import RecommendationsPage from "./components/RecommendationsPage";
import ContentForm from "./components/ContentForm";
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

  const addRecommendationToWatchLater = (recommendation) => {
  const newContent = {
    id: Date.now(),
    title: recommendation.title,
    type: recommendation.type,
    status: "İzleyecekler",
    startDate: "",
    targetEndDate: "",
    completedDate: "",
    totalEpisodes: 0,
    watchedEpisodes: 0,
    minutesPerEpisode: recommendation.minutesPerEpisode,
    wordsPerEpisode: recommendation.minutesPerEpisode * 120,
    comprehension: 0,
    difficulty: "",
    watchLogs: [],
  };

  setContents([...contents, newContent]);
};

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
          <div>
            <h3>{item.title}</h3>
            <p>
              {item.type} · {getStatus(item)}
            </p>
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
    return (
      <>
        <StatsPanel contents={contents} />

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

        <section className="content-list">
          <h2>İçeriklerim</h2>

          <div className="filters">
            <label className="visually-hidden" htmlFor="content-search">
              İçerik ara
            </label>
            <input
              id="content-search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="İçerik ara..."
            />

            <label className="visually-hidden" htmlFor="content-type-filter">
              Türe göre filtrele
            </label>
            <select
              id="content-type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option>Tümü</option>
              <option>Dizi</option>
              <option>Film</option>
              <option>Animasyon</option>
              <option>Anime</option>
              <option>YouTube</option>
              <option>Podcast</option>
            </select>
          </div>

          <h2>📌 İzleyecekler Listem</h2>
          {watchLaterList.length === 0 ? (
            <p className="empty-text">İzleyecek içerik yok.</p>
          ) : (
            watchLaterList.map(renderContentCard)
          )}

          <h2>▶️ Şu An İzlediklerim</h2>
          {watchingList.length === 0 ? (
            <p className="empty-text">Aktif izlenen içerik yok.</p>
          ) : (
            watchingList.map(renderContentCard)
          )}

          <h2>✅ İzlediklerim</h2>
          {completedList.length === 0 ? (
            <p className="empty-text">Henüz bitirilen içerik yok.</p>
          ) : (
            completedList.map(renderContentCard)
          )}
        </section>
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
          onClick={() => setActivePage("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={activePage === "tracking" ? "nav-active" : ""}
          onClick={() => setActivePage("tracking")}
        >
          Takip Çizelgesi
        </button>

        <button
          className={activePage === "recommendations" ? "nav-active" : ""}
          onClick={() => setActivePage("recommendations")}
        >
          Öneriler
        </button>

        <button
          className={activePage === "topMovies" ? "nav-active" : ""}
          onClick={() => setActivePage("topMovies")}
        >
          Top Rated Filmler
        </button>

        <button
          className={activePage === "topSeries" ? "nav-active" : ""}
          onClick={() => setActivePage("topSeries")}
        >
          Top Rated Diziler
        </button>

        <button
          className={activePage === "random" ? "nav-active" : ""}
          onClick={() => setActivePage("random")}
        >
          Rastgele Öner
        </button>

        <button
          className={activePage === "about" ? "nav-active" : ""}
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
          {theme === "dark" ? "☀️ Açık Tema" : "🌙 Koyu Tema"}
        </button>
      </nav>

      <main className="app">
        <header className="header">
          <h1>Comprehensible Input Tracker</h1>
          <p>
            İngilizce input süreni, bölüm ilerlemeni, hedeflerini ve kelime
            maruziyetini takip et.
          </p>
        </header>

        {activePage === "dashboard" && renderDashboardPage()}
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
    </div>
  );
}

export default App;