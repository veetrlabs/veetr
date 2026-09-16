/** Retry only read operations: a lost connection must never repeat a write. */
export function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|network connection|timed? out|timeout|aborted/i.test(message);
}
export async function retryRegattaRead<T>(read: () => Promise<T>, isActive = () => true): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isNetworkFailure(error) || !isActive()) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!isActive()) throw error;
    return read();
  }
}
export function regattaReadError(error: unknown): string {
  return isNetworkFailure(error)
    ? "Couldn’t refresh races. Check your connection and pull down to try again."
    : error instanceof Error ? error.message : "Races couldn’t be loaded. Pull down to try again.";
}
