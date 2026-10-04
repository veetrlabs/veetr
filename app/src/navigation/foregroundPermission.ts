import type { LocationPermissionResponse } from 'expo-location';

/** One foreground prompt per launch, shared by startup and explicit GPS actions. */
export function createForegroundPermissionAccess(api: {
  get: () => Promise<LocationPermissionResponse>;
  request: () => Promise<LocationPermissionResponse>;
  isActive: () => boolean;
}) {
  let attempted = false;
  let pending: Promise<LocationPermissionResponse> | undefined;
  return (explicit = false): Promise<LocationPermissionResponse> => {
    if (pending) return pending;
    pending = (async () => {
      const permission = await api.get();
      if (api.isActive() && permission.canAskAgain && permission.status !== 'granted' &&
          (explicit || (!attempted && permission.status === 'undetermined'))) {
        attempted = true;
        return api.request();
      }
      return permission;
    })().finally(() => { pending = undefined; });
    return pending;
  };
}
