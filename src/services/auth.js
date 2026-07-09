const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function apiFetch(endpoint, { headers, ...options } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json", ...headers },
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

export function registerUser(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser(token) {
  return apiFetch("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
