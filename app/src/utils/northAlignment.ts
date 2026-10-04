export type NorthResult = 'accepted' | 'sensor_unavailable' | 'stale_reading' | 'quality_not_ready' | 'invalid_reading' | 'storage_failed' | 'unconfirmed' | 'send_failed' | 'busy';
let sequence = 0;
let pending: { id: string; finish: (result: NorthResult) => void } | null = null;
const reasons = ['accepted','sensor_unavailable','stale_reading','quality_not_ready','invalid_reading','storage_failed'];
export function receiveNorthAlignment(data: Record<string, unknown>) {
  if (data.type !== 'calibration_result') return false;
  if (data.action === 'resetCompassNorth' && data.requestId === pending?.id &&
      typeof data.reason === 'string' && reasons.includes(data.reason) &&
      data.accepted === (data.reason === 'accepted')) pending?.finish(data.reason as NorthResult);
  return true; // Never let acknowledgements overwrite sensor readings.
}
export function requestNorthAlignment(send: (command: any) => Promise<boolean>): Promise<NorthResult> {
  if (pending) return Promise.resolve('busy');
  return new Promise(resolve => {
    const id = `north-${Date.now()}-${++sequence}`;
    const finish = (result: NorthResult) => {
      if (pending?.id !== id) return;
      clearTimeout(timer); pending = null; resolve(result);
    };
    const timer = setTimeout(() => finish('unconfirmed'), 6000);
    pending = { id, finish };
    void Promise.resolve().then(() => send({ action: 'resetCompassNorth', requestId: id }))
      .then(sent => { if (!sent) finish('send_failed'); }).catch(() => finish('send_failed'));
  });
}
export const northResultMessage: Record<NorthResult, string> = {
 accepted: 'North alignment saved by Vane.',
 sensor_unavailable: 'Vane cannot detect the compass sensor.',
 stale_reading: 'Vane has no fresh compass reading. Wait and try again.',
 quality_not_ready: 'Compass accuracy is not ready. Wait for it to settle, then try again.',
 invalid_reading: 'Vane rejected an invalid compass reading. Try again after the sensor settles.',
 storage_failed: 'Vane could not save the north reference. The previous alignment remains active.',
 unconfirmed: 'Vane did not confirm north alignment. Check the heading; firmware 0.0.30 or later is required for confirmation.',
 send_failed: 'Could not send the north alignment command. Check the Bluetooth connection.',
 busy: 'North alignment is already in progress.',
};
