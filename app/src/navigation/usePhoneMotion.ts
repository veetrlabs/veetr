import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { phoneMotion } from './phoneMotion';

export function usePhoneMotion() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let generation = 0;
    let subscription: { remove(): void } | null = null;
    async function update() {
      const version = ++generation;
      subscription?.remove(); subscription = null; phoneMotion.reset();
      if (AppState.currentState !== 'active') return;
      try {
        if (!await Accelerometer.isAvailableAsync() || version !== generation) return;
        Accelerometer.setUpdateInterval(200);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (version === generation) phoneMotion.add(x * 9.81, y * 9.81, z * 9.81, Date.now());
        });
      } catch { if (version === generation) phoneMotion.reset(); } // GPS-only fallback on unsupported devices.
    }
    void update();
    const state = AppState.addEventListener('change', () => void update());
    return () => { generation++; subscription?.remove(); state.remove(); phoneMotion.reset(); };
  }, []);
}
