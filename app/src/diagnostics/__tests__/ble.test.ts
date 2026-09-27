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
test('history expires after thirty minutes and can be cleared', () => {
  jest.useFakeTimers();
  recordBleDiagnostic('scan','start');
  jest.advanceTimersByTime(1800001);
  expect(bleDiagnostics()).toEqual([]);
  recordBleDiagnostic('connect','start');
  clearBleDiagnostics();
  expect(bleDiagnostics()).toEqual([]);
});
