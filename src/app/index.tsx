import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

export default function Index() {
  const storeHydrated = useAuthStore((state) => state.hasHydrated);
  const [hasHydrated, setHasHydrated] = useState(() => {
    return typeof useAuthStore.persist?.hasHydrated === 'function'
      ? useAuthStore.persist.hasHydrated()
      : false;
  });

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist?.onFinishHydration(() => {
      setHasHydrated(true);
    });
    return () => {
      unsub?.();
    };
  }, []);

  const isReady = hasHydrated || storeHydrated;

  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const pairingId = useAuthStore((state) => state.pairingId);

  // Wait for AsyncStorage rehydration to complete before evaluating navigation state
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#003049' }} />;
  }

  // Route based on persisted state once hydration is verified
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  if (pairingId) return <Redirect href="/(tabs)/dashboard" />;
  return <Redirect href="/pairing" />;
}
