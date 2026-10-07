/** Fetch only public, published content. Query keys include every API filter. */
export async function fetchPublicContent<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Public content is temporarily unavailable");
  const body = (await response.json()) as T & { ok?: boolean };
  if (body.ok === false) throw new Error("Public content is temporarily unavailable");
  return body;
}
