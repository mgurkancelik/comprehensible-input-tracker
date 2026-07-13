import { useEffect, useState } from "react";
import StatsPanel from "./components/StatsPanel";
import RecommendationsPage from "./components/RecommendationsPage";
import ContentForm from "./components/ContentForm";
import DiscoverPage from "./components/DiscoverPage";
import ContentDetailModal from "./components/ContentDetailModal";
import LibraryPage from "./components/LibraryPage";
import NotesModal from "./components/NotesModal";
import InputGoalCard from "./components/InputGoalCard";
import AuthScreen from "./components/AuthScreen";
import LoginRequiredState from "./components/LoginRequiredState";
import Modal from "./components/ui/Modal";
import Chip from "./components/ui/Chip";
import LoadingState from "./components/ui/LoadingState";
import ErrorState from "./components/ui/ErrorState";
import {
  getTotalInputMinutes,
  getMinutesInRange,
  getDailyInputBuckets,
  getMonthlyInputSummary,
  getInputRecordCounts,
  formatMinutesLabel,
} from "./utils/stats";
import {
  getUserContents,
  createUserContent,
  updateUserContent,
  deleteUserContent,
} from "./services/userContents";
import { getContents, createContent } from "./services/contents";
import { registerUser, loginUser, getCurrentUser } from "./services/auth";
import {
  getMediaTypeFromContentType,
  canManageEpisodes,
} from "./utils/contentIdentity";
import "./App.css";

const THEME_STORAGE_KEY = "ciTrackerTheme";
const GOAL_STORAGE_KEY = "inputGoalTargetHours";
const VALID_GOAL_HOURS = [100, 250, 500, 1000];
const AUTH_TOKEN_STORAGE_KEY = "ciAuthToken";
const AUTH_USER_STORAGE_KEY = "ciAuthUser";
// Artık kullanılmıyor — MongoDB tek veri kaynağı. Eski tarayıcılarda kalmış
// olabilecek içerik cache'ini temizlemek için anahtarını burada tutuyoruz.
const LEGACY_CONTENTS_STORAGE_KEY = "inputContentsV5";

// Backend'deki UserContent.status enum'u (İngilizce) ile frontend'in
// beklediği status metinleri (Türkçe) farklı olduğu için köprü kurulur.
// "dropped" için ayrı bir liste henüz yok, güvenli varsayılan olarak
// "İzleyecekler"e düşer.
const API_STATUS_TO_FRONTEND_STATUS = {
  watchlist: "İzleyecekler",
  watching: "İzleniyor",
  completed: "İzlediklerim",
  dropped: "İzleyecekler",
};

// Frontend status metinlerini backend'in beklediği enum değerlerine çevirir
// (createUserContent çağrılırken kullanılır).
const FRONTEND_STATUS_TO_API_STATUS = {
  İzleyecekler: "watchlist",
  İzleniyor: "watching",
  İzlediklerim: "completed",
};

// Keşfet öğelerinin sourceId'si "tmdb-movie-12345" / "tmdb-tv-12345" gibi
// önekli bir string'dir (bkz. DiscoverPage.jsx normalizeTmdbItem) — backend'in
// Content.tmdbId alanı ise Number tipindedir. Bu fonksiyon sondaki sayısal
// kısmı çıkarır; zaten sayısal bir değerse (örn. backend'den populate edilmiş
// contentData.tmdbId) olduğu gibi döner.
function extractTmdbNumericId(rawId) {
  if (rawId === null || rawId === undefined) {
    return null;
  }

  if (typeof rawId === "number") {
    return rawId;
  }

  const match = String(rawId).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

// Bir değeri "geçerli, pozitif bölüm sayısı" olarak kabul edilebiliyorsa
// sayı olarak, aksi halde null olarak döner. mapUserContentToFrontendContent
// içinde totalEpisodes için öncelik zinciri kurarken (UserContent → Content
// → 0) `0`'ın "geçerli ama henüz bilinmiyor" anlamına da gelebilmesi
// nedeniyle `||` zincirine güvenmek yerine bu açık kontrol kullanılır.
function toPositiveEpisodeCount(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

// Kullanıcının kütüphanesinde (contents state) eklenmek istenen adayla
// (candidate) aynı içerik zaten var mı diye bakar — öncelik sırası:
// 1) aynı mediaType + tmdbId, 2) aynı sourceId, 3) normalize edilmiş
// title + type. Bu, saveContentToBackend'e hiç network isteği atmadan
// önce hızlı bir ön kontrol sağlar; backend'in userId+contentId unique
// index'i (409) her durumda son güvenlik ağı olarak kalmaya devam eder.
function findExistingContentForCandidate(contents, candidate) {
  if (
    candidate.mediaType &&
    Number.isInteger(candidate.tmdbId) &&
    candidate.tmdbId > 0
  ) {
    const byTmdbId = contents.find(
      (item) =>
        item.mediaType === candidate.mediaType && item.tmdbId === candidate.tmdbId
    );

    if (byTmdbId) {
      return byTmdbId;
    }
  }

  if (candidate.sourceId) {
    const bySourceId = contents.find(
      (item) => item.sourceId && item.sourceId === candidate.sourceId
    );

    if (bySourceId) {
      return bySourceId;
    }
  }

  const normalizedTitle = (candidate.title || "").trim().toLowerCase();
  const normalizedType = candidate.type || "";

  if (!normalizedTitle) {
    return null;
  }

  return (
    contents.find(
      (item) =>
        (item.title || "").trim().toLowerCase() === normalizedTitle &&
        (item.type || "") === normalizedType
    ) || null
  );
}

// Herhangi bir "local content" nesnesi (manuel form, öneri veya Keşfet
// kaynaklı fark etmeksizin) için backend'deki ortak content kataloğunda
// (tmdbId/sourceId + mediaType eşleşmesiyle, yoksa title + mediaType ile)
// mevcut kaydı arar, bulamazsa yeni bir content kaydı oluşturur. Her iki
// durumda da oluşan/bulunan content dokümanını döner.
async function findOrCreateBackendContentFromLocal(localContent, token) {
  const tmdbId = extractTmdbNumericId(
    localContent.sourceId ?? localContent.tmdbId ?? null
  );
  const mediaType = localContent.mediaType || "";
  const posterUrl = localContent.posterUrl || localContent.poster || "";
  const rating = localContent.tmdbRating ?? localContent.rating ?? null;

  const response = await getContents();
  const existingContents = Array.isArray(response)
    ? response
    : response?.data || [];

  const matchedContent = existingContents.find((existing) => {
    if (tmdbId != null && existing.tmdbId != null) {
      return (
        existing.tmdbId === tmdbId &&
        (existing.mediaType || "") === mediaType
      );
    }

    return (
      (existing.title || "").trim().toLowerCase() ===
        (localContent.title || "").trim().toLowerCase() &&
      (existing.mediaType || "") === mediaType
    );
  });

  if (matchedContent) {
    return matchedContent;
  }

  const created = await createContent(
    {
      title: localContent.title,
      name: localContent.title,
      type: localContent.type,
      mediaType,
      tmdbId,
      poster: posterUrl,
      posterUrl,
      overview: localContent.overview || "",
      rating,
      tmdbRating: rating,
      totalEpisodes: localContent.totalEpisodes || 0,
      episodeDuration: localContent.minutesPerEpisode || 0,
      wordsPerEpisode: localContent.wordsPerEpisode || 0,
    },
    token
  );

  return created?.data;
}

// Backend'den gelen bir userContent kaydını (+ populate edilmiş contentId)
// mevcut frontend content shape'ine çevirir. Ortak içerik bilgileri
// (title/poster/totalEpisodes vb.) contentId'den, kullanıcıya özel bilgiler
// (status/watchedEpisodes/notes vb.) userContent'in kendisinden gelir.
function mapUserContentToFrontendContent(userContent) {
  const contentData =
    userContent.contentId && typeof userContent.contentId === "object"
      ? userContent.contentId
      : {};

  // sourceId backend'e hiç kaydedilmiyor (sadece tmdbId + mediaType
  // saklanıyor), bu yüzden her reload'da yeniden kurulmalı — aksi hâlde
  // toggleEpisodeWatched/toggleSeasonWatched gibi sourceId ile eşleştirme
  // yapan fonksiyonlar, sourceId'si undefined kalan birden fazla "tv"
  // içeriğini birbirine karıştırır. DiscoverPage.jsx'teki normalizeTmdbItem
  // ile birebir aynı format kullanılıyor: "tmdb-movie-123" / "tmdb-tv-123".
  const reconstructedSourceId =
    contentData.tmdbId != null
      ? `tmdb-${contentData.mediaType === "movie" ? "movie" : "tv"}-${contentData.tmdbId}`
      : null;

  return {
    ...contentData,
    id: userContent._id,
    backendUserContentId: userContent._id,
    backendContentId: contentData._id,
    sourceId: reconstructedSourceId,
    title: contentData.title || contentData.name || "",
    name: contentData.name || contentData.title || "",
    type: contentData.type || "",
    mediaType: contentData.mediaType || "",
    posterUrl: contentData.poster || "",
    overview: contentData.overview || "",
    // Öncelik: kullanıcıya özel UserContent.totalEpisodes (TMDb senkronu artık
    // buraya yazıyor) → katalog Content.totalEpisodes fallback'i → 0.
    totalEpisodes:
      toPositiveEpisodeCount(userContent.totalEpisodes) ??
      toPositiveEpisodeCount(contentData.totalEpisodes) ??
      0,
    minutesPerEpisode: contentData.episodeDuration || 0,
    wordsPerEpisode: contentData.wordsPerEpisode || 0,
    tmdbRating: contentData.rating || null,
    seasons: contentData.seasons || [],
    status: API_STATUS_TO_FRONTEND_STATUS[userContent.status] || "İzleyecekler",
    watchedMinutes: userContent.watchedMinutes,
    watchedPercentage: userContent.watchedPercentage,
    watchedEpisodes: userContent.watchedEpisodes || 0,
    notes: userContent.notes || "",
    watchLogs: userContent.watchLogs || [],
    startDate: userContent.startDate || "",
    finishDate: userContent.finishDate || "",
  };
}

// Tüm "içerik ekleme" akışlarının (manuel form, öneri, Keşfet) ortak kullandığı
// backend kayıt fonksiyonu: önce content kataloğunu bulur/oluşturur, sonra bu
// kullanıcı için userContent kaydı açar. Sonucu { status, content|message }
// şeklinde döner; state güncellemesini çağıran fonksiyon kendi ihtiyacına
// göre yapar (yeni kart ekleme veya mevcut legacy kaydı güncelleme gibi).
async function saveContentToBackend(localContent, targetStatus, token) {
  try {
    const backendContent = await findOrCreateBackendContentFromLocal(
      localContent,
      token
    );

    const totalEpisodes = localContent.totalEpisodes || 0;
    const watchedEpisodes = localContent.watchedEpisodes || 0;
    const watchedMinutes = watchedEpisodes * (localContent.minutesPerEpisode || 0);
    const watchedPercentage =
      totalEpisodes > 0
        ? Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100))
        : 0;

    const createResponse = await createUserContent(
      {
        contentId: backendContent._id,
        status: FRONTEND_STATUS_TO_API_STATUS[targetStatus] || "watchlist",
        watchedMinutes,
        watchedPercentage,
        watchedEpisodes,
        totalEpisodes,
        notes: localContent.notes || "",
        watchLogs: localContent.watchLogs || [],
        startDate: localContent.startDate || "",
        finishDate: localContent.completedDate || localContent.finishDate || "",
      },
      token
    );

    const mappedContent = mapUserContentToFrontendContent({
      ...createResponse.data,
      contentId: backendContent,
    });

    return {
      status: "success",
      content: { ...localContent, ...mappedContent },
    };
  } catch (error) {
    if (error.status === 409) {
      return { status: "duplicate" };
    }

    return { status: "error", message: error.message };
  }
}

// Tüm "güncelleme" akışlarının (status, not, bölüm ilerlemesi) ortak
// kullandığı backend PUT fonksiyonu. Sadece backend I/O yapar, state'e hiç
// dokunmaz — çağıran fonksiyon sonucu görüp state'i ne zaman/nasıl
// güncelleyeceğine kendi karar verir:
// - "local": content.backendUserContentId yok, backend'e hiç gidilmedi.
// - "success": PUT başarılı.
// - "not_found": backend 404 döndü (kayıt backend'de yok).
// - "error": başka bir hata (network, 400, 500 vb.).
async function saveUserContentUpdate(content, apiPayload, token) {
  if (!content || !content.backendUserContentId) {
    return { status: "local" };
  }

  try {
    await updateUserContent(content.backendUserContentId, apiPayload, token);
    return { status: "success" };
  } catch (error) {
    if (error.status === 404) {
      return { status: "not_found" };
    }

    return { status: "error", message: error.message };
  }
}

const STATUS_OPTIONS = [
  { value: "İzleyecekler", label: "İzleyeceğim" },
  { value: "İzleniyor", label: "İzliyorum" },
  { value: "İzlediklerim", label: "İzledim" },
];

const STATUS_META = {
  İzleyecekler: { label: "İzleyeceğim", badgeClassName: "" },
  İzleniyor: {
    label: "İzliyorum",
    badgeClassName: "card-badge--status-watching",
  },
  İzlediklerim: {
    label: "İzledim",
    badgeClassName: "card-badge--status-completed",
  },
};

// Manuel içerik formunun TEK canonical başlangıç değeri. Hem ilk render'da
// (useState) hem başarılı/başarısız bir gönderim sonrası sıfırlamada
// (persistNewContent) buradan okunur — aynı obje iki ayrı yerde elle
// kopyalanmaz, bu yüzden bir alan unutulup eski (stale) bir değer bir
// sonraki içeriğe sızamaz.
const INITIAL_CONTENT_FORM = {
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
};

// applyTmdbMatch'in form alanlarına GERÇEKTEN yazdığı (kullanıcının önceden
// elle girdiği bir değeri olmadığı için doldurduğu) sayısal alanların
// kaynağını takip eder. Yalnızca bu şekilde işaretli bir alan, eşleşme
// kaldırılınca veya türün TMDb mediaType kategorisi değişince sıfırlanır —
// kullanıcının TMDb doldurduktan SONRA elle değiştirdiği bir değer (bkz.
// handleChange'in totalEpisodes/minutesPerEpisode dalı) bu işaretlemeyi
// hemen kaldırır ve bir daha asla otomatik silinmez.
const INITIAL_TMDB_AUTOFILLED_FIELDS = {
  title: false,
  totalEpisodes: false,
  minutesPerEpisode: false,
};

// Yalnızca hâlâ "TMDb'den otomatik dolmuş, kullanıcı tarafından hiç
// değiştirilmemiş" olarak işaretli alanları INITIAL_CONTENT_FORM değerine
// döndürür. clearTmdbMatch ve handleChange'in tür-değişimi dalı aynı
// mantığı paylaşır — kullanıcının TMDb'den bağımsız, elle girdiği bir
// değer (title dahil) bu fonksiyonla asla silinmez.
function clearAutofilledFormValues(baseForm, autofilledFields) {
  const nextForm = { ...baseForm };

  if (autofilledFields.title) {
    nextForm.title = INITIAL_CONTENT_FORM.title;
  }

  if (autofilledFields.totalEpisodes) {
    nextForm.totalEpisodes = INITIAL_CONTENT_FORM.totalEpisodes;
  }

  if (autofilledFields.minutesPerEpisode) {
    nextForm.minutesPerEpisode = INITIAL_CONTENT_FORM.minutesPerEpisode;
    nextForm.wordsPerEpisode = INITIAL_CONTENT_FORM.wordsPerEpisode;
  }

  return nextForm;
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const activeUserId = authUser?._id || authUser?.id || null;

  // Misafir görünümünde kişisel bir aksiyon (içerik ekleme, durum/not
  // güncelleme vb.) tetiklendiğinde çağrılır. Giriş yapılmamışsa backend'e
  // hiç istek atmadan auth modalını açar ve false döner — çağıran fonksiyon
  // bu false'u görüp işlemi burada durdurur. Giriş yapılmışsa true döner ve
  // mevcut akış olduğu gibi devam eder.
  const requireAuthAction = () => {
    if (!authUser || !authToken) {
      openAuthModal("login");
      return false;
    }

    return true;
  };

  const openAuthModal = (mode = "login") => {
    setAuthMode(mode);
    setAuthError(null);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    setAuthError(null);
  };

  // Sayfa açılışında localStorage'daki token'ı /api/auth/me ile doğrular.
  // Geçerliyse authUser set edilir; geçersizse (veya yoksa) auth temizlenir
  // ve kullanıcı giriş ekranını görür. contents state'i her iki durumda da
  // önceki oturumdan kalma veriyle karışmasın diye sıfırlanır — asıl veri
  // activeUserId'ye bağlı GET effect'i ile gelecek.
  useEffect(() => {
    let isMounted = true;

    // Eski sürümlerden kalmış olabilecek içerik cache'i artık hiç
    // kullanılmıyor; bir daha okunmasın diye uygulama açılışında temizlenir.
    localStorage.removeItem(LEGACY_CONTENTS_STORAGE_KEY);

    async function verifyStoredToken() {
      const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (!storedToken) {
        setAuthLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser(storedToken);

        if (!isMounted) {
          return;
        }

        setContents([]);
        setAuthUser(response.user);
        setAuthToken(storedToken);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
      } catch {
        if (!isMounted) {
          return;
        }

        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setContents([]);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    verifyStoredToken();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async ({ email, password }) => {
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await loginUser({ email, password });

      setContents([]);
      setAuthUser(response.user);
      setAuthToken(response.token);
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
      setShowAuthModal(false);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRegister = async ({ name, email, password }) => {
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await registerUser({ name, email, password });

      setContents([]);
      setAuthUser(response.user);
      setAuthToken(response.token);
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
      setShowAuthModal(false);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleAuthModeChange = (nextMode) => {
    setAuthMode(nextMode);
    setAuthError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CONTENTS_STORAGE_KEY);
    setAuthUser(null);
    setAuthToken(null);
    setContents([]);
  };

  const [activePage, setActivePage] = useState("dashboard");

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const [goalTargetHours, setGoalTargetHours] = useState(() => {
    const savedGoal = Number(localStorage.getItem(GOAL_STORAGE_KEY));
    return VALID_GOAL_HOURS.includes(savedGoal) ? savedGoal : 100;
  });

  useEffect(() => {
    localStorage.setItem(GOAL_STORAGE_KEY, String(goalTargetHours));
  }, [goalTargetHours]);

  // MongoDB, giriş yapan kullanıcının içerikleri için tek kaynak — başlangıç
  // değeri her zaman boş dizi. Gerçek veri, activeUserId/authToken belli
  // olunca aşağıdaki GET effect'i ile MongoDB'den gelir.
  const [contents, setContents] = useState([]);

  const [form, setForm] = useState(INITIAL_CONTENT_FORM);

  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("Tümü");

  const [isContentsLoading, setIsContentsLoading] = useState(false);
  const [contentsError, setContentsError] = useState(null);

  // Tüm "içerik ekleme" akışları (manuel form, öneri, Keşfet) bu ortak
  // guard'ı ve feedback state'ini paylaşır — aynı anda çakışan çift
  // gönderimi engeller, tek bir yerden başarı/hata mesajı gösterir.
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [contentAddFeedback, setContentAddFeedback] = useState(null);

  // Manuel formda "TMDb ile Eşleştir" ile seçilen kanonik kimlik verisi.
  // Yalnızca { tmdbId, sourceId, mediaType, title, posterUrl, overview,
  // releaseYear, tmdbRating } alanlarını taşır — bölüm sayısı/süre gibi
  // sayısal zenginleştirme alanları seçim anında doğrudan `form`'a işlenir
  // (bkz. applyTmdbMatch), burada tekrar saklanmaz.
  const [tmdbMatch, setTmdbMatch] = useState(null);

  // Kullanıcı, TMDb eşleştirmesi olmadan Film/Dizi/Anime eklemeyi bilinçli
  // olarak seçtiğinde ("Manuel devam et" veya submit öncesi karar alanındaki
  // "Manuel ekle") true olur — bir daha aynı gönderim için tekrar sorulmaz.
  // Başlık/tür değişince (handleChange) veya yeni bir eşleşme uygulanınca
  // (applyTmdbMatch) sıfırlanır.
  const [tmdbManualOverride, setTmdbManualOverride] = useState(false);

  // applyTmdbMatch'in totalEpisodes/minutesPerEpisode'a gerçekten yazıp
  // yazmadığını alan bazında takip eder (bkz. INITIAL_TMDB_AUTOFILLED_FIELDS
  // ve clearAutofilledFormValues yorumları).
  const [tmdbAutofilledFields, setTmdbAutofilledFields] = useState(
    INITIAL_TMDB_AUTOFILLED_FIELDS
  );

  // "İçerik ekle" tetiklendiğinde, tür TMDb destekliyorsa (Film/Dizi/Anime)
  // ama ne bir eşleşme ne de bilinçli bir manuel-devam kararı varsa true
  // olur — ContentForm bu sırada küçük bir inline "TMDb'de ara / Manuel
  // ekle" karar alanı gösterir.
  const [showTmdbDecision, setShowTmdbDecision] = useState(false);

  // TmdbMatchPicker'ın kendi arama fonksiyonunu dışarıdan (submit öncesi
  // karar alanındaki "TMDb'de ara" butonundan) tetiklemek için kullanılan
  // sayaç — her artışta TmdbMatchPicker aynı handleSearch'ü çalıştırır,
  // ayrı bir ikinci arama mantığı yazılmaz.
  const [tmdbSearchTrigger, setTmdbSearchTrigger] = useState(0);

  // Aynı içerik için üst üste silme isteği gönderilmesini engeller (frontend
  // id'sini tutar, aynı anda ikinci bir DELETE gitmesini önler).
  const [deletingContentId, setDeletingContentId] = useState(null);

  // setContentStatus / updateContentNotes gibi tek seferlik kullanıcı
  // aksiyonlarında aynı içerik için üst üste PUT gitmesini engeller.
  const [updatingContentId, setUpdatingContentId] = useState(null);

  // Giriş yapan kullanıcı belli olunca (activeUserId + authToken) MongoDB
  // backend'den onun içeriklerini çeker. MongoDB, bu kullanıcı için tek veri
  // kaynağıdır: response başarılıysa contents state'i her zaman gelen
  // listeyle değiştirilir (liste boşsa contents da boş kalır) — önceki bir
  // kullanıcıdan veya oturumdan kalma veri asla ekranda kalmaz. activeUserId
  // veya authToken yoksa (giriş yapılmamışsa) hiç istek atılmaz.
  useEffect(() => {
    if (!activeUserId || !authToken) {
      return;
    }

    let isMounted = true;

    async function loadUserContentsFromApi() {
      setIsContentsLoading(true);
      setContentsError(null);

      try {
        const response = await getUserContents(authToken);
        const userContents = response?.data || [];

        if (!isMounted) {
          return;
        }

        setContents(userContents.map(mapUserContentToFrontendContent));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setContentsError(error.message);
      } finally {
        if (isMounted) {
          setIsContentsLoading(false);
        }
      }
    }

    loadUserContentsFromApi();

    return () => {
      isMounted = false;
    };
  }, [activeUserId, authToken]);

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

    return getMinutesInRange(contents, fourteenDaysAgo, today);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    // Kullanıcı, seçili bir TMDb eşleşmesi varken türün TMDb mediaType
    // kategorisini (Film ↔ Dizi/Anime) değiştirirse eski eşleşme artık
    // güvenilir değildir. Dizi ↔ Anime arasında geçiş mediaType'ı
    // değiştirmediği için (ikisi de "tv") eşleşme korunur, yalnızca
    // canonical `type` etiketi değişir.
    const isTypeInvalidatingMatch =
      name === "type" &&
      tmdbMatch &&
      getMediaTypeFromContentType(value) !== tmdbMatch.mediaType;

    if (
      name === "title" &&
      tmdbMatch &&
      value.trim().toLowerCase() !== tmdbMatch.title.trim().toLowerCase()
    ) {
      setTmdbMatch(null);
    }

    // Kullanıcı başlığı ya da türü tekrar düzenlerse, daha önce verilmiş
    // "manuel devam et" kararı ve varsa açık kalmış submit-öncesi karar
    // alanı da geçersiz sayılır — bir sonraki gönderimde güvenli tarafta
    // kalınıp tekrar sorulur.
    if (name === "title" || name === "type") {
      setTmdbManualOverride(false);
      setShowTmdbDecision(false);
    }

    // Kullanıcı title/totalEpisodes/minutesPerEpisode'u doğrudan elle
    // düzenliyorsa, bu alan artık "TMDb'nin dokunulmamış otomatik değeri"
    // olmaktan çıkar — bir daha eşleşme kaldırılınca/tür değişince asla
    // otomatik silinmesin diye işaretleme hemen kaldırılır.
    if (name === "title" || name === "totalEpisodes" || name === "minutesPerEpisode") {
      setTmdbAutofilledFields((previous) => ({ ...previous, [name]: false }));
    }

    // Tür değişince bölüm/süre alanları iki farklı nedenle sıfırlanabilir:
    // (a) Film'e geçilince "bölüm" kavramı hiç anlamsızlaşır (totalEpisodes/
    //     watchedEpisodes) — bu, TMDb eşleşmesi olsun olmasın her zaman
    //     uygulanan mevcut davranıştır.
    // (b) isTypeInvalidatingMatch true ise (örn. TMDb ile eşleştirilmiş bir
    //     dizi Podcast/YouTube'a çevriliyor), YALNIZCA hâlâ TMDb'nin
    //     dokunulmamış otomatik değeri olarak işaretli totalEpisodes/
    //     minutesPerEpisode/wordsPerEpisode sıfırlanır (clearAutofilledFormValues)
    //     — kullanıcının TMDb'den bağımsız ya da doldurduktan sonra elle
    //     değiştirdiği bir değer asla sessizce silinmez. totalEpisodes bu
    //     şekilde gerçekten sıfırlanırsa, artık anlamsız kalan
    //     watchedEpisodes de birlikte sıfırlanır.
    if (name === "type" && (value === "Film" || isTypeInvalidatingMatch)) {
      let nextForm = { ...form, type: value };

      if (value === "Film") {
        nextForm.totalEpisodes = INITIAL_CONTENT_FORM.totalEpisodes;
        nextForm.watchedEpisodes = INITIAL_CONTENT_FORM.watchedEpisodes;
      }

      if (isTypeInvalidatingMatch) {
        const totalEpisodesBefore = nextForm.totalEpisodes;
        nextForm = clearAutofilledFormValues(nextForm, tmdbAutofilledFields);

        if (nextForm.totalEpisodes !== totalEpisodesBefore) {
          nextForm.watchedEpisodes = INITIAL_CONTENT_FORM.watchedEpisodes;
        }

        setTmdbMatch(null);
        setTmdbAutofilledFields(INITIAL_TMDB_AUTOFILLED_FIELDS);
      }

      setForm(nextForm);
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  };

  // TmdbMatchPicker'da bir sonuç seçildiğinde çağrılır. Form başlığını
  // seçilen TMDb başlığıyla senkronlar (bu, handleChange'in title-değişti
  // temizleme kuralını TETİKLEMEZ çünkü bu güncelleme handleChange'in
  // <input onChange>'i üzerinden değil, doğrudan setForm ile yapılır).
  // Kullanıcının önceden elle girdiği bölüm süresi/toplam bölüm gibi
  // geçerli (>0) değerler asla sessizce ezilmez — yalnızca alan boş/0 ise
  // TMDb'den gelen güvenilir değerle doldurulur.
  const applyTmdbMatch = (match) => {
    const { totalEpisodes: tmdbTotalEpisodes, minutesPerEpisode: tmdbMinutes, ...identity } =
      match;

    // nextAutofilled önceki işaretlemeleri korur (spread ile başlar) —
    // örn. "Değiştir" ile ikinci bir TMDb sonucu seçilip bu seferki sonuç
    // totalEpisodes döndürmezse, İLK eşleşmeden kalma (hâlâ formda duran)
    // otomatik-doldurulmuş değer/işaret olduğu gibi kalır.
    const nextAutofilled = { ...tmdbAutofilledFields, title: true };
    // title her zaman seçilen TMDb sonucunun başlığıyla senkronlanır (arama
    // sorgusu genelde kullanıcının kendi tahmini/kısaltmasıdır, eşleşme
    // seçildikten sonra kanonik başlığın onun yerini alması beklenir).
    // Bu, işaretlemeyle (title: true) birlikte "Eşleşmeyi kaldır"
    // seçildiğinde bu başlığın da temizlenebilmesini sağlar (Sorun 2).
    const nextForm = { ...form, title: identity.title };

    // Alan boşsa/0'sa DOLDUR; alan hâlâ ÖNCEKİ bir TMDb eşleşmesinin
    // dokunulmamış otomatik değerini taşıyorsa da GÜNCELLE ("Değiştir" ile
    // ikinci bir sonuç seçildiğinde ilk eşleşmenin bölüm sayısında takılı
    // kalınmasın). Yalnızca kullanıcının kendi elle girdiği (autofilled
    // işareti handleChange tarafından kaldırılmış) bir değer korunur.
    if (
      (toSafeNumber(form.totalEpisodes) <= 0 || tmdbAutofilledFields.totalEpisodes) &&
      Number.isInteger(tmdbTotalEpisodes) &&
      tmdbTotalEpisodes > 0
    ) {
      nextForm.totalEpisodes = tmdbTotalEpisodes;
      nextAutofilled.totalEpisodes = true;
    }

    if (
      (toSafeNumber(form.minutesPerEpisode) <= 0 || tmdbAutofilledFields.minutesPerEpisode) &&
      typeof tmdbMinutes === "number" &&
      tmdbMinutes > 0
    ) {
      nextForm.minutesPerEpisode = tmdbMinutes;
      nextAutofilled.minutesPerEpisode = true;

      // wordsPerEpisode BİLEREK otomatik doldurulmuz: TMDb kelime/bölüm
      // verisi sağlamıyor, "dakika × 120" gibi bir çarpım gerçek bir TMDb
      // değeriymiş gibi sunulursa yanıltıcı olur. Kullanıcı isterse bu
      // alanı kendisi doldurur.
    }

    setForm(nextForm);
    setTmdbAutofilledFields(nextAutofilled);
    setTmdbMatch(identity);
    setTmdbManualOverride(false);
    setShowTmdbDecision(false);
  };

  // "Eşleşmeyi kaldır": tmdbId/sourceId/mediaType gibi kimlik metadata'sının
  // yanı sıra, hâlâ "TMDb'nin dokunulmamış otomatik değeri" olarak işaretli
  // totalEpisodes/minutesPerEpisode/wordsPerEpisode de temizlenir (Sorun 1).
  // Kullanıcının eşleştirdikten SONRA elle değiştirdiği bir değer
  // (tmdbAutofilledFields'te işareti handleChange tarafından çoktan
  // kaldırılmış olur) bu temizlemeden asla etkilenmez.
  const clearTmdbMatch = () => {
    setForm((prevForm) => clearAutofilledFormValues(prevForm, tmdbAutofilledFields));
    setTmdbAutofilledFields(INITIAL_TMDB_AUTOFILLED_FIELDS);
    setTmdbMatch(null);
    setTmdbManualOverride(false);
  };

  // TmdbMatchPicker'daki "Manuel devam et": kullanıcı TMDb sonucu
  // bulunamadığında/hata aldığında bilinçli olarak eşleştirmeden devam
  // etmeyi seçer — bir daha aynı gönderim için karar alanı gösterilmez.
  const acknowledgeTmdbManualContinue = () => {
    setTmdbManualOverride(true);
  };

  // Submit öncesi inline karar alanındaki "TMDb'de ara": karar alanını
  // kapatır ve TmdbMatchPicker'ın kendi arama fonksiyonunu (searchTrigger
  // sayaç değişimiyle) tetikler — ayrı bir ikinci arama mantığı yazılmaz.
  const handleTmdbDecisionSearch = () => {
    setShowTmdbDecision(false);
    setTmdbSearchTrigger((previous) => previous + 1);
  };

  // Submit öncesi inline karar alanındaki "Manuel ekle": kararı kaydeder
  // ve gerçek kayıt işlemini (persistNewContent) hemen çalıştırır — kullanıcı
  // üçüncü kez "İçerik ekle"ye basmak zorunda kalmaz.
  const handleTmdbDecisionManual = () => {
    setTmdbManualOverride(true);
    setShowTmdbDecision(false);
    persistNewContent();
  };

  const markAllInForm = () => {
    setForm({
      ...form,
      watchedEpisodes: form.totalEpisodes,
      status: "İzlediklerim",
      completedDate: form.completedDate || getToday(),
    });
  };

  const addContent = async (event) => {
    event.preventDefault();

    if (form.title.trim() === "") {
      alert("İçerik adı boş olamaz.");
      return;
    }

    if (isSavingContent) {
      return;
    }

    if (!requireAuthAction()) {
      return;
    }

    // Film/Dizi/Anime TMDb eşleştirmeyi destekliyor; bu türlerden biri
    // seçiliyken ne bir eşleşme ne de bilinçli bir "manuel devam et" kararı
    // varsa, doğrudan kaydetmek yerine küçük bir inline karar alanı
    // gösterilir (bkz. ContentForm'daki showTmdbDecision bloğu). Podcast/
    // YouTube/Animasyon gibi TMDb desteklemeyen türlerde bu adım hiç
    // devreye girmez, doğrudan kaydedilir.
    const candidateMediaType = getMediaTypeFromContentType(form.type);
    const needsTmdbDecision = Boolean(candidateMediaType) && !tmdbMatch && !tmdbManualOverride;

    if (needsTmdbDecision) {
      setShowTmdbDecision(true);
      return;
    }

    await persistNewContent();
  };

  // addContent'in guard/karar aşamasından geçtikten sonra gerçek kayıt
  // işlemini yapar — mevcut saveContentToBackend boru hattına hiç
  // dokunmadan aynı şekilde çağırır. handleTmdbDecisionManual da (kullanıcı
  // submit-öncesi karar alanında "Manuel ekle" derse) bunu doğrudan çağırır.
  const persistNewContent = async () => {
    const totalEpisodes = toSafeNumber(form.totalEpisodes);

    const watchedEpisodes = Math.min(
      toSafeNumber(form.watchedEpisodes),
      totalEpisodes
    );

    const minutesPerEpisode = toSafeNumber(form.minutesPerEpisode);
    const wordsPerEpisode = toSafeNumber(form.wordsPerEpisode);

    const today = getToday();
    const isCompleted = totalEpisodes > 0 && watchedEpisodes >= totalEpisodes;

    // TMDb eşleşmesi varsa kimlik alanları oradan gelir (sahte tmdbId/
    // sourceId ASLA üretilmez); yoksa yalnızca mediaType için type'tan
    // güvenli bir fallback türetilir (Film→movie, Dizi/Anime→tv, diğerleri
    // için boş) — bu, "Bölümleri Yönet"in mediaType="tv" gerektiren
    // görünürlük koşulunu karşılar, ama tmdbId/sourceId olmadığı için
    // canManageEpisodes yine false kalır (bkz. renderContentCard).
    const matchedMediaType = tmdbMatch?.mediaType || getMediaTypeFromContentType(form.type);

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
                type: "manual",
              },
            ]
          : [],
      mediaType: matchedMediaType,
      tmdbId: tmdbMatch?.tmdbId ?? null,
      sourceId: tmdbMatch?.sourceId ?? null,
      posterUrl: tmdbMatch?.posterUrl || "",
      overview: tmdbMatch?.overview || "",
      releaseYear: tmdbMatch?.releaseYear ?? null,
      tmdbRating: tmdbMatch?.tmdbRating ?? null,
      source: tmdbMatch ? "tmdb" : "manual",
    };

    // Backend'e hiç gitmeden önce hızlı bir ön kontrol: aynı içerik
    // (tmdbId+mediaType → sourceId → normalize title+type önceliğiyle)
    // zaten kütüphanede mi? Bu, "Breaking Bad" / "breaking bad" gibi aynı
    // içeriğin farklı yazımlarla iki kez eklenmesini de kapsar. Backend'in
    // userId+contentId unique index'i (409) her durumda son güvenlik ağı
    // olarak kalmaya devam eder — burada kaldırılmıyor.
    const existingMatch = findExistingContentForCandidate(contents, newContent);

    if (existingMatch) {
      setContentAddFeedback({
        type: "error",
        text: "Bu içerik zaten kütüphanende var.",
      });
      return;
    }

    setIsSavingContent(true);
    setContentAddFeedback(null);

    const result = await saveContentToBackend(
      newContent,
      newContent.status,
      authToken
    );

    if (result.status === "success") {
      setContents((prevContents) => [...prevContents, result.content]);
      setContentAddFeedback({
        type: "success",
        text: "İçerik eklendi ve kütüphanene kaydedildi.",
      });
    } else if (result.status === "duplicate") {
      setContentAddFeedback({
        type: "error",
        text: "Bu içerik zaten kütüphanende var.",
      });
    } else {
      setContents((prevContents) => [...prevContents, newContent]);
      setContentAddFeedback({
        type: "error",
        text: "Backend'e kaydedilemedi, yerel olarak eklendi.",
      });
    }

    setIsSavingContent(false);

    // Tek canonical başlangıç değeri (INITIAL_CONTENT_FORM) kullanılır —
    // önceki içerikten kalan totalEpisodes/minutesPerEpisode/wordsPerEpisode
    // gibi TMDb kaynaklı değerlerin bir sonraki içeriğe sızmaması için form
    // ve TMDb eşleştirme/karar state'lerinin TAMAMI burada sıfırlanır.
    setForm(INITIAL_CONTENT_FORM);
    setTmdbMatch(null);
    setTmdbAutofilledFields(INITIAL_TMDB_AUTOFILLED_FIELDS);
    setTmdbManualOverride(false);
    setShowTmdbDecision(false);
  };

  // Silme akışı: backendUserContentId'si olan kayıtlar için önce backend'den
  // silmeyi dener, sadece başarılı olursa (veya backend "zaten yok" derse)
  // state'ten çıkarır. backendUserContentId'si olmayan eski localStorage-only
  // kayıtlar için backend'e hiç gitmeden doğrudan yerelden silinir.
  const deleteContent = async (id, title) => {
    const confirmed = window.confirm(
      `"${title}" içeriğini silmek istediğine emin misin? Bu işlem geri alınamaz.`
    );

    if (!confirmed) {
      return;
    }

    if (deletingContentId === id) {
      return;
    }

    const item = contents.find((content) => content.id === id);

    if (!item || !item.backendUserContentId) {
      setContents((prevContents) =>
        prevContents.filter((content) => content.id !== id)
      );
      setContentAddFeedback({ type: "success", text: "Yerel kayıt silindi." });
      return;
    }

    setDeletingContentId(id);
    setContentAddFeedback(null);

    try {
      await deleteUserContent(item.backendUserContentId, authToken);

      setContents((prevContents) =>
        prevContents.filter((content) => content.id !== id)
      );
      setContentAddFeedback({
        type: "success",
        text: "İçerik kütüphanenden silindi.",
      });
    } catch (error) {
      if (error.status === 404) {
        setContents((prevContents) =>
          prevContents.filter((content) => content.id !== id)
        );
        setContentAddFeedback({
          type: "error",
          text: "Backend'de kayıt bulunamadı, yerel kayıt temizlendi.",
        });
      } else {
        setContentAddFeedback({
          type: "error",
          text: "Silme işlemi başarısız oldu, içerik ekranda kaldı.",
        });
      }
    } finally {
      setDeletingContentId(null);
    }
  };

  // Backend PUT'unu arka planda (beklenmeden) dener; sadece hata/404
  // durumunda kullanıcıyı bilgilendirir. Local state zaten optimistic olarak
  // güncellendiği için "success"/"local" durumlarında ekstra bir şey yapmaz —
  // bu, sık tıklanan bölüm takibi aksiyonları için gereksiz mesaj spamini önler.
  function syncSummaryToBackendInBackground(content, apiPayload) {
    saveUserContentUpdate(content, apiPayload, authToken).then((result) => {
      if (result.status === "error") {
        setContentAddFeedback({
          type: "error",
          text: "Güncelleme MongoDB'ye kaydedilemedi.",
        });
      } else if (result.status === "not_found") {
        setContentAddFeedback({
          type: "error",
          text: "Backend'de kayıt bulunamadı, yerel olarak güncellendi.",
        });
      }
    });
  }

  const watchOneEpisode = (id) => {
    const today = getToday();
    const content = contents.find((item) => item.id === id);

    if (!content || content.type === "Film") {
      return;
    }

    // totalEpisodes güvenilir şekilde bilinmiyorsa (0 veya geçersiz), bölüm
    // artırma anlamsız olur — sessizce hiçbir şey yapmadan dönülür. Buton da
    // aynı koşulla render'da disabled ediliyor (bkz. renderContentCard).
    const totalEpisodes = Math.floor(toSafeNumber(content.totalEpisodes));
    const watchedEpisodes = Math.floor(toSafeNumber(content.watchedEpisodes));

    if (totalEpisodes <= 0 || watchedEpisodes >= totalEpisodes) {
      return;
    }

    const newWatchedEpisodes = watchedEpisodes + 1;
    const isFinished = newWatchedEpisodes >= totalEpisodes;

    const updatedContent = {
      ...content,
      watchedEpisodes: newWatchedEpisodes,
      status: isFinished ? "İzlediklerim" : "İzleniyor",
      completedDate: isFinished ? today : content.completedDate,
      watchLogs: [
        ...(content.watchLogs || []),
        {
          date: today,
          minutes: content.minutesPerEpisode,
          words: content.wordsPerEpisode,
          title: content.title,
          type: "manual",
        },
      ],
    };

    setContents((prevContents) =>
      prevContents.map((item) => (item.id === id ? updatedContent : item))
    );

    const watchedMinutes = newWatchedEpisodes * (content.minutesPerEpisode || 0);
    const watchedPercentage = Math.min(
      100,
      Math.round((newWatchedEpisodes / totalEpisodes) * 100)
    );

    // watchLogs de payload'a dahil edilir — aksi halde bu bölüm izleme
    // kaydı yalnızca React state'inde kalır, MongoDB'ye hiç yazılmaz ve
    // sayfa yenilenince (veya bir sonraki oturumda) kaybolur. "Aylık Özet"
    // ve günlük grafikler bu tarihli kayıtları kullanır (bkz. stats.js
    // getContentDatedEntries) — watchLogs backend'e gitmeden bu ekranlar
    // gerçek aktiviteye rağmen boş görünmeye devam eder.
    syncSummaryToBackendInBackground(content, {
      watchedEpisodes: newWatchedEpisodes,
      watchedMinutes,
      watchedPercentage,
      status: FRONTEND_STATUS_TO_API_STATUS[updatedContent.status] || "watching",
      watchLogs: updatedContent.watchLogs,
    });
  };

  const markAllWatched = (id) => {
    const today = getToday();
    const content = contents.find((item) => item.id === id);

    if (!content || content.type === "Film") {
      return;
    }

    // totalEpisodes güvenilir şekilde bilinmiyorsa (0 veya geçersiz), "tümünü
    // izledim" anlamsız/yanlış bir değer (0 veya NaN) yazardı — bu yüzden
    // sessizce hiçbir şey yapmadan dönülür.
    const totalEpisodes = Math.floor(toSafeNumber(content.totalEpisodes));

    if (totalEpisodes <= 0) {
      return;
    }

    const watchedEpisodes = Math.floor(toSafeNumber(content.watchedEpisodes));
    const remainingEpisodes = Math.max(totalEpisodes - watchedEpisodes, 0);

    const updatedContent = {
      ...content,
      watchedEpisodes: totalEpisodes,
      status: "İzlediklerim",
      completedDate: content.completedDate || today,
      watchLogs: [
        ...(content.watchLogs || []),
        {
          date: today,
          minutes: remainingEpisodes * content.minutesPerEpisode,
          words: remainingEpisodes * content.wordsPerEpisode,
          title: content.title,
          type: "manual",
        },
      ],
    };

    setContents((prevContents) =>
      prevContents.map((item) => (item.id === id ? updatedContent : item))
    );

    // watchOneEpisode'daki aynı gerekçeyle: watchLogs de gönderilmezse bu
    // "tümünü izledim" kaydı MongoDB'ye hiç yazılmaz, Aylık Özet bu
    // aktiviteyi asla göremez.
    syncSummaryToBackendInBackground(content, {
      watchedEpisodes: totalEpisodes,
      watchedMinutes: totalEpisodes * (content.minutesPerEpisode || 0),
      watchedPercentage: 100,
      status: "completed",
      finishDate: updatedContent.completedDate || today,
      watchLogs: updatedContent.watchLogs,
    });
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

  const addRecommendationToWatchLater = async (recommendation) => {
    if (isSavingContent) {
      return;
    }

    if (!requireAuthAction()) {
      return;
    }

    const newContent = buildWatchlistContent({
      title: recommendation.title,
      type: recommendation.type,
      minutesPerEpisode: recommendation.minutesPerEpisode,
    });

    setIsSavingContent(true);
    setContentAddFeedback(null);

    const result = await saveContentToBackend(
      newContent,
      newContent.status,
      authToken
    );

    if (result.status === "success") {
      setContents((prevContents) => [...prevContents, result.content]);
      setContentAddFeedback({
        type: "success",
        text: "İçerik izleyeceklerine eklendi.",
      });
    } else if (result.status === "duplicate") {
      setContentAddFeedback({
        type: "error",
        text: "Bu içerik zaten kütüphanende var.",
      });
    } else {
      setContents((prevContents) => [...prevContents, newContent]);
      setContentAddFeedback({
        type: "error",
        text: "Backend'e kaydedilemedi, yerel olarak eklendi.",
      });
    }

    setIsSavingContent(false);
  };

  // Keşfet öğesine karşılık gelen kayıtlı content'i (varsa) bulur.
  // KÖK NEDEN (Sorun 2): Bu fonksiyon önceden `content.source === "tmdb"`
  // koşuluyla başlıyordu. `source` yalnızca frontend'de bu oturumda
  // eklenirken set edilen, MongoDB'ye HİÇ yazılmayan (Content/UserContent
  // şemalarında ve whitelist'lerinde yok) geçici bir bookkeeping alanıydı.
  // Sayfa yenilenince / yeniden giriş yapılınca `getUserContents` →
  // mapUserContentToFrontendContent ile gelen HİÇBİR content objesinde
  // `source` alanı yoktu — bu yüzden eşleşme her zaman baştan reddediliyor,
  // Keşfet'te zaten ekli bir içerik bile "+" (eklenmemiş) görünüyordu.
  // Gerçek ve kalıcı olan sinyal `sourceId`dir: mapUserContentToFrontendContent
  // bunu Content.tmdbId + Content.mediaType'tan HER reload'da güvenilir
  // biçimde yeniden kurar (bkz. App.jsx'teki reconstructedSourceId). Bu
  // yüzden eşleştirme artık doğrudan `sourceId` üzerinden yapılır; `source`
  // alanına hiç bakılmaz.
  const findDiscoveryContent = (item) => {
    if (!item) {
      return null;
    }

    return (
      contents.find((content) => {
        if (item.id && content.sourceId) {
          return content.sourceId === item.id;
        }

        return (
          (content.title || "").trim().toLowerCase() ===
            (item.title || "").trim().toLowerCase() &&
          content.mediaType === item.mediaType
        );
      }) || null
    );
  };

  const isDiscoveryItemAdded = (item) => Boolean(findDiscoveryContent(item));

  // Keşfet kartında (PosterCard) "mevcut durum açıkça gösterilmeli"
  // gereksinimi için: içerik zaten ekliyse Türkçe durum etiketini
  // ("İzleyeceğim"/"İzliyorum"/"İzledim"), değilse null döner.
  const getDiscoveryItemStatusLabel = (item) => {
    const existing = findDiscoveryContent(item);

    if (!existing) {
      return null;
    }

    return STATUS_META[getStatus(existing)]?.label || null;
  };

  // PosterCard'ın "+"/"✓" butonuna, içerik zaten ekliyken basıldığında
  // çağrılır (buton bu durumda ekleme yerine detay modalını açar — bkz.
  // PosterCard.jsx). Modal açılmadan önce kullanıcıya "boşa tıklamadın,
  // bu içerik zaten kütüphanende" diyen görünür bir mesaj gösterir.
  const notifyDiscoveryItemAlreadyAdded = (item) => {
    const existing = findDiscoveryContent(item);

    if (!existing) {
      return;
    }

    const statusLabel = STATUS_META[getStatus(existing)]?.label || getStatus(existing);

    setContentAddFeedback({
      type: "info",
      text: `Bu içerik zaten kütüphanende. Mevcut durum: ${statusLabel}.`,
    });
  };

  // Bir içeriğin durumunu (İzleyecekler / İzleniyor / İzlediklerim) doğrudan
  // günceller. Bölüm/sezon verisine hiç dokunmaz — sadece status ve
  // buna bağlı start/completed tarihlerini ayarlar. Önce backend'e PUT
  // atmayı dener, sadece başarılı olursa (veya backend'e hiç yazılmamış
  // eski bir kayıtsa) state'i günceller — böylece backend hatası veri
  // kaybına/uyumsuzluğa yol açmaz.
  const setContentStatus = async (contentId, status) => {
    if (updatingContentId === contentId) {
      return;
    }

    const content = contents.find((item) => item.id === contentId);

    if (!content) {
      return;
    }

    // Kullanıcı zaten aktif olan durumu tekrar seçerse (örn. "İzliyorum"
    // zaten aktifken tekrar "İzliyorum"a basarsa): gereksiz bir PUT isteği
    // atılmaz, buton geçici olarak disabled edilmez (updatingContentId hiç
    // set edilmez) — yalnızca bunun zaten mevcut durum olduğunu belirten
    // görünür bir bilgi mesajı gösterilir.
    if (getStatus(content) === status) {
      setContentAddFeedback({
        type: "info",
        text: "Bu içerik zaten bu durumda.",
      });
      return;
    }

    const today = getToday();
    const isCompleted = status === "İzlediklerim";
    const isWatching = status === "İzleniyor";

    const nextLocalContent = {
      ...content,
      status,
      startDate:
        content.startDate ||
        (isWatching || isCompleted ? today : content.startDate),
      completedDate: isCompleted
        ? content.completedDate || today
        : content.completedDate,
    };

    setUpdatingContentId(contentId);
    setContentAddFeedback(null);

    const result = await saveUserContentUpdate(
      content,
      { status: FRONTEND_STATUS_TO_API_STATUS[status] || "watchlist" },
      authToken
    );

    if (result.status === "success" || result.status === "local") {
      setContents((prevContents) =>
        prevContents.map((item) =>
          item.id === contentId ? nextLocalContent : item
        )
      );

      setContentAddFeedback(
        result.status === "success"
          ? { type: "success", text: "Durum güncellendi." }
          : { type: "success", text: "Yerel kayıt güncellendi." }
      );
    } else if (result.status === "not_found") {
      setContents((prevContents) =>
        prevContents.map((item) =>
          item.id === contentId ? nextLocalContent : item
        )
      );

      setContentAddFeedback({
        type: "error",
        text: "Backend'de kayıt bulunamadı, yerel olarak güncellendi.",
      });
    } else {
      setContentAddFeedback({
        type: "error",
        text: "Güncelleme MongoDB'ye kaydedilemedi.",
      });
    }

    setUpdatingContentId(null);
  };

  // Keşfet'ten içerik eklemeyi (+ butonu, İzleyeceğim/İzliyorum/İzledim
  // seçimleri) ortak saveContentToBackend akışına bağlar. Backend'e
  // ulaşılamazsa veya beklenmedik bir hata olursa, veri kaybı yaşanmaması
  // için içerik yine de localStorage'a (eski yöntemle) eklenir ve kullanıcı
  // bilgilendirilir.
  const addDiscoveryItemToWatchlist = async (item, status = "İzleyecekler") => {
    const existingContent = findDiscoveryContent(item);

    // Bu içerik zaten backend'e kaydedilmişse (backendUserContentId varsa):
    // istenen durum zaten aktifse (örn. Keşfet'te "+"ya tekrar basıldıysa)
    // hiçbir ağ isteği atılmadan, Keşfet bağlamına özel açıklayıcı bir bilgi
    // mesajı gösterilir (Sorun 2) — kullanıcı "neden hiçbir şey olmadı"
    // diye düşünmesin. Gerçekten farklı bir durum isteniyorsa mevcut
    // UserContent kaydı setContentStatus ile güncellenir (yeni kayıt
    // AÇILMAZ) ve feedback tek kaynaktan (setContentStatus) gelir.
    if (existingContent && existingContent.backendUserContentId) {
      const currentStatus = getStatus(existingContent);

      if (currentStatus === status) {
        const statusLabel = STATUS_META[currentStatus]?.label || currentStatus;

        setContentAddFeedback({
          type: "info",
          text: `Bu içerik zaten kütüphanende. Mevcut durum: ${statusLabel}.`,
        });

        return;
      }

      await setContentStatus(existingContent.id, status);
      return;
    }

    if (isSavingContent) {
      return;
    }

    if (!requireAuthAction()) {
      return;
    }

    // existingContent burada backend'e hiç yazılmamış eski bir localStorage
    // kaydı olabilir (backendUserContentId yok) — bu durumda onu olduğu gibi
    // backend'e kaydetmeyi dener, yoksa yeni bir local content inşa eder.
    const localContent =
      existingContent ||
      buildWatchlistContent({
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

    setIsSavingContent(true);
    setContentAddFeedback(null);

    const result = await saveContentToBackend(localContent, status, authToken);

    if (result.status === "success") {
      const mergedContent = {
        ...result.content,
        source: "tmdb",
        sourceId: item.id,
        genre: item.genre || localContent.genre || "",
        estimatedLevel: item.estimatedLevel || localContent.estimatedLevel || "",
        releaseYear: item.year || localContent.releaseYear || null,
      };

      if (existingContent) {
        // Eski local-only kaydı yeni bir kart eklemek yerine backend
        // bilgileriyle günceller, frontend id'sini korur.
        setContents((prevContents) =>
          prevContents.map((content) =>
            content.id === existingContent.id
              ? { ...mergedContent, id: content.id }
              : content
          )
        );
      } else {
        setContents((prevContents) => [...prevContents, mergedContent]);
      }

      setContentAddFeedback({
        type: "success",
        text: "İçerik kütüphanene eklendi.",
      });
    } else if (result.status === "duplicate") {
      setContentAddFeedback({
        type: "error",
        text: "Bu içerik zaten kütüphanende var.",
      });
    } else if (!existingContent) {
      setContents((prevContents) => [...prevContents, localContent]);
      setContentAddFeedback({
        type: "error",
        text: "Backend'e kaydedilemedi, yerel olarak eklendi.",
      });
    } else {
      // existingContent zaten localStorage'da duruyor, tekrar eklemeye
      // gerek yok — sadece hatayı bildir.
      setContentAddFeedback({
        type: "error",
        text: "Backend'e kaydedilemedi, yerel olarak eklendi.",
      });
    }

    setIsSavingContent(false);
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
  // eklenmemiş içeriklerde no-op'tur. totalEpisodes artık kullanıcıya özel
  // UserContent kaydında saklanıyor (global Content kataloğuna YAZILMIYOR) —
  // böylece bu değer mevcut JWT/ownership korumasının altında kalır ve bir
  // kullanıcının senkronizasyonu başka bir kullanıcının veya paylaşılan
  // kataloğun verisini etkilemez. React state güncellemesinin yanında,
  // mevcut authenticated saveUserContentUpdate (PUT /user-contents/:id)
  // akışıyla kalıcı hale getirilir; status/watchedEpisodes/notes gibi
  // ilgisiz alanlar payload'a hiç dahil edilmez.
  const syncSeriesTotalEpisodes = (sourceId, totalEpisodeCount) => {
    const safeTotalEpisodes = Math.floor(toSafeNumber(totalEpisodeCount));

    if (safeTotalEpisodes <= 0) {
      return;
    }

    const content = contents.find(
      (item) => item.sourceId === sourceId && item.mediaType === "tv"
    );

    if (!content || content.totalEpisodes === safeTotalEpisodes) {
      return;
    }

    setContents((prevContents) =>
      prevContents.map((item) =>
        item.sourceId === sourceId && item.mediaType === "tv"
          ? { ...item, totalEpisodes: safeTotalEpisodes }
          : item
      )
    );

    saveUserContentUpdate(
      content,
      { totalEpisodes: safeTotalEpisodes },
      authToken
    ).then((result) => {
      if (result.status === "error" || result.status === "not_found") {
        console.error(
          "Bölüm sayısı senkronizasyonu MongoDB'ye kaydedilemedi:",
          result.message || result.status
        );
      }
    });
  };

  // Bir sezonun bölümleri (getSeasonDetails) yüklenince content.seasons'ı
  // günceller. Bu fonksiyon YALNIZCA modalın açılması/sezon görüntülenmesi
  // yüzünden çalışır — gerçek bir kullanıcı aksiyonu değildir. Bu yüzden
  // `watchedEpisodes` (kalıcı ilerleme özeti) burada ASLA yeniden hesaplanıp
  // ÜZERİNE YAZILMAZ; yalnızca gerçek kullanıcı aksiyonları (watchOneEpisode/
  // markAllWatched/toggleEpisodeWatched/toggleSeasonWatched) onu değiştirir.
  //
  // Bir sezon bu oturumda İLK KEZ yükleniyorsa (existingSeason yok, yani
  // kalıcı ayrıntılı episode state'i yok — bkz. bilinen sınırlama: seasons
  // MongoDB'de saklanmıyor), UI'da göstermek için canonical watchedEpisodes
  // değeri, yayın sırasına göre bu sezonun ilk N bölümüne watched=true
  // olarak "hydrate" edilir (N = watchedEpisodes eksi önceden zaten
  // hydrate/işaretlenmiş diğer sezonlardaki bölüm sayısı). Bu SADECE bir
  // UI başlangıç durumu temsilidir: watchedEpisodes'e dokunmaz, watchLogs
  // oluşturmaz, backend'e hiçbir şey göndermez. Sezonlar sırayla (S1, S2, ...)
  // gezilmediği durumlarda bu hydration kesin olmayabilir — bilinen ve kabul
  // edilen bir sınırlamadır.
  //
  // Bir sezon DAHA ÖNCE bu oturumda yüklenmiş/senkronlanmışsa (existingSeason
  // var), o sezonun gerçek watched/watchedAt değerleri (kullanıcının gerçek
  // tıklamalarından gelmiş olabilir) korunur; hydration bir daha uygulanmaz.
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

        const sortedTmdbEpisodes = [...tmdbEpisodes].sort(
          (a, b) => a.episode_number - b.episode_number
        );

        let mergedEpisodes;

        if (existingSeason) {
          const existingEpisodesByNumber = new Map(
            existingSeason.episodes.map((episode) => [
              episode.episodeNumber,
              episode,
            ])
          );

          mergedEpisodes = sortedTmdbEpisodes.map((episode) => {
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
        } else {
          const alreadyHydratedCount = existingSeasons.reduce(
            (sum, season) =>
              sum + season.episodes.filter((episode) => episode.watched).length,
            0
          );

          const remainingToHydrate = Math.max(
            Math.floor(toSafeNumber(content.watchedEpisodes)) - alreadyHydratedCount,
            0
          );

          mergedEpisodes = sortedTmdbEpisodes.map((episode, index) => ({
            id: `tmdb-episode-${episode.id}`,
            episodeNumber: episode.episode_number,
            name: episode.name || "",
            runtime:
              typeof episode.runtime === "number" ? episode.runtime : null,
            airDate: episode.air_date || "",
            overview: episode.overview || "",
            watched: index < remainingToHydrate,
            // watchedAt kasıtlı olarak null: bu bölümün gerçekte NE ZAMAN
            // izlendiği bilinmiyor (yalnızca özet sayı biliniyor) — sahte
            // bir tarih üretmek stats.js'teki tarihli istatistikleri
            // yanıltırdı.
            watchedAt: null,
          }));
        }

        const updatedSeasons = [
          ...existingSeasons.filter(
            (season) => season.seasonNumber !== seasonNumber
          ),
          { seasonNumber, name: seasonName, episodes: mergedEpisodes },
        ];

        const averageRuntime = computeAverageRuntime(
          updatedSeasons,
          content.minutesPerEpisode
        );

        return {
          ...content,
          seasons: updatedSeasons,
          minutesPerEpisode: averageRuntime,
          wordsPerEpisode: averageRuntime * 120,
        };
      })
    );
  };

  // Tek bir bölümün izlendi durumunu değiştirir. Eski içeriklerde seasons
  // yoksa veya eşleşen bölüm bulunamazsa güvenli şekilde hiçbir şey yapmaz.
  // Detaylı seasons/episodes verisi backend'in UserContent modelinde
  // desteklenmiyor (sadece watchedEpisodes/watchedMinutes/watchedPercentage/
  // status gibi özet alanlar var) — bu yüzden seasons sadece localStorage'da
  // tutulur, backend'e yalnızca özet alanlar gönderilir.
  const toggleEpisodeWatched = (sourceId, seasonNumber, episodeId) => {
    if (sourceId == null) {
      return;
    }

    const today = getToday();

    // Önce hedef içeriği ve yeni değerlerini setContents DIŞINDA hesapla.
    // (setContents'e verilen updater fonksiyonu React tarafından senkron
    // çalıştırılacağı garanti edilmez — updater'ın İÇİNDE bir dış değişkene
    // yazıp updater ÇAĞRISINDAN hemen sonra o değişkeni okumak, değer henüz
    // atanmadan okunduğu için her zaman eski/boş değeri verir. Bu yüzden
    // watchOneEpisode ile aynı güvenli desen kullanılıyor: hesapla, sonra
    // setContents'e hazır objeyi ver, sonra arka planda senkronize et.)
    const content = contents.find(
      (item) => item.sourceId === sourceId && item.mediaType === "tv"
    );

    if (!content) {
      return;
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
      content.totalEpisodes > 0 && watchedEpisodes >= content.totalEpisodes;

    const updatedContent = {
      ...content,
      seasons: updatedSeasons,
      watchedEpisodes,
      completedDate:
        isFinished && !content.completedDate ? today : content.completedDate,
    };

    setContents((prevContents) =>
      prevContents.map((item) => (item.id === content.id ? updatedContent : item))
    );

    const watchedMinutes = watchedEpisodes * (content.minutesPerEpisode || 0);
    const watchedPercentage =
      content.totalEpisodes > 0
        ? Math.min(
            100,
            Math.round((watchedEpisodes / content.totalEpisodes) * 100)
          )
        : 0;

    syncSummaryToBackendInBackground(content, {
      watchedEpisodes,
      watchedMinutes,
      watchedPercentage,
      status:
        FRONTEND_STATUS_TO_API_STATUS[getStatus(updatedContent)] || "watching",
    });
  };

  // Bir sezondaki tüm bölümleri tek seferde işaretler/kaldırır.
  // toggleEpisodeWatched ile aynı güvenli desen (ve aynı backend özet-alan
  // sınırlaması), sadece tüm bölümlere uygulanır.
  const toggleSeasonWatched = (sourceId, seasonNumber, markWatched) => {
    if (sourceId == null) {
      return;
    }

    const today = getToday();

    // toggleEpisodeWatched ile aynı desen: hesaplama setContents dışında
    // yapılır (updater fonksiyonunun senkron çalıştığı varsayılamaz).
    const content = contents.find(
      (item) => item.sourceId === sourceId && item.mediaType === "tv"
    );

    if (!content) {
      return;
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
      content.totalEpisodes > 0 && watchedEpisodes >= content.totalEpisodes;

    const updatedContent = {
      ...content,
      seasons: updatedSeasons,
      watchedEpisodes,
      completedDate:
        isFinished && !content.completedDate ? today : content.completedDate,
    };

    setContents((prevContents) =>
      prevContents.map((item) => (item.id === content.id ? updatedContent : item))
    );

    const watchedMinutes = watchedEpisodes * (content.minutesPerEpisode || 0);
    const watchedPercentage =
      content.totalEpisodes > 0
        ? Math.min(
            100,
            Math.round((watchedEpisodes / content.totalEpisodes) * 100)
          )
        : 0;

    syncSummaryToBackendInBackground(content, {
      watchedEpisodes,
      watchedMinutes,
      watchedPercentage,
      status:
        FRONTEND_STATUS_TO_API_STATUS[getStatus(updatedContent)] || "watching",
    });
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

  const [notesModalContentId, setNotesModalContentId] = useState(null);

  const notesModalContent =
    notesModalContentId !== null
      ? contents.find((content) => content.id === notesModalContentId)
      : null;

  // Sadece ilgili content'in notes alanını günceller, başka hiçbir alana
  // dokunmaz. Yeni içerik oluşturulurken notes alanı hiç eklenmiyor —
  // sadece kullanıcı gerçekten not yazınca oluşuyor. setContentStatus ile
  // aynı desen: önce backend'e PUT atmayı dener, sadece başarılı olursa
  // (veya backend'e hiç yazılmamış eski bir kayıtsa) state'i günceller.
  const updateContentNotes = async (contentId, notes) => {
    if (updatingContentId === contentId) {
      return;
    }

    const content = contents.find((item) => item.id === contentId);

    if (!content) {
      return;
    }

    const nextLocalContent = { ...content, notes };

    setUpdatingContentId(contentId);
    setContentAddFeedback(null);

    const result = await saveUserContentUpdate(content, { notes }, authToken);

    if (result.status === "success" || result.status === "local") {
      setContents((prevContents) =>
        prevContents.map((item) =>
          item.id === contentId ? nextLocalContent : item
        )
      );

      setContentAddFeedback(
        result.status === "success"
          ? { type: "success", text: "Not güncellendi." }
          : { type: "success", text: "Yerel kayıt güncellendi." }
      );
    } else if (result.status === "not_found") {
      setContents((prevContents) =>
        prevContents.map((item) =>
          item.id === contentId ? nextLocalContent : item
        )
      );

      setContentAddFeedback({
        type: "error",
        text: "Backend'de kayıt bulunamadı, yerel olarak güncellendi.",
      });
    } else {
      setContentAddFeedback({
        type: "error",
        text: "Güncelleme MongoDB'ye kaydedilemedi.",
      });
    }

    setUpdatingContentId(null);
  };

  const MAX_VISIBLE_SEASON_CHIPS = 5;

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

  const totalWatchedMinutes = getTotalInputMinutes(contents);

  const totalInputHours = totalWatchedMinutes / 60;

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
      });
    }

    return getDailyInputBuckets(contents, days);
  };

  const getMonthlyAnalytics = () => {
    return getMonthlyInputSummary(contents);
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
    if (!authUser) {
      return (
        <LoginRequiredState
          message="İlerlemenizi ve takip çizelgenizi görmek için giriş yapın."
          onLoginClick={() => openAuthModal("login")}
        />
      );
    }

    const dailyData = getDailyAnalytics();
    const monthlyData = getMonthlyAnalytics();
    const inputRecordCounts = getInputRecordCounts(contents);

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
            <strong>{formatMinutesLabel(lastDaysMinutes)}</strong>
          </div>

          <div className="stat-card big-stat">
            <span>Son 14 Gün Kelime</span>
            <strong>{lastDaysWords.toLocaleString("tr-TR")}</strong>
          </div>

          <div className="stat-card big-stat">
            <span>Input Kaydı</span>
            <div className="stat-body">
              <strong>{inputRecordCounts.total}</strong>
              <p className="stat-subtext">
                {inputRecordCounts.manual} manuel log ·{" "}
                {inputRecordCounts.episode} bölüm logu
              </p>
            </div>
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
                  <p>Toplam input: {formatMinutesLabel(month.minutes)}</p>
                  <p>Toplam kelime: {month.words.toLocaleString("tr-TR")}</p>
                </div>

                <ul>
                  {Object.entries(month.titles).map(([title, minutes]) => (
                    <li key={title}>
                      {title}: {formatMinutesLabel(minutes)}
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
    const isMovie = item.type === "Film";

    const isSeasonTracked =
      item.mediaType === "tv" && item.seasons && item.seasons.length > 0;

    // mediaType === "tv" tek başına yeterli değil: manuel eklenip TMDb ile
    // eşleştirilmemiş bir dizi de mediaType="tv" olabilir (bkz.
    // getMediaTypeFromContentType fallback'i, addContent). Detaylı sezon/
    // bölüm yönetimi yalnızca güvenilir bir TMDb TV id'si çözümlenebiliyorsa
    // gerçekten çalışır.
    const itemCanManageEpisodes = canManageEpisodes(item);

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
    const totalEpisodesUnknown = totalEpisodes <= 0;

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
                {item.type}
                {item.releaseYear ? ` · ${item.releaseYear}` : ""}
              </p>

              <div className="card-badges">
                <span
                  className={`card-badge ${
                    (STATUS_META[getStatus(item)] || STATUS_META["İzleyecekler"])
                      .badgeClassName
                  }`}
                >
                  {(STATUS_META[getStatus(item)] || STATUS_META["İzleyecekler"])
                    .label}
                </span>

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

              {item.overview && (
                <p className="card-overview">{item.overview}</p>
              )}

              <div className="card-status-picker">
                {STATUS_OPTIONS.map((option) => {
                  const isActive = getStatus(item) === option.value;

                  return (
                    <Chip
                      key={option.value}
                      variant="status"
                      selected={isActive}
                      onClick={() => setContentStatus(item.id, option.value)}
                      disabled={updatingContentId === item.id}
                    >
                      {option.label}
                    </Chip>
                  );
                })}
              </div>

              <div className="card-notes">
                {item.notes ? (
                  <>
                    <p className="card-notes-preview">
                      <span className="card-badge card-badge--notes">
                        Not var
                      </span>{" "}
                      {item.notes}
                    </p>

                    <button
                      type="button"
                      className="card-notes-btn"
                      onClick={() => setNotesModalContentId(item.id)}
                    >
                      Notu Düzenle
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="card-notes-btn"
                    onClick={() => setNotesModalContentId(item.id)}
                  >
                    Not Ekle
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            className="delete-btn"
            onClick={() => deleteContent(item.id, item.title)}
            disabled={deletingContentId === item.id}
          >
            {deletingContentId === item.id ? "Siliniyor..." : "Sil"}
          </button>
        </div>

        {!isMovie && (
          <div className="circle-progress-row">
            <div
              className="circle-progress"
              style={{
                background: `conic-gradient(var(--color-progress) ${progress}%, var(--color-surface-alt) 0)`,
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
        )}

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
            {!itemCanManageEpisodes && (
              <p className="series-progress-text series-progress-hint">
                Bu dizi TMDb ile eşleştirilmediği için detaylı sezon/bölüm
                takibi kullanılamıyor. Basit bölüm sayacını ("+1 bölüm
                izledim" / "Tümünü izledim") kullanmaya devam edebilirsin.
              </p>
            )}

            {itemCanManageEpisodes && item.seasons && item.seasons.length > 0 ? (
              (() => {
                const {
                  completionPercent,
                  nextEpisodeLabel,
                  visibleSeasons,
                  hiddenSeasonCount,
                } = getSeriesProgressSummary(item);

                return (
                  <>
                    <p className="series-progress-text">
                      Toplam ilerleme: {item.watchedEpisodes}/
                      {item.totalEpisodes} bölüm
                    </p>

                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>

                    <p className="series-progress-text">
                      Tamamlanma: %{completionPercent}
                    </p>

                    <p className="series-progress-text series-progress-next">
                      {nextEpisodeLabel}
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
            ) : itemCanManageEpisodes ? (
              <p className="series-progress-text">
                Bölüm bilgileri henüz yüklenmedi. Yüklemek için "Bölümleri
                Yönet"e bas.
              </p>
            ) : null}

            <button
              type="button"
              className="manage-episodes-btn"
              onClick={() => setManagingContentId(item.id)}
              disabled={!itemCanManageEpisodes}
              title={
                itemCanManageEpisodes
                  ? undefined
                  : "Detaylı yönetim için önce bu içeriği TMDb ile eşleştirmen gerekir"
              }
            >
              Bölümleri Yönet
            </button>
          </div>
        )}

        {!isMovie && (
          <div className="card-actions">
            <button
              className="watch-btn"
              onClick={() => watchOneEpisode(item.id)}
              disabled={isFinished || totalEpisodesUnknown}
              title={
                totalEpisodesUnknown
                  ? "Önce bölüm bilgilerini yükle"
                  : undefined
              }
            >
              +1 bölüm izledim
            </button>

            {!isSeasonTracked && (
              <button
                className="complete-btn"
                onClick={() => markAllWatched(item.id)}
                disabled={isFinished || totalEpisodesUnknown}
                title={
                  totalEpisodesUnknown
                    ? "Önce bölüm bilgilerini yükle"
                    : undefined
                }
              >
                Tümünü izledim
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDashboardPage = () => {
    if (!authUser) {
      return (
        <LoginRequiredState
          message="İçeriklerinizi takip etmek ve ilerlemenizi kaydetmek için giriş yapın."
          onLoginClick={() => openAuthModal("login")}
        />
      );
    }

    const last14DaysMinutes = getLast14DaysMinutes();
    const hasRecentMomentum = last14DaysMinutes > 0;

    const snapshotNarrative = hasRecentMomentum
      ? "Son 14 günde güzel bir ilerleme kaydettin, özet metriklerine aşağıdan göz atabilirsin."
      : "Son 14 günde henüz input eklemedin, küçük bir adım atmaya ne dersin?";

    return (
      <>
        <InputGoalCard
          totalHours={totalInputHours}
          targetHours={goalTargetHours}
          onSelectTarget={setGoalTargetHours}
        />

        <section className="summary-card">
          <div className="summary-head">
            <h2>Öğrenme Özeti</h2>
            <p>{snapshotNarrative}</p>
          </div>
        </section>

        <StatsPanel contents={contents} />

        <section className="quick-actions-panel">
          <p className="quick-actions-label">Hızlı Aksiyonlar</p>

          <div className="quick-actions-row">
            <a className="quick-action-primary" href="#new-content-anchor">
              İçerik ekle
            </a>

            <button
              type="button"
              className="quick-action-secondary"
              onClick={() => setActivePage("discover")}
            >
              Keşfet'e git
            </button>

            <button
              type="button"
              className="quick-action-outline"
              onClick={() => setActivePage("tracking")}
            >
              Takip çizelgesini gör
            </button>
          </div>
        </section>

        <div id="new-content-anchor">
          <ContentForm
            form={form}
            handleChange={handleChange}
            addContent={addContent}
            markAllInForm={markAllInForm}
            tmdbMatch={tmdbMatch}
            onTmdbMatchSelect={applyTmdbMatch}
            onClearTmdbMatch={clearTmdbMatch}
            tmdbManualOverride={tmdbManualOverride}
            onTmdbManualContinue={acknowledgeTmdbManualContinue}
            tmdbSearchTrigger={tmdbSearchTrigger}
            showTmdbDecision={showTmdbDecision}
            onTmdbDecisionSearch={handleTmdbDecisionSearch}
            onTmdbDecisionManual={handleTmdbDecisionManual}
            isSavingContent={isSavingContent}
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

  if (authLoading) {
    return (
      <div>
        <main className="app">
          <header className="header">
            <h1>Comprehensible Input Tracker</h1>
          </header>
          <p className="empty-text">Oturum kontrol ediliyor...</p>
        </main>
      </div>
    );
  }

  return (
    <div>
      <nav className="top-nav">
        <button
          className={activePage === "dashboard" ? "nav-active" : ""}
          aria-current={activePage === "dashboard" ? "page" : undefined}
          onClick={() => setActivePage("dashboard")}
        >
          Ana Sayfa
        </button>

        <button
          className={activePage === "discover" ? "nav-active" : ""}
          aria-current={activePage === "discover" ? "page" : undefined}
          onClick={() => setActivePage("discover")}
        >
          Keşfet
        </button>

        <button
          className={activePage === "library" ? "nav-active" : ""}
          aria-current={activePage === "library" ? "page" : undefined}
          onClick={() => setActivePage("library")}
        >
          Kütüphanem
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
          title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        </button>

        {authUser ? (
          <button type="button" onClick={handleLogout} title="Çıkış yap">
            Çıkış ({authUser.name || authUser.email})
          </button>
        ) : (
          <button
            type="button"
            className="nav-auth-btn"
            onClick={() => openAuthModal("login")}
          >
            Giriş Yap / Hesap Oluştur
          </button>
        )}
      </nav>

      <main className="app">
        <header className="header">
          <h1>Comprehensible Input Tracker</h1>
          <p>İngilizce içerik izleme sürecini ve ilerlemeni tek yerden takip et.</p>
        </header>

        {isContentsLoading && (
          <LoadingState label="İçerikler sunucudan yükleniyor..." />
        )}

        {contentsError && (
          <ErrorState
            className="empty-text"
            role="status"
            icon={null}
            description={`Sunucudan veri alınamadı, yerel kayıtların gösteriliyor. (${contentsError})`}
          />
        )}

        {contentAddFeedback && (
          <p className="empty-text">{contentAddFeedback.text}</p>
        )}

        {activePage === "dashboard" && renderDashboardPage()}

        {activePage === "discover" && (
          <DiscoverPage
            isItemAdded={isDiscoveryItemAdded}
            getItemStatusLabel={getDiscoveryItemStatusLabel}
            onAlreadyAdded={notifyDiscoveryItemAlreadyAdded}
            onAddToWatchlist={addDiscoveryItemToWatchlist}
            contents={contents}
            updatingContentId={updatingContentId}
            onSyncSeriesTotalEpisodes={syncSeriesTotalEpisodes}
            onSyncSeasonEpisodes={syncSeasonEpisodes}
            onToggleEpisodeWatched={toggleEpisodeWatched}
            onToggleSeasonWatched={toggleSeasonWatched}
          />
        )}

        {activePage === "library" &&
          (authUser ? (
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
          ) : (
            <LoginRequiredState
              message="Kütüphaneni görmek için giriş yapın."
              onLoginClick={() => openAuthModal("login")}
            />
          ))}

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
          updatingContentId={updatingContentId}
          onSyncSeriesTotalEpisodes={syncSeriesTotalEpisodes}
          onSyncSeasonEpisodes={syncSeasonEpisodes}
          onToggleEpisodeWatched={toggleEpisodeWatched}
          onToggleSeasonWatched={toggleSeasonWatched}
        />
      )}

      {notesModalContent && (
        <NotesModal
          title={notesModalContent.title}
          initialNotes={notesModalContent.notes || ""}
          onSave={(notes) => updateContentNotes(notesModalContent.id, notes)}
          onDelete={() => updateContentNotes(notesModalContent.id, "")}
          onClose={() => setNotesModalContentId(null)}
        />
      )}

      <Modal
        open={showAuthModal}
        onClose={closeAuthModal}
        ariaLabel="Giriş veya hesap oluşturma"
        size="md"
      >
        <AuthScreen
          mode={authMode}
          onModeChange={handleAuthModeChange}
          onLogin={handleLogin}
          onRegister={handleRegister}
          isLoading={isAuthSubmitting}
          error={authError}
        />
      </Modal>
    </div>
  );
}

export default App;