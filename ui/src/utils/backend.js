// Provide the backend utility helpers.
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL ?? null

export const backendBaseUrl = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, '') : null

export const isBackendConfigured = Boolean(backendBaseUrl)
