import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { PairingScreen } from './PairingScreen';
import { AppSelector } from './AppSelector';
import { Dashboard } from './Dashboard';

interface AuthGuardProps {
  children?: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const pairingId = useAuthStore((state) => state.pairingId);
  const isAppsConfigured = useAuthStore((state) => state.isAppsConfigured);
  const setSession = useAuthStore((state) => state.setSession);
  const setSelectedApps = useAuthStore((state) => state.setSelectedApps);
  const setIsAppsConfigured = useAuthStore((state) => state.setIsAppsConfigured);

  useEffect(() => {
    // Check initial cached session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Subscribe to auth lifecycle events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession]);

  // Sync existing target_apps from Supabase if paired
  useEffect(() => {
    if (pairingId) {
      supabase
        .from('pairings')
        .select('target_apps')
        .eq('id', pairingId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.target_apps && Array.isArray(data.target_apps) && data.target_apps.length > 0) {
            setSelectedApps(data.target_apps);
            setIsAppsConfigured(true);
          }
        });
    }
  }, [pairingId, setSelectedApps, setIsAppsConfigured]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#003049]">
        <ActivityIndicator size="large" color="#f5b212" />
      </View>
    );
  }

  // 1. Unpaired: Route to PairingScreen
  if (!pairingId) {
    return <PairingScreen />;
  }

  // 2. Paired but targets not confirmed: Route to AppSelector
  if (!isAppsConfigured) {
    return <AppSelector />;
  }

  // 3. Paired & configured: Route to Dashboard
  return <Dashboard />;
}
