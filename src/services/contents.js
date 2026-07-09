const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiFetch(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || `İstek başarısız oldu: ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getContents() {
  return apiFetch("/contents");
}

export function createContent(payload) {
  return apiFetch("/contents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
