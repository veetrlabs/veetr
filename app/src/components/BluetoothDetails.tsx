import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useBLE } from '../context/BLEContext';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { t } from '../i18n';

export default function BluetoothDetails() {
  const { state } = useBLE();
  const c = themeColors[useTheme().theme];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = (at: number) => t('{{v0}} seconds ago', { v0: Math.max(0, Math.round((now - at) / 1000)) });
  const fresh = state.isConnected && state.rssi != null && state.rssiUpdatedAt != null && now - state.rssiUpdatedAt < 65000;
  const quality = state.rssi! >= -70 ? t('Strong') : state.rssi! >= -85 ? t('Fair') : t('Weak');
  const details = state.connectionDetails;
  const rows: [string, string][] = [
    [t('Device'), state.isConnected ? state.deviceName || t('Unknown') : '—'],
    [t('Signal strength'), fresh ? `${state.rssi} dBm · ${quality}` : t('Signal unavailable')],
  ];
  if (state.isConnected) {
    if (state.rssiUpdatedAt != null) rows.push([t('Signal measured'), age(state.rssiUpdatedAt)]);
    rows.push([t('Last data received'), state.lastMessageTime == null ? t('Waiting for data') : age(state.lastMessageTime)]);
    if (details) {
      rows.push([t('Connected since'), new Date(details.connectedAt).toLocaleTimeString()]);
      rows.push([t('Device identifier'), details.deviceId]);
      if (details.mtu != null) rows.push([t('Bluetooth packet size (MTU)'), `${details.mtu} ${t('bytes')}`]);
    }
  }
  return <View style={{ gap: 12, marginBottom: 16 }}>
    {rows.map(([label, value]) => <View key={label} style={{ gap: 3 }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Text selectable style={{ color: c.text }}>{value}</Text>
    </View>)}
    {state.isConnected && <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Signal strength refreshes about every 30 seconds. A value closer to zero is stronger.')}</Text>}
  </View>;
}
