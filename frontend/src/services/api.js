// API Service for Decentralized PKI Framework

const API_BASE = "/api";

export function getToken() {
  return localStorage.getItem("dpki_token");
}

export function setSession(token, user) {
  localStorage.setItem("dpki_token", token);
  localStorage.setItem("dpki_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("dpki_token");
  localStorage.removeItem("dpki_user");
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("dpki_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = (typeof data === "object" && data.error) || data.message || `Request failed (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  getDemoOrganizations: () => request("/auth/demo-organizations"),
  login: (org_identifier, email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ org_identifier, email, password })
    }),
  registerOrg: (data) =>
    request("/auth/register-org", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getCurrentUser: () => request("/auth/me"),

  // Dashboard
  getDashboardSummary: () => request("/dashboard/summary"),

  // Certificates
  getCertificates: (search = "", status = "") => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    return request(`/certificates?${params.toString()}`);
  },
  getCertificateDetails: (certId) => request(`/certificates/${certId}`),
  getKeystoreStatus: () => request("/certificates/keystore-status"),
  generateKeypair: () => request("/certificates/generate-key", { method: "POST" }),
  issueCertificate: (payload) =>
    request("/certificates/issue", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // Verification Engine
  verifyCertificate: (payload) =>
    request("/verify", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // Revocation
  getRevocations: () => request("/revocations"),
  revokeCertificate: (cert_id, reason) =>
    request("/revocations/revoke", {
      method: "POST",
      body: JSON.stringify({ cert_id, reason })
    }),

  // Audit Logs
  getAuditLogs: (search = "", eventType = "", result = "") => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (eventType) params.append("event_type", eventType);
    if (result) params.append("result", result);
    return request(`/audit?${params.toString()}`);
  },

  // Trust Federation
  getFederatedOrganizations: () => request("/trust/organizations"),
  getTrustPolicies: () => request("/trust/policies"),
  updateTrustPolicy: (peer_org_identifier, is_trusted, notes = "") =>
    request("/trust/policies", {
      method: "POST",
      body: JSON.stringify({ peer_org_identifier, is_trusted, notes })
    })
};

