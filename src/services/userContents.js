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

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getUserContents(token) {
  return apiFetch("/user-contents", {
    headers: authHeaders(token),
  });
}

export function createUserContent(payload, token) {
  return apiFetch("/user-contents", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(token),
  });
}

export function updateUserContent(id, payload, token) {
  return apiFetch(`/user-contents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: authHeaders(token),
  });
}

export function deleteUserContent(id, token) {
  return apiFetch(`/user-contents/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
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
