// Auth token manager for API requests
let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

export async function getAuthToken(): Promise<string | null> {
  if (!getTokenFn) return null;
  return getTokenFn();
}
