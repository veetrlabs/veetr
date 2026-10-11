import { router } from 'expo-router';
import AccountSettings from '../components/AccountSettings';
export default function AccountSettingsPage() {
  return <AccountSettings onBack={() => router.back()} />;
}
