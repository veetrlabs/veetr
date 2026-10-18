export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const caller = init.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(caller?.reason);
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", abort);
  }
}

export function requestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? error);
  if (/timeout|timed out/i.test(message) || (error instanceof Error && error.name === "TimeoutError"))
    return "The server took too long to respond. Please try again.";
  if (/failed to fetch|networkerror|network request failed|fetch failed/i.test(message))
    return "Could not reach the server. Check your connection and try again.";
  return message;
}
