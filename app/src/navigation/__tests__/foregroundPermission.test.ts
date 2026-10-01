import { createForegroundPermissionAccess } from '../foregroundPermission';
import type { LocationPermissionResponse } from 'expo-location';
const permission = (status: string, canAskAgain = true) => ({ status, canAskAgain, granted: status === 'granted', expires: 'never' } as LocationPermissionResponse);
function setup(status = 'undetermined', active = true, canAskAgain = true) {
 const api = { get: jest.fn(async () => permission(status, canAskAgain)), request: jest.fn(async () => permission('granted')), isActive: jest.fn(() => active) };
 return { api, access: createForegroundPermissionAccess(api) };
}
test('first launch asks only once, shares concurrent requests and returns the grant immediately', async () => {
 const { api, access } = setup();
 const [a, b] = await Promise.all([access(), access()]);
 expect(a.granted).toBe(true); expect(b.granted).toBe(true);
 await access(); expect(api.request).toHaveBeenCalledTimes(1);
});
test.each(['granted', 'denied'])('does not automatically prompt an existing %s choice', async status => {
 const { api, access } = setup(status); await access(); expect(api.request).not.toHaveBeenCalled();
});
test('defers startup prompt until app is active', async () => {
 const { api, access } = setup('undetermined', false); await access(); expect(api.request).not.toHaveBeenCalled();
 api.isActive.mockReturnValue(true); await access(); expect(api.request).toHaveBeenCalledTimes(1);
});
test('explicit GPS action can retry denial but respects system restrictions', async () => {
 const { api, access } = setup('denied'); await access(true); expect(api.request).toHaveBeenCalledTimes(1);
 const blocked = setup('denied', true, false); await blocked.access(true); expect(blocked.api.request).not.toHaveBeenCalled();
});
test('request failure does not cause repeated automatic prompts', async () => {
 const { api, access } = setup(); api.request.mockRejectedValueOnce(new Error('unavailable'));
 await expect(access()).rejects.toThrow('unavailable'); await access(); expect(api.request).toHaveBeenCalledTimes(1);
});
