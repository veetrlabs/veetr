import { router } from 'expo-router';
import BluetoothSettings from '../components/BluetoothSettings';
export default function BluetoothSettingsPage() {
  return <BluetoothSettings onBack={() => router.back()} />;
}
