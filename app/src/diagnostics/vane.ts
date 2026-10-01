export type VaneSample = {
  up: number; imu: boolean; q: number; a: number; age: number; quality: number;
  north: boolean; offset: number; raw: number | null; hdg: number; rej: number; gps: boolean; sat: number;
};
export type VaneReport = { id: string; occurredAt: string; firmware: string; appVersion: string; samples: VaneSample[] };
const fields = [['up','imu','q','a','age','quality'], ['north','offset','raw','hdg','rej','gps','sat']];
let nextId = 0;
let pending: { id: number; parts: Record<number, Record<string, unknown>>; finish: (value?: VaneSample) => void } | null = null;
export function receiveVaneDiagnostic(packet: any): boolean {
  if (packet?.type !== 'vane_diag') return false;
  if (!pending || packet.id !== pending.id || ![0,1].includes(packet.part)) return true;
  const part: Record<string, unknown> = {};
  for (const key of fields[packet.part]) {
    const value = packet[key];
    if (['imu','north','gps'].includes(key) ? typeof value !== 'boolean' : !(key === 'raw' && value === null) && (typeof value !== 'number' || !Number.isFinite(value))) return true;
    part[key] = value;
  }
  pending.parts[packet.part] = part;
  if (pending.parts[0] && pending.parts[1]) pending.finish({...pending.parts[0], ...pending.parts[1]} as VaneSample);
  return true;
}
export async function requestVaneDiagnostic(send: (command: any) => Promise<boolean>, signal: AbortSignal): Promise<VaneSample> {
  if (pending) throw new Error('A Vane diagnostic request is already running.');
  if (signal.aborted) throw new Error('Diagnostics cancelled.');
  const id = nextId = nextId % 65535 + 1;
  return new Promise((resolve, reject) => {
    const finish = (value?: VaneSample) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort); pending = null;
      if (value) resolve(value);
      else reject(new Error(signal.aborted ? 'Diagnostics cancelled.' : 'No diagnostic response. Check the connection and install firmware with Vane diagnostics support.'));
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish(), 5000);
    pending = {id, parts: {}, finish};
    signal.addEventListener('abort', abort, {once: true});
    void send({cmd:'VANE_DIAGNOSTICS', id}).then(ok => { if (!ok && pending?.id === id) finish(); }).catch(() => { if (pending?.id === id) finish(); });
  });
}
export function vaneFindings(samples: VaneSample[]): string[] {
  if (!samples.length) return ['No diagnostic samples received.'];
  const first = samples[0], last = samples[samples.length - 1];
  return [
    !last.imu ? 'Compass sensor was not detected at startup.' : last.q <= first.q || last.age > 3000 ? 'Compass readings are not arriving reliably.' : 'Compass readings are arriving.',
    last.q === 0 || last.age < 0 || last.age > 3000 ? 'Compass quality is unavailable without recent readings.' : samples.every(s => s.quality < 2) ? 'Compass quality stayed low. North alignment alone cannot fix sensor calibration.' : 'Compass reached usable quality during this check.',
    last.north ? 'A north alignment is loaded on Vane.' : 'No saved north alignment is loaded on Vane.',
    last.gps ? 'Vane has a recent GPS position.' : 'Vane does not have a recent GPS position.',
  ];
}

// Circular differences: 359° -> 1° is a 2° change, not a 358° jump.
export function largestHeadingStep(samples: VaneSample[]): number | null {
  let max: number | null = null;
  for (let i=1;i<samples.length;i++) {
    const a=samples[i-1], b=samples[i];
    if (a.raw === null || b.raw === null || a.age<0 || b.age<0 || a.age>3000 || b.age>3000 || b.q<=a.q) continue;
    const delta=Math.abs(((b.raw-a.raw+540)%360)-180);
    max=Math.max(max ?? 0,delta);
  }
  return max;
}
