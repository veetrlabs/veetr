export const sensorFields = ['mx','my','mz','mq','ma','gx','gy','gz','bx','by','bz','gq','ga','acc','ce','ca'] as const;
export type VaneSensorSample = Record<typeof sensorFields[number], number | null>;
const nullableSensorFields = ['mx','my','mz','gx','gy','gz','bx','by','bz','acc'];
export function validSensorValue(key: string, value: unknown): boolean {
  if(value === null)return nullableSensorFields.includes(key);
  if(typeof value !== 'number' || !Number.isInteger(value))return false;
  if(['mq','gq'].includes(key))return value>=0 && value<=3;
  if(key==='ce')return value>=-1 && value<=7;
  if(['ma','ga','ca'].includes(key))return value>=-1 && value<=4294967295;
  return Math.abs(value)<=1000000 && (key!=='acc'||value>=0);
}
export type VaneSample = {
  sensor?: VaneSensorSample;
  up: number; imu: boolean; q: number; a: number; age: number; quality: number;
  north: boolean; offset: number; raw: number | null; hdg: number; rej: number; gps: boolean; sat: number;
};
export type VaneReport = { id: string; occurredAt: string; firmware: string; appVersion: string; samples: VaneSample[] };
const fields = [['up','imu','q','a','age','quality'], ['north','offset','raw','hdg','rej','gps','sat'], ['mx','my','mz','mq','ma','ce','ca','acc'], ['gx','gy','gz','bx','by','bz','gq','ga']];
let nextId = 0;
let pending: { id: number; count?: number; parts: Record<number, Record<string, unknown>>; finish: (value?: VaneSample) => void } | null = null;
export function receiveVaneDiagnostic(packet: any): boolean {
  if (packet?.type !== 'vane_diag') return false;
  if (!pending || packet.id !== pending.id || ![0,1,2,3].includes(packet.part)) return true;
  const part: Record<string, unknown> = {};
  for (const key of fields[packet.part]) {
    const value = packet[key];
    if (packet.part>=2) {if(!validSensorValue(key,value))return true;}
    else if (['imu','north','gps'].includes(key) ? typeof value !== 'boolean' : !(key === 'raw' && value === null) && (typeof value !== 'number' || !Number.isFinite(value))) return true;
    part[key] = value;
  }
  if(packet.part===0){if(packet.n!==undefined && packet.n!==4)return true;pending.count=packet.n===4?4:2;}
  pending.parts[packet.part] = part;
  if (pending.parts[0] && pending.parts[1] && (pending.count===2 || (pending.parts[2] && pending.parts[3]))) {
    pending.finish({...pending.parts[0], ...pending.parts[1], ...(pending.count===4 ? {sensor:{...pending.parts[2],...pending.parts[3]}} : {})} as VaneSample);
  }
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
    void send({cmd:'VANE_DIAGNOSTICS', id, v:2}).then(ok => { if (!ok && pending?.id === id) finish(); }).catch(() => { if (pending?.id === id) finish(); });
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
    ...(last.sensor ? ['Extended sensor measurements are included in this report.'] : ['Detailed sensor measurements require firmware 0.0.36 or newer.']),
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
