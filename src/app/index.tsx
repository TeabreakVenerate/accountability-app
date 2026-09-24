import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

export default function Index() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  // If Zustand AsyncStorage hydration is still pending, display splash spinner
  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#003049]">
        <ActivityIndicator size="large" color="#f5b212" />
      </View>
    );
  }

  // Active pairing -> Traffic control to /dashboard
  if (pairingId) {
    return <Redirect href="/dashboard" />;
  }

  // No active pairing -> Traffic control to /pairing
  return <Redirect href="/pairing" />;
}
