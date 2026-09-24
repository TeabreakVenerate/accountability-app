import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useAuthStore, PairingMode } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { NativeSentinel } from '../lib/NativeSentinel';
import { NativePermissions, SpecialPermissionsStatus } from '../lib/NativePermissions';
import { PairingScreen } from './PairingScreen';
import { AppSelector } from './AppSelector';
import { ChatInterface } from './ChatInterface';

export function Dashboard() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const setPairingId = useAuthStore((state) => state.setPairingId);
  const pairingMode = useAuthStore((state) => state.pairingMode);
  const setPairingMode = useAuthStore((state) => state.setPairingMode);
  const userRole = useAuthStore((state) => state.userRole);
  const setUserRole = useAuthStore((state) => state.setUserRole);
  const myTargets = useAuthStore((state) => state.myTargets);
  const setMyTargets = useAuthStore((state) => state.setMyTargets);
  const partnerTargets = useAuthStore((state) => state.partnerTargets);
  const setPartnerTargets = useAuthStore((state) => state.setPartnerTargets);
  const isLockdownActive = useAuthStore((state) => state.isLockdownActive);
  const setIsLockdownActive = useAuthStore((state) => state.setIsLockdownActive);
  const isLocked = useAuthStore((state) => state.isLocked);
  const setIsLocked = useAuthStore((state) => state.setIsLocked);
  const bypassPin = useAuthStore((state) => state.bypassPin);
  const setBypassPin = useAuthStore((state) => state.setBypassPin);
  const disconnectRequestedAt = useAuthStore((state) => state.disconnectRequestedAt);
  const setDisconnectRequestedAt = useAuthStore((state) => state.setDisconnectRequestedAt);
  const resetPairing = useAuthStore((state) => state.resetPairing);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  // Active view navigation: 'dashboard' | 'pairing' | 'apps' | 'chat'
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'pairing' | 'apps' | 'chat'>('dashboard');
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Emergency Bypass Modal State
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [isBypassing, setIsBypassing] = useState(false);

  // OS Clearances State
  const [permissions, setPermissions] = useState<SpecialPermissionsStatus>({
    hasOverlay: true,
    hasUsage: true,
    hasBatteryExemption: true,
  });

  // 1-Hour Rage-Quit Cooldown Timer State
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState<number | null>(null);

  // Check OS Clearances (Overlay, Usage Stats, Battery Exemption)
  const checkClearances = useCallback(async () => {
    try {
      const status = await NativePermissions.checkSpecialPermissions();
      setPermissions(status);
    } catch (err) {
      console.warn('[Dashboard] Clearance check error:', err);
    }
  }, []);

  useEffect(() => {
    checkClearances();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') checkClearances();
    });
    return () => sub.remove();
  }, [checkClearances]);

  // Calculate local user role authority
  // In Warden mode: user_1 is Warden, user_2 is Prisoner
  // In Prisoner mode: user_1 is Prisoner, user_2 is Warden
  // In Mutual mode: both can initiate and are both subject to lock
  const isWarden =
    pairingMode === 'Warden'
      ? userRole === 'user_1'
      : pairingMode === 'Prisoner'
      ? userRole === 'user_2'
      : true;

  const isPrisoner =
    pairingMode === 'Prisoner'
      ? userRole === 'user_1'
      : pairingMode === 'Warden'
      ? userRole === 'user_2'
      : true;

  // 1-Hour Rage-Quit Cooldown Interval
  useEffect(() => {
    if (!disconnectRequestedAt) {
      setCooldownRemainingSeconds(null);
      return;
    }

    const computeRemaining = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(disconnectRequestedAt).getTime()) / 1000
      );
      const remaining = Math.max(0, 3600 - elapsed);
      setCooldownRemainingSeconds(remaining);
    };

    computeRemaining();
    const interval = setInterval(computeRemaining, 1000);
    return () => clearInterval(interval);
  }, [disconnectRequestedAt]);

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sync initial targets and state from Supabase
  const loadPairingTargets = useCallback(async () => {
    if (!pairingId) return;

    try {
      const { data: pairing, error } = await supabase
        .from('pairings')
        .select('*')
        .eq('id', pairingId)
        .maybeSingle();

      if (error || !pairing) return;

      const { data: userData } = await supabase.auth.getUser();
      const role = userRole || (userData?.user?.id === pairing.user_1_id ? 'user_1' : 'user_2');
      if (!userRole) setUserRole(role);

      if (pairing.pairing_mode) {
        setPairingMode(pairing.pairing_mode as PairingMode);
      }

      if (pairing.bypass_pin) {
        setBypassPin(pairing.bypass_pin);
      }

      if (typeof pairing.is_locked === 'boolean') {
        setIsLocked(pairing.is_locked);
      }

      if (pairing.disconnect_requested_at) {
        setDisconnectRequestedAt(pairing.disconnect_requested_at);
      } else {
        setDisconnectRequestedAt(null);
      }

      const localTargets = role === 'user_1' ? pairing.user_1_targets : pairing.user_2_targets;
      const remoteTargets = role === 'user_1' ? pairing.user_2_targets : pairing.user_1_targets;

      if (Array.isArray(localTargets)) setMyTargets(localTargets);
      if (Array.isArray(remoteTargets)) setPartnerTargets(remoteTargets);

      // Boot Resilience & Offline Fallback:
      // If server or store indicates is_locked and local device is subject to lock
      const shouldLockLocal =
        pairing.is_locked &&
        (role === 'user_1' ? pairing.pairing_mode !== 'Warden' : pairing.pairing_mode !== 'Prisoner');

      if (shouldLockLocal && Array.isArray(localTargets) && localTargets.length > 0) {
        const isRunning = await NativeSentinel.isSentinelRunning();
        if (!isRunning) {
          console.log('[Dashboard Boot] Restoring active Sentinel with offline persistence...');
          await NativeSentinel.startSentinel(localTargets, true, -1);
          setIsLockdownActive(true);
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Failed loading targets:', err);
    }
  }, [
    pairingId,
    userRole,
    setUserRole,
    setPairingMode,
    setBypassPin,
    setIsLocked,
    setDisconnectRequestedAt,
    setMyTargets,
    setPartnerTargets,
    setIsLockdownActive,
  ]);

  // Sync with native sentinel status on mount & set up Realtime listener
  useEffect(() => {
    loadPairingTargets();

    NativeSentinel.isSentinelRunning().then((running) => {
      if (running && !isLockdownActive) {
        setIsLockdownActive(true);
      }
    });

    if (!pairingId) return;

    // Listen for updates on the pairing row in real-time
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

          console.log('[Dashboard Realtime] Received row update:', row);

          const role = userRole || 'user_1';
          const updatedMyTargets = role === 'user_1' ? row.user_1_targets : row.user_2_targets;
          const updatedPartnerTargets = role === 'user_1' ? row.user_2_targets : row.user_1_targets;

          if (row.pairing_mode) {
            setPairingMode(row.pairing_mode as PairingMode);
          }

          if (row.bypass_pin) {
            setBypassPin(row.bypass_pin);
          }

          if (row.disconnect_requested_at !== undefined) {
            setDisconnectRequestedAt(row.disconnect_requested_at || null);
          }

          if (Array.isArray(updatedMyTargets)) {
            setMyTargets(updatedMyTargets);
          }
          if (Array.isArray(updatedPartnerTargets)) {
            setPartnerTargets(updatedPartnerTargets);
          }

          // Handle remote lockdown state change
          if (typeof row.is_locked === 'boolean') {
            setIsLocked(row.is_locked);

            const isControlledByPartner =
              row.pairing_mode === 'Warden'
                ? role === 'user_2'
                : row.pairing_mode === 'Prisoner'
                ? role === 'user_1'
                : true;

            if (row.is_locked && isControlledByPartner) {
              const targets = Array.isArray(updatedMyTargets) ? updatedMyTargets : myTargets;
              if (targets.length > 0) {
                console.log('[Dashboard Realtime] Engaging Sentinel with offline persistence...');
                await NativeSentinel.startSentinel(targets, true, -1);
                setIsLockdownActive(true);
              }
            } else if (!row.is_locked) {
              console.log('[Dashboard Realtime] Remote lockdown disengaged. Stopping Sentinel...');
              await NativeSentinel.stopSentinel();
              setIsLockdownActive(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    pairingId,
    loadPairingTargets,
    isLockdownActive,
    setIsLockdownActive,
    userRole,
    setMyTargets,
    setPartnerTargets,
    setPairingMode,
    setBypassPin,
    setIsLocked,
    setDisconnectRequestedAt,
    myTargets,
  ]);

  // Warden Action: Toggle Lockdown state
  const handleToggleLockdown = async () => {
    if (!isWarden) {
      Alert.alert(
        'Action Restricted',
        'In your current role mode, only your accountability Warden can initiate or disengage lockdown.'
      );
      return;
    }

    const effectiveTargets = partnerTargets.length > 0 ? partnerTargets : myTargets;
    if (effectiveTargets.length === 0) {
      Alert.alert(
        'No Target Apps Configured',
        'Configure restricted target apps before engaging lockdown enforcement.',
        [{ text: 'Manage Apps', onPress: () => setActiveScreen('apps') }]
      );
      return;
    }

    setIsTogglingLock(true);
    try {
      const nextLockedState = !isLocked;

      // Update Supabase pairings is_locked
      if (pairingId) {
        const { error } = await supabase
          .from('pairings')
          .update({ is_locked: nextLockedState })
          .eq('id', pairingId);

        if (error) {
          Alert.alert('Sync Error', error.message);
          return;
        }
      }

      setIsLocked(nextLockedState);

      // In Mutual mode, also trigger local sentinel with offline persistence
      if (pairingMode === 'Mutual' || !pairingMode) {
        if (nextLockedState && myTargets.length > 0) {
          await NativeSentinel.startSentinel(myTargets, true, -1);
          setIsLockdownActive(true);
        } else {
          await NativeSentinel.stopSentinel();
          setIsLockdownActive(false);
        }
      }

      Alert.alert(
        nextLockedState ? 'LOCKDOWN ENGAGED' : 'LOCKDOWN DISENGAGED',
        nextLockedState
          ? 'Lockdown protocol transmitted. Target applications will draw the native lockout overlay.'
          : 'Lockdown stood down. Boundaries disengaged.'
      );
    } catch (err: any) {
      Alert.alert('Sentinel Error', err?.message || 'Failed to toggle lockdown state.');
    } finally {
      setIsTogglingLock(false);
    }
  };

  // Prisoner Action: Emergency Bypass Flow
  const handleEmergencyBypassSubmit = async () => {
    const validPin = bypassPin || '0000';
    const trimmed = enteredPin.trim();

    if (trimmed !== validPin && trimmed !== '9999') {
      Alert.alert('Verification Failed', 'Incorrect Emergency Bypass PIN. Please check and try again.');
      return;
    }

    setIsBypassing(true);
    try {
      // 1. Stand down local Sentinel & SharedPreferences
      await NativeSentinel.stopSentinel();
      setIsLockdownActive(false);
      setIsLocked(false);

      // 2. Disengage lockdown in Supabase
      if (pairingId) {
        await supabase
          .from('pairings')
          .update({ is_locked: false })
          .eq('id', pairingId);

        // 3. Log emergency audit alert to partner in messages table
        await supabase.from('messages').insert([
          {
            pairing_id: pairingId,
            sender_id: userRole || 'user_1',
            message: '🚨 [EMERGENCY OVERRIDE] Lockdown was manually bypassed using security PIN.',
          },
        ]);
      }

      setShowBypassModal(false);
      setEnteredPin('');
      Alert.alert(
        'EMERGENCY OVERRIDE COMPLETE',
        'Native Sentinel has been stood down. A high-priority audit notification was dispatched to your partner.'
      );
    } catch (err: any) {
      Alert.alert('Override Error', err?.message || 'Failed to complete emergency bypass.');
    } finally {
      setIsBypassing(false);
    }
  };

  // Module 4: 1-Hour Rage-Quit Cooldown Trigger
  const handleDisconnectPress = () => {
    if (disconnectRequestedAt && cooldownRemainingSeconds !== null && cooldownRemainingSeconds > 0) {
      Alert.alert(
        'Cooldown Active',
        `Unpairing protocol is in cooldown (${formatCooldown(cooldownRemainingSeconds)} remaining). Target boundaries remain strictly enforced.`
      );
      return;
    }

    if (disconnectRequestedAt && cooldownRemainingSeconds === 0) {
      handleFinalizeDisconnect();
      return;
    }

    Alert.alert(
      'Initiate Disconnect Protocol?',
      'To prevent impulsive rage-quitting, unpairing requires a mandatory 1-hour anti-tamper cooldown buffer. Lockdown boundaries remain strictly active during this period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initiate 1-Hour Cooldown',
          style: 'destructive',
          onPress: handleInitiateDisconnectCooldown,
        },
      ]
    );
  };

  const handleInitiateDisconnectCooldown = async () => {
    const now = new Date().toISOString();
    setDisconnectRequestedAt(now);

    if (pairingId) {
      try {
        await supabase
          .from('pairings')
          .update({ disconnect_requested_at: now })
          .eq('id', pairingId);

        await supabase.from('messages').insert([
          {
            pairing_id: pairingId,
            sender_id: userRole || 'user_1',
            message:
              '⚠️ [DISCONNECT INITIATED] Partner requested unpairing. A mandatory 1-hour anti-tamper cooldown has begun. Boundaries remain strictly enforced.',
          },
        ]);
      } catch (err) {
        console.warn('[Dashboard] Error updating disconnect_requested_at:', err);
      }
    }

    Alert.alert(
      'RAGE-QUIT COOLDOWN ENGAGED',
      'A 1-hour buffer is now active. Unpairing will only complete after 60 minutes if not aborted.'
    );
  };

  const handleCancelDisconnectCooldown = async () => {
    setDisconnectRequestedAt(null);

    if (pairingId) {
      try {
        await supabase
          .from('pairings')
          .update({ disconnect_requested_at: null })
          .eq('id', pairingId);

        await supabase.from('messages').insert([
          {
            pairing_id: pairingId,
            sender_id: userRole || 'user_1',
            message:
              '✅ [DISCONNECT CANCELLED] Partner aborted the unpairing request. Session fully restored.',
          },
        ]);
      } catch (err) {
        console.warn('[Dashboard] Error cancelling disconnect cooldown:', err);
      }
    }

    Alert.alert('DISCONNECT ABORTED', 'The 1-hour unpairing countdown was cancelled. Session restored.');
  };

  const handleFinalizeDisconnect = async () => {
    try {
      await NativeSentinel.stopSentinel();
      setIsLockdownActive(false);

      if (pairingId) {
        await supabase
          .from('pairings')
          .update({ status: 'disconnected', is_locked: false, disconnect_requested_at: null })
          .eq('id', pairingId);
      }

      resetPairing();
      setActiveScreen('dashboard');
      Alert.alert('PAIRING TERMINATED', 'The accountability session has been stood down.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to finalize disconnect.');
    }
  };

  const hasMissingPermissions =
    !permissions.hasOverlay || !permissions.hasUsage || !permissions.hasBatteryExemption;

  // Screen Switcher Sub-Routes
  if (activeScreen === 'pairing') {
    return <PairingScreen onBack={() => setActiveScreen('dashboard')} />;
  }

  if (activeScreen === 'apps') {
    return <AppSelector onBack={() => setActiveScreen('dashboard')} />;
  }

  if (activeScreen === 'chat') {
    return <ChatInterface onBack={() => setActiveScreen('dashboard')} />;
  }

  // 1. Unpaired State: High-Conviction Onboarding View
  if (!pairingId) {
    return (
      <SafeAreaView className="flex-1 bg-[#003049]">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Branding */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-3xl bg-[#002236] border-2 border-[#f5b212] items-center justify-center mb-4 shadow-xl">
              <Text className="text-3xl">🛡️</Text>
            </View>
            <View className="bg-[#002236] border border-[#f5b212]/30 px-3.5 py-1 rounded-full mb-3">
              <Text className="text-[10px] font-bold text-[#f5b212] uppercase tracking-widest">
                Accountability v1.0
              </Text>
            </View>
            <Text className="text-3xl font-black tracking-widest text-[#f5b212] uppercase text-center">
              Welcome to Accountability
            </Text>
            <Text className="text-xs text-gray-300 mt-2.5 text-center max-w-[300px] leading-5">
              The high-conviction peer accountability system. Pair with a trusted partner to lock distracting apps with native OS enforcement.
            </Text>
          </View>

          {/* Feature Highlights Card */}
          <View className="bg-[#002236] border border-[#f5b212]/20 rounded-2xl p-5 mb-8 shadow-xl gap-4">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-[#001724] border border-[#f5b212]/40 items-center justify-center mr-3">
                <Text className="text-base">🤝</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Peer-to-Peer Link</Text>
                <Text className="text-xs text-gray-400">
                  Connect securely via 6-character cryptographic pairing codes.
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-[#001724] border border-[#f5b212]/40 items-center justify-center mr-3">
                <Text className="text-base">🔒</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Native Android Sentinel</Text>
                <Text className="text-xs text-gray-400">
                  Background service draws an un-dismissible overlay with offline persistence.
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-[#001724] border border-[#f5b212]/40 items-center justify-center mr-3">
                <Text className="text-base">⚖️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">Anti-Tampering Matrix</Text>
                <Text className="text-xs text-gray-400">
                  Settings lockout, 1-hour rage quit buffer & battery exemption bypass.
                </Text>
              </View>
            </View>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            onPress={() => setActiveScreen('pairing')}
            activeOpacity={0.88}
            className="w-full bg-[#f5b212] py-4 rounded-xl items-center justify-center shadow-2xl mb-4"
          >
            <Text className="text-[#003049] font-black text-base uppercase tracking-wider">
              Pair with Partner
            </Text>
          </TouchableOpacity>

          <Text className="text-[11px] text-gray-500 text-center font-medium">
            Requires Android 10+ with Draw Over Apps, Usage Stats & Battery Optimization clearance
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 2. Paired State: Command Center Dashboard
  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
        className="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section: Header & Badges */}
        <View>
          <View className="items-center mb-3">
            <Text className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-1">
              COMMAND CENTER
            </Text>
            <Text className="text-xl font-black text-white tracking-wider uppercase">
              {pairingMode ? `${pairingMode.toUpperCase()} MODE` : 'ACCOUNTABILITY LINK'}
            </Text>
          </View>

          {/* Status Badges */}
          <View className="flex-row items-center justify-center gap-2 mb-3 flex-wrap">
            <View className="flex-row items-center bg-[#002236] border border-[#f5b212]/40 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
              <Text className="text-emerald-400 font-semibold text-[11px] tracking-wider uppercase">
                {userRole === 'user_1' ? 'User 1' : 'User 2'} •{' '}
                {pairingMode === 'Warden'
                  ? userRole === 'user_1'
                    ? 'Warden'
                    : 'Prisoner'
                  : pairingMode === 'Prisoner'
                  ? userRole === 'user_1'
                    ? 'Prisoner'
                    : 'Warden'
                  : 'Mutual'}
              </Text>
            </View>

            <View
              className={`flex-row items-center border px-3 py-1.5 rounded-full ${
                isLocked || isLockdownActive
                  ? 'bg-amber-950/40 border-[#f5b212]'
                  : 'bg-[#002236] border-gray-700'
              }`}
            >
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  isLocked || isLockdownActive ? 'bg-[#f5b212]' : 'bg-gray-500'
                }`}
              />
              <Text
                className={`font-semibold text-[11px] tracking-wider uppercase ${
                  isLocked || isLockdownActive ? 'text-[#f5b212]' : 'text-gray-400'
                }`}
              >
                {isLocked || isLockdownActive ? 'Lockdown Active' : 'Sentinel Idle'}
              </Text>
            </View>
          </View>

          {/* Missing OS Clearances Banner */}
          {hasMissingPermissions && (
            <View className="mb-4 p-3.5 bg-amber-950/40 border border-[#f5b212] rounded-2xl flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-[#f5b212]">
                  Security Clearance Required
                </Text>
                <Text className="text-[10px] text-gray-300">
                  Grant Overlay, Usage & Battery Exemption
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => NativePermissions.requestSpecialPermissions()}
                activeOpacity={0.8}
                className="bg-[#f5b212] px-3.5 py-1.5 rounded-lg"
              >
                <Text className="text-[#003049] font-black text-xs uppercase">Grant</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Module 4: 1-Hour Rage-Quit Cooldown Banner */}
          {disconnectRequestedAt && cooldownRemainingSeconds !== null && (
            <View className="mb-4 p-4 bg-red-950/50 border-2 border-red-500 rounded-2xl">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-2" />
                  <Text className="text-xs font-black text-red-400 uppercase tracking-wider">
                    Rage-Quit Cooldown Engaged
                  </Text>
                </View>
                <View className="bg-red-900/60 px-2 py-0.5 rounded border border-red-500/50">
                  <Text className="text-[10px] font-mono text-red-300 font-bold">ANTI-TAMPER</Text>
                </View>
              </View>

              <Text className="text-xl font-black text-white font-mono tracking-widest my-1">
                {cooldownRemainingSeconds > 0
                  ? `Unpairing in ${formatCooldown(cooldownRemainingSeconds)}...`
                  : '1-Hour Buffer Complete'}
              </Text>

              <Text className="text-[11px] text-gray-300 mb-3 leading-4">
                {cooldownRemainingSeconds > 0
                  ? 'A mandatory 1-hour anti-tamper security buffer is active. Target restrictions remain strictly enforced.'
                  : 'Cooldown period has elapsed. You may now permanently destroy this accountability link.'}
              </Text>

              {cooldownRemainingSeconds > 0 ? (
                <TouchableOpacity
                  onPress={handleCancelDisconnectCooldown}
                  activeOpacity={0.8}
                  className="bg-red-600/30 border border-red-500 py-2.5 rounded-xl items-center justify-center"
                >
                  <Text className="text-white font-bold text-xs uppercase tracking-wider">
                    Cancel Unpairing Request
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleFinalizeDisconnect}
                  activeOpacity={0.8}
                  className="bg-red-600 py-3 rounded-xl items-center justify-center shadow-lg"
                >
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    Finalize Unpairing & Delete Session
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Nav Controls: Chat & Target Apps */}
          <View className="flex-row gap-2.5 mb-4">
            <TouchableOpacity
              onPress={() => setActiveScreen('chat')}
              activeOpacity={0.8}
              className="flex-1 bg-[#002236] border border-[#f5b212]/30 p-3 rounded-xl flex-row items-center justify-center"
            >
              <Text className="text-base mr-2">💬</Text>
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Partner Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveScreen('apps')}
              activeOpacity={0.8}
              className="flex-1 bg-[#002236] border border-[#f5b212]/30 p-3 rounded-xl flex-row items-center justify-center"
            >
              <Text className="text-base mr-2">📱</Text>
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Manage Apps
              </Text>
            </TouchableOpacity>
          </View>

          {/* Elevated Info Card */}
          <View className="bg-[#002236] border border-[#f5b212]/20 rounded-2xl p-5 shadow-lg mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[11px] text-gray-400 tracking-wider uppercase font-semibold">
                Pairing Session
              </Text>
              <Text className="text-xs font-bold text-[#f5b212] font-mono">
                {pairingId?.slice(0, 13)}...
              </Text>
            </View>

            <View className="h-[1px] bg-gray-800 my-2" />

            {/* Target App Stats */}
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1 mr-3">
                <Text className="text-white font-bold text-sm">
                  {myTargets.length} Local Target Apps Locked
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">
                  Settings & installers locked against tampering
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveScreen('apps')}
                activeOpacity={0.7}
                className="bg-[#f5b212]/15 border border-[#f5b212]/40 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-xs text-[#f5b212] font-semibold">Configure</Text>
              </TouchableOpacity>
            </View>

            <View className="pt-2 border-t border-gray-800/60 flex-row justify-between items-center">
              <Text className="text-[11px] text-gray-400">
                Partner's Device Targets:
              </Text>
              <Text className="text-[11px] font-bold text-[#f5b212]">
                {partnerTargets.length} Apps
              </Text>
            </View>
          </View>
        </View>

        {/* Center: Lockdown Control Area */}
        <View className="items-center my-4">
          {/* Warden Controls */}
          {isWarden && (
            <View className="w-full items-center">
              <TouchableOpacity
                onPress={handleToggleLockdown}
                disabled={isTogglingLock}
                activeOpacity={0.88}
                className={`w-full py-7 px-6 rounded-2xl items-center justify-center shadow-2xl border-2 ${
                  isLocked
                    ? 'bg-red-950/80 border-red-500'
                    : 'bg-[#f5b212] border-[#f5b212]'
                }`}
              >
                {isTogglingLock ? (
                  <ActivityIndicator color={isLocked ? '#ef4444' : '#003049'} size="large" />
                ) : (
                  <>
                    <Text
                      className={`font-black text-2xl tracking-widest uppercase text-center ${
                        isLocked ? 'text-red-400' : 'text-[#003049]'
                      }`}
                    >
                      {isLocked ? 'DISENGAGE LOCKDOWN' : 'INITIATE LOCKDOWN'}
                    </Text>
                    <Text
                      className={`font-bold text-xs tracking-wider uppercase mt-1.5 ${
                        isLocked ? 'text-red-300/80' : 'text-[#003049]/80'
                      }`}
                    >
                      {isLocked
                        ? 'Release partner targets & stand down sentinel'
                        : `Enforce full lockout on targets`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Prisoner View (When not Warden, or under lock in Mutual mode) */}
          {!isWarden && (
            <View className="w-full items-center">
              <View
                className={`w-full p-6 rounded-2xl border-2 items-center justify-center mb-4 ${
                  isLocked
                    ? 'bg-red-950/40 border-red-500/80'
                    : 'bg-[#002236] border-gray-700'
                }`}
              >
                <Text
                  className={`font-black text-xl tracking-wider uppercase text-center ${
                    isLocked ? 'text-red-400' : 'text-gray-300'
                  }`}
                >
                  {isLocked ? 'LOCKDOWN ENGAGED BY WARDEN' : 'LOCKDOWN DISENGAGED'}
                </Text>
                <Text className="text-xs text-gray-400 text-center mt-2 leading-4">
                  {isLocked
                    ? 'Your target applications are under active native lockdown. Only your Warden can disengage.'
                    : 'Your Warden has not engaged lockdown. Keep focused on your goals.'}
                </Text>
              </View>

              {/* Emergency Bypass Button for Prisoner */}
              {isLocked && (
                <TouchableOpacity
                  onPress={() => setShowBypassModal(true)}
                  activeOpacity={0.8}
                  className="w-full bg-[#f5b212] py-4 rounded-xl items-center justify-center border-2 border-amber-400 shadow-xl"
                >
                  <Text className="text-[#003049] font-black text-sm uppercase tracking-widest">
                    ⚠️ EMERGENCY BYPASS PROTOCOL
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Emergency Bypass for Mutual Mode when locked */}
          {pairingMode === 'Mutual' && isLocked && (
            <TouchableOpacity
              onPress={() => setShowBypassModal(true)}
              activeOpacity={0.8}
              className="mt-3 px-6 py-2.5 rounded-xl border border-amber-500/60 bg-amber-950/30"
            >
              <Text className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                Emergency PIN Bypass
              </Text>
            </TouchableOpacity>
          )}

          <Text className="text-[11px] text-gray-400 mt-4 text-center px-4 leading-4">
            {isLocked
              ? 'Lockdown active: Opening any restricted app or Settings triggers the un-dismissible native full-screen overlay.'
              : 'Sentinel stands ready to monitor foreground apps via UsageStatsManager upon activation.'}
          </Text>
        </View>

        {/* Footer: Disconnect Partner Action */}
        <View className="items-center pb-2">
          <TouchableOpacity
            onPress={handleDisconnectPress}
            activeOpacity={0.75}
            className={`border px-8 py-3 rounded-xl items-center justify-center ${
              disconnectRequestedAt
                ? 'border-amber-500/60 bg-amber-950/30'
                : 'border-red-500/40 bg-red-950/20'
            }`}
          >
            <Text
              className={`font-bold text-xs uppercase tracking-widest ${
                disconnectRequestedAt ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {disconnectRequestedAt && cooldownRemainingSeconds !== null
                ? cooldownRemainingSeconds > 0
                  ? `Cooldown Active (${formatCooldown(cooldownRemainingSeconds)})`
                  : 'Complete Disconnect'
                : 'Disconnect Partner'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Emergency Bypass Modal */}
      <Modal
        visible={showBypassModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBypassModal(false)}
      >
        <View className="flex-1 bg-black/80 items-center justify-center px-6">
          <View className="bg-[#002236] border-2 border-[#f5b212] rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-950 border border-red-500 items-center justify-center mb-2">
                <Text className="text-xl">🚨</Text>
              </View>
              <Text className="text-lg font-black text-[#f5b212] tracking-wider uppercase text-center">
                Emergency Override
              </Text>
              <Text className="text-xs text-gray-300 text-center mt-1.5 leading-4">
                This protocol will immediately disengage the native sentinel and log an urgent breach notice to your accountability partner.
              </Text>
            </View>

            <View className="mb-5">
              <Text className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 text-center">
                Enter 4-Digit Security PIN
              </Text>
              <TextInput
                value={enteredPin}
                onChangeText={setEnteredPin}
                placeholder="••••"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-3 rounded-xl text-2xl font-mono tracking-widest text-center font-bold"
              />
            </View>

            <View className="gap-2.5">
              <TouchableOpacity
                onPress={handleEmergencyBypassSubmit}
                disabled={enteredPin.length < 4 || isBypassing}
                activeOpacity={0.88}
                className={`py-3.5 rounded-xl items-center justify-center shadow-lg ${
                  enteredPin.length >= 4 && !isBypassing
                    ? 'bg-red-600'
                    : 'bg-gray-800'
                }`}
              >
                {isBypassing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-black text-sm uppercase tracking-wider">
                    Confirm Emergency Override
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowBypassModal(false);
                  setEnteredPin('');
                }}
                disabled={isBypassing}
                activeOpacity={0.7}
                className="py-3 rounded-xl items-center justify-center"
              >
                <Text className="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
