/**
 * Port of saas-hrms-frontend/lib/api.ts's apiRequest()/unwrapData(). The
 * network contract is unchanged (same {message,data} envelope, same
 * /api/v1/* paths) - only the auth transport changes: same-origin session
 * cookie + Django CSRF header instead of a bearer token read from
 * localStorage (see plan: architecture decisions / Auth).
 */
const API_BASE = "/api/v1";

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ? { "X-CSRFToken": getCsrfToken() }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch (e) {
      body = null;
    }
    const err = new Error((body && body.message) || `API ${response.status}`);
    err.status = response.status;
    err.errors = (body && body.errors) || {};
    throw err;
  }

  if (response.status === 204) return null;
  return response.json();
}

function unwrapData(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }
  return response;
}

window.apiRequest = apiRequest;
window.unwrapData = unwrapData;
window.getCsrfToken = getCsrfToken;
