// A scan is a single-use operation. Late callbacks from a stopped scan must
// never be allowed to initiate a connection for a later attempt.
export const VANE_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const reconnectDelay = (attempt: number) => Math.min(30000, 3000 * 2 ** Math.min(Math.max(0, attempt - 1), 4));

export async function waitForBluetooth(manager: any, signal: AbortSignal, onState: (state: string) => void): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscription: { remove(): void } | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      subscription?.remove();
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new Error('Connection cancelled'));
    const timer = setTimeout(() => finish(new Error('Bluetooth is not ready. Please try again.')), 15000);
    const stateChanged = (state: string) => {
      if (settled) return;
      onState(state);
      if (state === 'PoweredOn') finish();
      else if (state === 'PoweredOff') finish(new Error('Turn on Bluetooth to connect to Veetr Vane.'));
      else if (state === 'Unauthorized') finish(new Error('Allow Bluetooth access for Veetr in Settings.'));
      else if (state === 'Unsupported') finish(new Error('Bluetooth is not supported on this device.'));
    };
    signal.addEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    try {
      subscription = manager.onStateChange(stateChanged, true);
      // Some adapters emit synchronously when registering the listener.
      if (settled) subscription?.remove();
    } catch (error) { finish(error as Error); }
  });
  if (signal.aborted) throw new Error('Connection cancelled');
}

export async function findVane(manager: any, signal: AbortSignal, onState: (state: string) => void, preferredId?: string): Promise<any> {
  await waitForBluetooth(manager, signal, onState);
  // Finish stopping any earlier scan before installing a new callback.
  await manager.stopDeviceScan();
  if (signal.aborted) throw new Error('Connection cancelled');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, device?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      // Mark settled before stopping: stop can itself emit a callback.
      Promise.resolve().then(() => manager.stopDeviceScan()).then(
        () => error ? reject(error) : resolve(device),
        stopError => reject(error ?? stopError),
      );
    };
    const abort = () => finish(new Error('Connection cancelled'));
    const timer = setTimeout(() => finish(new Error('No Veetr Vane found. Ensure it is powered on and nearby.')), 30000);
    signal.addEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    try {
      Promise.resolve(manager.startDeviceScan([VANE_SERVICE_UUID], null, (error: unknown, device: any) => {
        if (settled) return;
        if (error) finish(error);
        else if (device && (!preferredId || device.id === preferredId)) finish(undefined, device);
      })).catch(error => finish(error));
    } catch (error) { finish(error); }
  });
}
