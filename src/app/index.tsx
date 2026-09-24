import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

export default function Index() {
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const pairingId = useAuthStore((state) => state.pairingId);

  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  if (pairingId) return <Redirect href="/dashboard" />;
  return <Redirect href="/pairing" />;
}
