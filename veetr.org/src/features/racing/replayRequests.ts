// Keep scrubbing responsive without overlapping requests or queuing stale frames.
export function replayRequests(fetchFrame: (at: number) => Promise<void>, interval = 200) {
  let pending: number | undefined;
  let running = false, disposed = false, lastStarted = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    if (disposed || running || timer !== undefined || pending === undefined) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (disposed || pending === undefined) return;
      const at = pending;
      pending = undefined;
      running = true;
      lastStarted = Date.now();
      try { await fetchFrame(at); }
      finally { running = false; schedule(); }
    }, Math.max(0, interval - (Date.now() - lastStarted)));
  }
  return {
    request(at: number) { pending = at; schedule(); },
    dispose() { disposed = true; pending = undefined; clearTimeout(timer); },
  };
}
