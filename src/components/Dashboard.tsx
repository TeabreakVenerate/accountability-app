import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { NativeSentinel } from '../lib/NativeSentinel';

export function Dashboard() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const setPairingId = useAuthStore((state) => state.setPairingId);
  const userRole = useAuthStore((state) => state.userRole);
  const setUserRole = useAuthStore((state) => state.setUserRole);
  const myTargets = useAuthStore((state) => state.myTargets);
  const setMyTargets = useAuthStore((state) => state.setMyTargets);
  const partnerTargets = useAuthStore((state) => state.partnerTargets);
  const setPartnerTargets = useAuthStore((state) => state.setPartnerTargets);
  const setIsAppsConfigured = useAuthStore((state) => state.setIsAppsConfigured);
  const isLockdownActive = useAuthStore((state) => state.isLockdownActive);
  const setIsLockdownActive = useAuthStore((state) => state.setIsLockdownActive);

  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Sync initial targets and user role from Supabase
  const loadPairingTargets = useCallback(async () => {
    if (!pairingId) return;

    try {
      const { data: pairing } = await supabase
        .from('pairings')
        .select('*')
        .eq('id', pairingId)
        .maybeSingle();

      if (!pairing) return;

      const { data: userData } = await supabase.auth.getUser();
      const role = userRole || (userData?.user?.id === pairing.user_1_id ? 'user_1' : 'user_2');
      if (!userRole) setUserRole(role);

      const localTargets = role === 'user_1' ? pairing.user_1_targets : pairing.user_2_targets;
      const remoteTargets = role === 'user_1' ? pairing.user_2_targets : pairing.user_1_targets;

      if (Array.isArray(localTargets)) setMyTargets(localTargets);
      if (Array.isArray(remoteTargets)) setPartnerTargets(remoteTargets);
    } catch (err) {
      console.warn('[Dashboard] Failed loading targets:', err);
    }
  }, [pairingId, userRole, setUserRole, setMyTargets, setPartnerTargets]);

  // Sync with native sentinel status on mount & set up Realtime listener
  useEffect(() => {
    loadPairingTargets();

    NativeSentinel.isSentinelRunning().then((running) => {
      if (running && !isLockdownActive) {
        setIsLockdownActive(true);
      }
    });

    if (!pairingId) return;

    // Listen for remote updates to my targets by partner
    const channel = supabase
      .channel(`dashboard-targets:${pairingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairings',
          filter: `id=eq.${pairingId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row) return;

          const role = userRole || 'user_1';
          const updatedMyTargets = role === 'user_1' ? row.user_1_targets : row.user_2_targets;
          const updatedPartnerTargets = role === 'user_1' ? row.user_2_targets : row.user_1_targets;

          if (Array.isArray(updatedMyTargets)) {
            setMyTargets(updatedMyTargets);
            // If sentinel is actively monitoring, update its target package list in real-time
            if (isLockdownActive) {
              await NativeSentinel.startSentinel(updatedMyTargets);
            }
          }
          if (Array.isArray(updatedPartnerTargets)) {
            setPartnerTargets(updatedPartnerTargets);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairingId, loadPairingTargets, isLockdownActive, setIsLockdownActive, userRole, setMyTargets, setPartnerTargets]);

  const handleToggleLockdown = async () => {
    if (myTargets.length === 0) {
      Alert.alert(
        'No Local Restrictions',
        'Your device has no restricted target apps set yet. Configure target apps to enable lockdown enforcement.',
        [{ text: 'Configure', onPress: () => setIsAppsConfigured(false) }]
      );
      return;
    }

    setIsTogglingLock(true);
    try {
      if (!isLockdownActive) {
        // Start Native Foreground Sentinel strictly on local user's targets
        await NativeSentinel.startSentinel(myTargets);
        setIsLockdownActive(true);
        Alert.alert(
          'LOCKDOWN ENGAGED',
          `Sentinel is actively monitoring ${myTargets.length} local target applications. Unauthorized launches will trigger the native overlay.`
        );
      } else {
        // Stop Native Foreground Sentinel
        await NativeSentinel.stopSentinel();
        setIsLockdownActive(false);
        Alert.alert('LOCKDOWN CLEARED', 'Background monitoring stood down.');
      }
    } catch (err: any) {
      Alert.alert('Sentinel Error', err?.message || 'Failed to toggle Lockdown Sentinel.');
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Partner',
      'Are you sure you want to unpair? This will stand down all active monitors and reset your session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            // Stop native sentinel if running
            await NativeSentinel.stopSentinel();
            setIsLockdownActive(false);

            if (pairingId) {
              await supabase
                .from('pairings')
                .update({ status: 'disconnected' })
                .eq('id', pairingId);
            }
            setPairingId(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <View className="flex-1 px-6 justify-between py-8">
        {/* Header & Status Section */}
        <View className="items-center mt-2">
          <Text className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">
            ACCOUNTABILITY SYSTEM
          </Text>

          {/* Connection & Sentinel Badges */}
          <View className="flex-row items-center gap-2 mb-4">
            <View className="flex-row items-center bg-[#002236] border border-[#f5b212]/40 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-sm" />
              <Text className="text-emerald-400 font-semibold text-[11px] tracking-wider uppercase">
                Peer Secure ({userRole === 'user_1' ? 'User 1' : 'User 2'})
              </Text>
            </View>

            <View
              className={`flex-row items-center border px-3 py-1.5 rounded-full ${
                isLockdownActive
                  ? 'bg-amber-950/40 border-[#f5b212]'
                  : 'bg-[#002236] border-gray-700'
              }`}
            >
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  isLockdownActive ? 'bg-[#f5b212] animate-pulse' : 'bg-gray-500'
                }`}
              />
              <Text
                className={`font-semibold text-[11px] tracking-wider uppercase ${
                  isLockdownActive ? 'text-[#f5b212]' : 'text-gray-400'
                }`}
              >
                {isLockdownActive ? 'Sentinel Active' : 'Sentinel Idle'}
              </Text>
            </View>
          </View>

          {/* Session & Target Apps Info Card */}
          <View className="bg-[#002236] border border-[#f5b212]/20 rounded-2xl p-5 w-full shadow-lg">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[11px] text-gray-400 tracking-wider uppercase font-semibold">
                Pairing Channel
              </Text>
              <Text className="text-xs font-bold text-[#f5b212] font-mono">
                {pairingId || 'UNKNOWN-SESSION'}
              </Text>
            </View>

            <View className="h-[1px] bg-gray-800 my-2" />

            {/* Local Restrictions */}
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1 mr-3">
                <Text className="text-white font-bold text-sm">
                  {myTargets.length} Local Target Apps Locked
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                  Enforced on this device by your partner
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAppsConfigured(false)}
                activeOpacity={0.7}
                className="bg-[#f5b212]/15 border border-[#f5b212]/40 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-xs text-[#f5b212] font-semibold">
                  Manage Apps
                </Text>
              </TouchableOpacity>
            </View>

            {/* Remote Restrictions */}
            <View className="pt-2 border-t border-gray-800/60 flex-row justify-between items-center">
              <Text className="text-[11px] text-gray-400">
                Partner's Device Restrictions:
              </Text>
              <Text className="text-[11px] font-bold text-[#f5b212]">
                {partnerTargets.length} Apps Restricted
              </Text>
            </View>
          </View>
        </View>

        {/* Center: Lockdown Toggle Button */}
        <View className="items-center my-auto">
          <TouchableOpacity
            onPress={handleToggleLockdown}
            disabled={isTogglingLock}
            activeOpacity={0.88}
            className={`w-full py-7 px-6 rounded-2xl items-center justify-center shadow-2xl border-2 ${
              isLockdownActive
                ? 'bg-red-950/80 border-red-500'
                : 'bg-[#f5b212] border-[#f5b212]'
            }`}
          >
            {isTogglingLock ? (
              <ActivityIndicator color={isLockdownActive ? '#ef4444' : '#003049'} size="large" />
            ) : (
              <>
                <Text
                  className={`font-black text-2xl tracking-widest uppercase text-center ${
                    isLockdownActive ? 'text-red-400' : 'text-[#003049]'
                  }`}
                >
                  {isLockdownActive ? 'DISENGAGE LOCKDOWN' : 'INITIATE LOCKDOWN'}
                </Text>
                <Text
                  className={`font-bold text-xs tracking-wider uppercase mt-1.5 ${
                    isLockdownActive ? 'text-red-300/80' : 'text-[#003049]/80'
                  }`}
                >
                  {isLockdownActive
                    ? 'Stand Down Foreground Sentinel & Overlay'
                    : `Engage Overlay for ${myTargets.length} Local Target Apps`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text className="text-xs text-gray-400 mt-4 text-center px-4 leading-4">
            {isLockdownActive
              ? 'Lockdown active: Opening any of your restricted packages will immediately draw the native lockout overlay.'
              : 'Pressing Initiate starts the native foreground service to poll UsageStats and enforce full-screen boundaries.'}
          </Text>
        </View>

        {/* Footer: Disconnect & Controls */}
        <View className="items-center pb-2">
          <TouchableOpacity
            onPress={handleDisconnect}
            activeOpacity={0.75}
            className="border border-red-500/40 bg-red-950/20 px-8 py-3.5 rounded-xl items-center justify-center"
          >
            <Text className="text-red-400 font-bold text-xs uppercase tracking-widest">
              Disconnect Partner
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
