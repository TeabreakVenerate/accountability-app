import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { PairingScreen } from './PairingScreen';
import { Dashboard } from './Dashboard';

interface AuthGuardProps {
  children?: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const pairingId = useAuthStore((state) => state.pairingId);
  const setSession = useAuthStore((state) => state.setSession);

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#003049]">
        <ActivityIndicator size="large" color="#f5b212" />
      </View>
    );
  }

  // Routing condition: If paired, mount Dashboard. If not, mount PairingScreen.
  if (pairingId) {
    return <Dashboard />;
  }

  return <PairingScreen />;
}
