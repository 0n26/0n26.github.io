export function readApi<T>(path: string, signal: AbortSignal): Promise<T>;
export function readApi<T>(path: string, signal: AbortSignal, missing: null): Promise<T | null>;
export async function readApi<T>(path: string, signal: AbortSignal, missing?: null): Promise<T | null> {
  const response = await fetch(path, { signal, cache: 'no-store' });
  if (response.status === 401) window.location.reload();
  if (response.status === 404 && missing === null) return null;
  if (!response.ok) throw new Error(`Gateway: HTTP ${response.status}`);
  return response.json();
}
