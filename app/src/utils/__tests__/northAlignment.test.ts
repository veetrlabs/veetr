import { requestNorthAlignment, receiveNorthAlignment } from '../northAlignment';
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.runAllTimers(); jest.useRealTimers(); });
it('requires a matching acknowledgement and preserves reported rejection', async () => {
 const send = jest.fn(async (_command: any) => true); const result = requestNorthAlignment(send); await Promise.resolve();
 expect(await requestNorthAlignment(send)).toBe('busy');
 expect(receiveNorthAlignment({ type: 'sensor' })).toBe(false);
 const command = send.mock.calls[0][0] as any;
 receiveNorthAlignment({ type: 'calibration_result', action: command.action, requestId: 'wrong', reason: 'accepted', accepted: true });
 receiveNorthAlignment({ type: 'calibration_result', ...command, reason: 'quality_not_ready', accepted: false });
 expect(await result).toBe('quality_not_ready');
});
it('does not claim success for old firmware, lost notifications or write failures', async () => {
 const waiting = requestNorthAlignment(async () => true); await Promise.resolve(); jest.advanceTimersByTime(6000);
 expect(await waiting).toBe('unconfirmed');
 expect(await requestNorthAlignment(async () => false)).toBe('send_failed');
});
it('accepts acknowledgement arriving before the write promise resolves', async () => {
 const result = requestNorthAlignment(async command => { receiveNorthAlignment({ type: 'calibration_result', ...command, accepted: true, reason: 'accepted' }); return true; });
 expect(await result).toBe('accepted');
});
