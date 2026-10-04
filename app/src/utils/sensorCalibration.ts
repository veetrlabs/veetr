export type CalibrationStatus = { state: 'idle'|'starting'|'running'|'saving'|'saved'|'cancelled'|'unconfirmed'|'failed'|'unavailable'; mag:number; accel:number; gyro:number; ready:boolean };
const states=['idle','starting','running','saving','saved','cancelled','unconfirmed','failed','unavailable'];
let sequence=0;
const requests=new Map<number,(status:CalibrationStatus)=>void>();
export function receiveSensorCalibration(data:any) {
 if(data?.type!=='sensor_cal') return false;
 if(states.includes(data.state) && typeof data.ready==='boolean' && [data.mag,data.accel,data.gyro].every(x=>Number.isInteger(x)&&x>=0&&x<=3)) requests.get(data.id)?.(data);
 return true;
}
export function sensorCalibrationCommand(send:(command:any)=>Promise<boolean>,op:1|2|3|4):Promise<CalibrationStatus> {
 const id=sequence=sequence%65535+1;
 return new Promise((resolve,reject)=>{
  const finish=(status?:CalibrationStatus)=>{if(!requests.has(id))return;clearTimeout(timer);requests.delete(id);status?resolve(status):reject(new Error('Vane did not confirm the calibration command. Check Bluetooth and firmware 0.0.35 or later.'));};
  const timer=setTimeout(()=>finish(),6000);requests.set(id,finish);
  void send({cmd:'SENSOR_CAL',id,op}).then(ok=>{if(!ok)finish();}).catch(()=>finish());
 });
}
