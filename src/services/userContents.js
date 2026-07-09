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

export function getUserContents(userId) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return apiFetch(`/user-contents${query}`);
}

export function createUserContent(payload) {
  return apiFetch("/user-contents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUserContent(id, payload) {
  return apiFetch(`/user-contents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUserContent(id) {
  return apiFetch(`/user-contents/${id}`, {
    method: "DELETE",
  });
}

export function getUsers() {
  return apiFetch("/users");
}

export function createUser(payload) {
  return apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
