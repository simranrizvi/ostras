const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export class ApiError extends Error {
  constructor(message, status, code, requestId) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}
export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(150_000),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      data.error?.message || 'Something went wrong. Please try again.',
      response.status,
      data.error?.code,
      data.error?.requestId,
    );
  }
  return data;
}
export const API_URL_PUBLIC = API_URL;
