import { findVane } from '../bleConnection';
const flush = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };
afterEach(() => jest.useRealTimers());
test('waits for PoweredOn and removes adapter subscription before scanning', async () => {
  let state!: (state:string)=>void;
  const remove=jest.fn(), stopDeviceScan=jest.fn().mockResolvedValue(undefined);
  const device={name:'Veetr'};
  const manager={onStateChange:jest.fn(callback=>{state=callback;callback('Unknown');return {remove};}),stopDeviceScan,startDeviceScan:jest.fn((_u,_o,callback)=>{callback(null,device);return Promise.resolve();})};
  const promise=findVane(manager,new AbortController().signal,jest.fn());
  await flush();expect(manager.startDeviceScan).not.toHaveBeenCalled();
  state('PoweredOn');expect(await promise).toBe(device);
  expect(remove).toHaveBeenCalledTimes(1);expect(stopDeviceScan).toHaveBeenCalledTimes(2);
});
test('abort while waiting prevents a later adapter event starting a scan', async () => {
  let state!: (state:string)=>void;
  const remove=jest.fn(), controller=new AbortController();
  const manager={onStateChange:jest.fn(callback=>{state=callback;return {remove};}),startDeviceScan:jest.fn()};
  const promise=findVane(manager,controller.signal,jest.fn());
  controller.abort();await expect(promise).rejects.toThrow('cancelled');state('PoweredOn');
  expect(remove).toHaveBeenCalled();expect(manager.startDeviceScan).not.toHaveBeenCalled();
});
test('adapter startup timeout is bounded and cleans up the listener', async () => {
  jest.useFakeTimers();const remove=jest.fn();
  const manager={onStateChange:jest.fn(()=>({remove})),startDeviceScan:jest.fn()};
  const promise=findVane(manager,new AbortController().signal,jest.fn());
  const assertion=expect(promise).rejects.toThrow('not ready');
  jest.advanceTimersByTime(15000);await assertion;expect(remove).toHaveBeenCalled();
});
