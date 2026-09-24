import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

export default function Index() {
  const pairingId = useAuthStore((state) => state.pairingId);
  if (pairingId) return <Redirect href="/dashboard" />;
  return <Redirect href="/pairing" />;
}
