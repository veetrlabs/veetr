import { bleDiagnostics, clearBleDiagnostics, recordBleDiagnostic, setBleAdapterState } from '../ble';
afterEach(() => { clearBleDiagnostics(); jest.useRealTimers(); });
test('preserves cancelled connection stage and numeric codes without peripheral or raw error data', () => {
  setBleAdapterState('PoweredOn');
  recordBleDiagnostic('scan', 'success');
  recordBleDiagnostic('connect', 'error', {errorCode:2,iosErrorCode:6,androidErrorCode:null,attErrorCode:null,message:'SECRET',deviceID:'SECRET',name:'SECRET'});
  expect(bleDiagnostics()[1]).toMatchObject({stage:'connect',outcome:'error',adapterState:'PoweredOn',errorCode:2,iosErrorCode:6});
  expect(JSON.stringify(bleDiagnostics())).not.toContain('SECRET');
});
test('bounds history and rejects invalid native fields', () => {
  setBleAdapterState('SECRET');
  for(let i=0;i<25;i++) recordBleDiagnostic('connect','error',{errorCode:'SECRET',iosErrorCode:NaN,androidErrorCode:-1,attErrorCode:100001});
  expect(bleDiagnostics()).toHaveLength(20);
  expect(bleDiagnostics()[0]).toMatchObject({adapterState:'Unknown',errorCode:null,iosErrorCode:null,androidErrorCode:null,attErrorCode:null});
});
test('history expires after six hours and can be cleared', () => {
  jest.useFakeTimers();
  recordBleDiagnostic('scan','start');
  jest.advanceTimersByTime(21600001);
  expect(bleDiagnostics()).toEqual([]);
  recordBleDiagnostic('connect','start');
  clearBleDiagnostics();
  expect(bleDiagnostics()).toEqual([]);
});

test('preserves disconnect context after a long sequence of successful reconnect stages', () => {
  jest.useFakeTimers();
  const {beginBleAttempt,noteBleConnected,noteBleSensor,noteBleRssi,noteBleFirmware,noteBleDisconnected}=require('../ble');
  beginBleAttempt(2,'direct');noteBleConnected();noteBleFirmware('v0.0.28');noteBleRssi(-87);noteBleSensor();
  jest.advanceTimersByTime(7000);
  recordBleDiagnostic('disconnect','error',{errorCode:201,iosErrorCode:6});noteBleDisconnected();
  for(let i=0;i<40;i++) recordBleDiagnostic('connect','success');
  expect(bleDiagnostics()).toHaveLength(20);
  expect(bleDiagnostics()).toContainEqual(expect.objectContaining({stage:'disconnect',connectionSeconds:7,sensorAgeSeconds:7,rssi:-87,rssiAgeSeconds:7,firmwareVersion:'v0.0.28',retryAttempt:2,method:'direct',attemptSeconds:7}));
  noteBleFirmware('PRIVATE DEVICE NAME');recordBleDiagnostic('connected','success');
  expect(JSON.stringify(bleDiagnostics())).not.toContain('PRIVATE');
});
