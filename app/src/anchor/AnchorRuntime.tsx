import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useBLE } from '../context/BLEContext';
import { useNavigation } from '../navigation/NavigationContext';
import { anchorError, receiveAnchorFix, resumeAnchor, tickAnchor } from './service';
export default function AnchorRuntime() {
  const { state } = useBLE();
  const { phonePoint } = useNavigation();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const resume = () => {
      if (AppState.currentState === 'active') void resumeAnchor().catch(anchorError);
    };
    resume();
    const sub = AppState.addEventListener('change', resume);
    const timer = setInterval(() => { void tickAnchor().catch(anchorError); }, 5000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!phonePoint || phonePoint.source === 'veetr') return;
    void receiveAnchorFix({ latitude: phonePoint.latitude, longitude: phonePoint.longitude,
      timestamp: Date.parse(phonePoint.recordedAt), accuracy: phonePoint.accuracyM, source: 'phone' }).catch(anchorError);
  }, [phonePoint]);
  useEffect(() => {
    if (!state.isConnected || !state.sailingData.gpsValid || state.lastMessageTime === null) return;
    void receiveAnchorFix({ latitude: state.sailingData.lat, longitude: state.sailingData.lon,
      timestamp: state.lastMessageTime, accuracy: null, source: 'vane' }).catch(anchorError);
  }, [state.isConnected, state.lastMessageTime, state.sailingData]);
  return null;
}
