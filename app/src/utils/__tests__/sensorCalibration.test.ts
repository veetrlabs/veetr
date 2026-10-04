import {sensorCalibrationCommand,receiveSensorCalibration} from '../sensorCalibration';
afterEach(()=>jest.useRealTimers());
test('only correlated, validated replies confirm calibration, never navigation',async()=>{
 let id=0;const p=sensorCalibrationCommand(async c=>{id=c.id;return true},3);
 expect(receiveSensorCalibration({HDM:4})).toBe(false);
 const packet={type:'sensor_cal',id,state:'saved',mag:3,accel:3,gyro:3,ready:false};
 expect(receiveSensorCalibration({...packet,id:id+1})).toBe(true);
 receiveSensorCalibration({...packet,mag:8});receiveSensorCalibration(packet);
 expect((await p).state).toBe('saved');
});
test('no response cannot report save success',async()=>{
 jest.useFakeTimers();const p=sensorCalibrationCommand(async()=>true,3);
 const assertion=expect(p).rejects.toThrow('did not confirm');jest.advanceTimersByTime(6001);await assertion;
});
