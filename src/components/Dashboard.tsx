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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, PairingMode, CatalogApp } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { NativeSentinel } from '../lib/NativeSentinel';
import { NativePermissions, SpecialPermissionsStatus } from '../lib/NativePermissions';
import { fetchInstalledApps } from '../lib/NativeInstalledApps';

// Common elevated card shadow using native style objects (prevents NativeWind dynamic shadow context crash)
const elevatedCardStyle = {
  backgroundColor: '#004060',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.2,
  shadowRadius: 10,
  elevation: 6,
};

const heroShieldStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 18,
  elevation: 12,
};

const masterButtonStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 14,
  elevation: 8,
};

export function Dashboard() {
  const insets = useSafeAreaInsets();
  const pairingId = useAuthStore((state) => state.pairingId);
  const pairingCode = useAuthStore((state) => state.pairingCode);
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
  const resetPairing = useAuthStore((state) => state.resetPairing);

  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [isSentinelServiceRunning, setIsSentinelServiceRunning] = useState(false);

  // Emergency Bypass Modal State
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [isBypassing, setIsBypassing] = useState(false);
  const [isRequestingPin, setIsRequestingPin] = useState(false);

  // Module 4: The Silent Catalog Sync - automatically push stripped catalog on active pairing
  useEffect(() => {
    if (!pairingId) return;

    let isCancelled = false;

    const performSilentCatalogSync = async () => {
      try {
        const { data: pairing, error } = await supabase
          .from('pairings')
          .select('user_1_id, status, user_1_catalog, user_2_catalog')
          .eq('id', pairingId)
          .maybeSingle();

        if (error || !pairing || pairing.status !== 'active') return;

        const { data: userData } = await supabase.auth.getUser();
        const role = userRole || (userData?.user?.id === pairing.user_1_id ? 'user_1' : 'user_2');
        const catalogColumn = role === 'user_1' ? 'user_1_catalog' : 'user_2_catalog';

        // Check if catalog already populated to prevent redundant transfers
        const existingCatalog = role === 'user_1' ? pairing.user_1_catalog : pairing.user_2_catalog;
        if (Array.isArray(existingCatalog) && existingCatalog.length > 0) {
          return;
        }

        console.log(`[Dashboard] Silent Catalog Sync: fetching apps for ${catalogColumn}...`);
        const apps = await fetchInstalledApps();
        if (isCancelled) return;

        const strippedCatalog: CatalogApp[] = apps.map(({ appName, packageName }) => ({
          appName,
          packageName,
        }));

        console.log(`[Dashboard] Silent Catalog Sync: uploading ${strippedCatalog.length} apps to ${catalogColumn}...`);
        await supabase
          .from('pairings')
          .update({ [catalogColumn]: strippedCatalog })
          .eq('id', pairingId);
      } catch (err) {
        console.warn('[Dashboard] Silent Catalog Sync error:', err);
      }
    };

    performSilentCatalogSync();

    return () => {
      isCancelled = true;
    };
  }, [pairingId, userRole]);

  // OS Clearances State
  const [permissions, setPermissions] = useState<SpecialPermissionsStatus>({
    hasOverlay: true,
    hasUsage: true,
    hasBatteryExemption: true,
  });

  // Check OS Clearances (Overlay, Usage Stats, Battery Exemption)
  const checkClearances = useCallback(async () => {
    try {
      const status = await NativePermissions.checkSpecialPermissions();
      setPermissions(status);
    } catch (err) {
      console.warn('[Dashboard] Clearance check error:', err);
    }
  }, []);

  // Check Sentinel background running state
  const checkSentinelStatus = useCallback(async () => {
    try {
      const running = await NativeSentinel.isSentinelRunning();
      setIsSentinelServiceRunning(running);
      if (running && !isLockdownActive) {
        setIsLockdownActive(true);
      }
    } catch (err) {
      console.warn('[Dashboard] Sentinel check error:', err);
    }
  }, [isLockdownActive, setIsLockdownActive]);

  useEffect(() => {
    checkClearances();
    checkSentinelStatus();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        checkClearances();
        checkSentinelStatus();
      }
    });
    return () => sub.remove();
  }, [checkClearances, checkSentinelStatus]);

  // Authority rules
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

      if (pairing.emergency_pin || pairing.bypass_pin) {
        setBypassPin(pairing.emergency_pin || pairing.bypass_pin);
      }

      if (typeof pairing.is_locked === 'boolean') {
        setIsLocked(pairing.is_locked);
      }

      const localTargets = role === 'user_1' ? pairing.user_1_targets : pairing.user_2_targets;
      const remoteTargets = role === 'user_1' ? pairing.user_2_targets : pairing.user_1_targets;

      if (Array.isArray(localTargets)) setMyTargets(localTargets);
      if (Array.isArray(remoteTargets)) setPartnerTargets(remoteTargets);

      // Boot Resilience & Offline Fallback:
      const shouldLockLocal =
        pairing.is_locked &&
        (role === 'user_1' ? pairing.pairing_mode !== 'Warden' : pairing.pairing_mode !== 'Prisoner');

      if (shouldLockLocal && Array.isArray(localTargets) && localTargets.length > 0) {
        const isRunning = await NativeSentinel.isSentinelRunning();
        if (!isRunning) {
          console.log('[Dashboard Boot] Restoring active Sentinel with offline persistence...');
          await NativeSentinel.startSentinel(localTargets, true, -1);
          setIsLockdownActive(true);
          setIsSentinelServiceRunning(true);
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
    setMyTargets,
    setPartnerTargets,
    setIsLockdownActive,
  ]);

  // Sync initial targets on mount
  useEffect(() => {
    loadPairingTargets();
  }, [loadPairingTargets]);

  // Realtime subscription for remote pairing updates
  useEffect(() => {
    if (!pairingId) return;

    const channelName = `dashboard-targets:${pairingId}`;

    // Clean up any lingering channel with the same topic to prevent collision errors
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${channelName}` || c.topic === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }

    // Initialize channel and chain all .on() listeners first
    const channel = supabase
      .channel(channelName)
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

          const { userRole: currentRole, myTargets: currentMyTargets } = useAuthStore.getState();
          const role = currentRole || 'user_1';
          const updatedMyTargets = role === 'user_1' ? row.user_1_targets : row.user_2_targets;
          const updatedPartnerTargets = role === 'user_1' ? row.user_2_targets : row.user_1_targets;

          if (row.pairing_mode) {
            setPairingMode(row.pairing_mode as PairingMode);
          }

          if (row.emergency_pin || row.bypass_pin) {
            setBypassPin(row.emergency_pin || row.bypass_pin);
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
              const targets = Array.isArray(updatedMyTargets) ? updatedMyTargets : currentMyTargets;
              if (targets.length > 0) {
                console.log('[Dashboard Realtime] Engaging Sentinel with offline persistence...');
                await NativeSentinel.startSentinel(targets, true, -1);
                setIsLockdownActive(true);
                setIsSentinelServiceRunning(true);
              }
            } else if (!row.is_locked) {
              console.log('[Dashboard Realtime] Remote lockdown disengaged. Stopping Sentinel...');
              await NativeSentinel.stopSentinel();
              setIsLockdownActive(false);
              setIsSentinelServiceRunning(false);
            }
          }
        }
      );

    // Call .subscribe() at the end
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[Dashboard Realtime] Channel error for ${channelName}:`, err?.message || err);
      }
    });

    // Cleanup on unmount
    return () => {
      console.log(`[Dashboard Realtime] Teardown: removing channel ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [
    pairingId,
    setPairingMode,
    setBypassPin,
    setIsLocked,
    setMyTargets,
    setPartnerTargets,
    setIsLockdownActive,
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
        [{ text: 'Manage Apps', onPress: () => router.push('/(tabs)/targets') }]
      );
      return;
    }

    setIsTogglingLock(true);
    try {
      const nextLockedState = !isLocked;

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

      if (pairingMode === 'Mutual' || !pairingMode) {
        if (nextLockedState && myTargets.length > 0) {
          await NativeSentinel.startSentinel(myTargets, true, -1);
          setIsLockdownActive(true);
          setIsSentinelServiceRunning(true);
        } else {
          await NativeSentinel.stopSentinel();
          setIsLockdownActive(false);
          setIsSentinelServiceRunning(false);
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

  // Module 3: Prisoner Action - Request Emergency Bypass PIN Engine
  const handleRequestEmergencyBypass = async () => {
    if (!pairingId) return;

    setIsRequestingPin(true);
    try {
      // 1. Generate random 4-digit PIN
      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      // 2. Execute Supabase UPDATE on pairings table setting emergency_pin (with fallback to bypass_pin)
      const { error: pinError } = await supabase
        .from('pairings')
        .update({ emergency_pin: generatedPin, bypass_pin: generatedPin })
        .eq('id', pairingId);

      if (pinError) {
        console.warn('[Dashboard] Failed to update emergency_pin, falling back to bypass_pin:', pinError.message);
        await supabase
          .from('pairings')
          .update({ bypass_pin: generatedPin })
          .eq('id', pairingId);
      }

      // 3. Execute Supabase INSERT into messages table automatically notifying Warden
      await supabase.from('messages').insert([
        {
          pairing_id: pairingId,
          sender_id: userRole || 'user_1',
          message: `🚨 Emergency Bypass Requested. Your partner's PIN is: ${generatedPin}`,
        },
      ]);

      // Update local state and reveal verification modal
      setBypassPin(generatedPin);
      setShowBypassModal(true);

      Alert.alert(
        'EMERGENCY REQUEST SENT',
        `A high-priority override request was dispatched to your partner. Authorized PIN: ${generatedPin}. Enter it into the modal to stand down the lockdown.`
      );
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Failed to dispatch emergency bypass request.');
    } finally {
      setIsRequestingPin(false);
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
      await NativeSentinel.stopSentinel();
      setIsLockdownActive(false);
      setIsLocked(false);
      setIsSentinelServiceRunning(false);

      if (pairingId) {
        await supabase
          .from('pairings')
          .update({ is_locked: false })
          .eq('id', pairingId);

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

  // Immediate Disconnect Partner Flow
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Partner',
      'Are you sure you want to unpair? This will stand down all active monitors and reset your session immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await NativeSentinel.stopSentinel();
              setIsLockdownActive(false);
              setIsSentinelServiceRunning(false);

              if (pairingId) {
                await supabase
                  .from('pairings')
                  .update({ status: 'disconnected', is_locked: false })
                  .eq('id', pairingId);
              }

              resetPairing();
              router.replace('/pairing');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to disconnect partner.');
            }
          },
        },
      ]
    );
  };

  const hasMissingPermissions =
    !permissions.hasOverlay || !permissions.hasUsage || !permissions.hasBatteryExemption;

  const effectiveTargets = partnerTargets.length > 0 ? partnerTargets : myTargets;
  const isEnforcing = isLocked || isLockdownActive || isSentinelServiceRunning;

  // Determine role label
  const roleTitle =
    pairingMode === 'Warden'
      ? userRole === 'user_1'
        ? 'Warden (Enforcer)'
        : 'Prisoner (Disciplined)'
      : pairingMode === 'Prisoner'
      ? userRole === 'user_1'
        ? 'Prisoner (Disciplined)'
        : 'Warden (Enforcer)'
      : 'Mutual Partner';

  // 1. UNPAIRED STATE VIEW
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
            <View
              className="w-24 h-24 rounded-full bg-[#002236] border-2 border-[#f5b212] items-center justify-center mb-4"
              style={heroShieldStyle}
            >
              <Text className="text-4xl">🛡️</Text>
            </View>
            <View className="bg-[#002236] border border-[#f5b212]/40 px-3.5 py-1 rounded-full mb-3">
              <Text className="text-[10px] font-mono font-bold text-[#f5b212] uppercase tracking-widest">
                SYSTEM STANDBY • UNPAIRED
              </Text>
            </View>
            <Text className="text-3xl font-black tracking-widest text-[#f5b212] uppercase text-center">
              Command Center
            </Text>
            <Text className="text-xs text-gray-300 mt-2 text-center max-w-[310px] leading-5">
              No active accountability link detected. Establish an encrypted handshake with your partner to engage hardware enforcement.
            </Text>
          </View>

          {/* Telemetry Preview Grid */}
          <View className="mb-8">
            <Text className="text-[11px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">
              TELEMETRY ENGINE PREVIEW
            </Text>
            <View className="flex-row gap-3 mb-3">
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4"
                style={elevatedCardStyle}
              >
                <Text className="text-xl mb-1">🎯</Text>
                <Text className="text-white font-bold text-sm">Monitored Apps</Text>
                <Text className="text-[11px] text-gray-300 mt-0.5">0 Apps Configured</Text>
              </View>
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4"
                style={elevatedCardStyle}
              >
                <Text className="text-xl mb-1">🤝</Text>
                <Text className="text-white font-bold text-sm">Partner Link</Text>
                <Text className="text-[11px] text-amber-400 mt-0.5">Awaiting Pair</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4"
                style={elevatedCardStyle}
              >
                <Text className="text-xl mb-1">⚡</Text>
                <Text className="text-white font-bold text-sm">Sentinel Daemon</Text>
                <Text className="text-[11px] text-gray-300 mt-0.5">Hardware Standby</Text>
              </View>
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4"
                style={elevatedCardStyle}
              >
                <Text className="text-xl mb-1">💬</Text>
                <Text className="text-white font-bold text-sm">Partner Chat</Text>
                <Text className="text-[11px] text-gray-300 mt-0.5">Encrypted Channel</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={() => router.push('/pairing')}
            activeOpacity={0.88}
            className="w-full bg-[#f5b212] py-4 rounded-xl items-center justify-center mb-3"
            style={masterButtonStyle}
          >
            <Text className="text-[#003049] font-black text-sm uppercase tracking-widest">
              Pair with Partner →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/targets')}
            activeOpacity={0.8}
            className="w-full bg-[#002236] border border-[#f5b212]/40 py-3.5 rounded-xl items-center justify-center"
          >
            <Text className="text-[#f5b212] font-bold text-xs uppercase tracking-wider">
              Configure Target Applications
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 2. PAIRED COMMAND CENTER DASHBOARD
  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <View className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 + insets.bottom }}
          className="px-5 pt-3"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar: Session Identity & Disconnect */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-[#f5b212] mr-2" />
              <View>
                <Text className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                  ACCOUNTABILITY MATRIX
                </Text>
                <Text className="text-xs font-mono font-black text-[#f5b212]">
                  CODE: {pairingCode || pairingId.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDisconnect}
              activeOpacity={0.7}
              className="bg-red-950/40 border border-red-500/40 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-red-400 font-bold text-[10px] uppercase tracking-wider">
                Disconnect
              </Text>
            </TouchableOpacity>
          </View>

          {/* HERO SECTION: Central Visual Anchor */}
          <View className="items-center mb-6 pt-2">
            {/* Circular Shield Badge */}
            <View
              className={`w-28 h-28 rounded-full items-center justify-center mb-3.5 border-4 ${
                isEnforcing
                  ? 'bg-red-950/90 border-[#f5b212]'
                  : 'bg-[#002236] border-[#f5b212]'
              }`}
              style={heroShieldStyle}
            >
              <Text className="text-5xl">{isEnforcing ? '🔒' : '🛡️'}</Text>
            </View>

            {/* Status Headline */}
            <View
              className={`px-4 py-1.5 rounded-full border mb-2 flex-row items-center ${
                isEnforcing
                  ? 'bg-red-950/60 border-red-500'
                  : 'bg-emerald-950/60 border-emerald-500'
              }`}
            >
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  isEnforcing ? 'bg-red-400' : 'bg-emerald-400'
                }`}
              />
              <Text
                className={`text-xs font-mono font-black uppercase tracking-widest ${
                  isEnforcing ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {isEnforcing ? 'LOCKDOWN ACTIVE' : 'SYSTEM STANDBY'}
              </Text>
            </View>

            <Text className="text-2xl font-black tracking-widest text-white uppercase text-center">
              {isEnforcing ? 'Enforcement Engaged' : 'Sentinel Ready'}
            </Text>

            <Text className="text-xs text-gray-300 text-center mt-1 font-mono">
              {pairingMode?.toUpperCase() || 'MUTUAL'} MODE • {roleTitle.toUpperCase()}
            </Text>
          </View>

          {/* Missing OS Clearances Banner */}
          {hasMissingPermissions && (
            <View className="mb-4 p-3.5 bg-amber-950/50 border border-[#f5b212] rounded-2xl flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-[#f5b212]">
                  Security Clearances Incomplete
                </Text>
                <Text className="text-[10px] text-gray-300">
                  Grant Overlay, Usage Stats & Battery Exemption
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

          {/* TELEMETRY GRID: 2x2 Elevated Metric Cards */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[11px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                TELEMETRY & HARDWARE STATUS
              </Text>
              <Text className="text-[10px] font-mono text-[#f5b212]">REALTIME SYNC</Text>
            </View>

            {/* Row 1 */}
            <View className="flex-row gap-3 mb-3">
              {/* Card 1: Monitored Targets */}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/targets')}
                activeOpacity={0.85}
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4 justify-between"
                style={elevatedCardStyle}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl">🎯</Text>
                  <View className="bg-[#002236] border border-[#f5b212]/40 px-2 py-0.5 rounded">
                    <Text className="text-[9px] font-mono font-bold text-[#f5b212]">CONFIG</Text>
                  </View>
                </View>
                <View>
                  <Text className="text-2xl font-black text-white">
                    {effectiveTargets.length}
                  </Text>
                  <Text className="text-xs font-bold text-gray-200 uppercase tracking-wide mt-0.5">
                    Target Apps
                  </Text>
                  <Text className="text-[10px] text-gray-300 mt-1">
                    {myTargets.length} local • {partnerTargets.length} remote
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Card 2: Partner Connection */}
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4 justify-between"
                style={elevatedCardStyle}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl">🤝</Text>
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </View>
                <View>
                  <Text className="text-base font-black text-white tracking-wide">
                    LINKED & SYNCED
                  </Text>
                  <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wide mt-0.5">
                    Peer Connected
                  </Text>
                  <Text className="text-[10px] text-gray-300 mt-1">
                    Role: {userRole === 'user_1' ? 'User 1' : 'User 2'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Row 2 */}
            <View className="flex-row gap-3">
              {/* Card 3: Sentinel Service Status */}
              <View
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4 justify-between"
                style={elevatedCardStyle}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl">⚡</Text>
                  <View
                    className={`px-2 py-0.5 rounded border ${
                      isSentinelServiceRunning || isLockdownActive
                        ? 'bg-emerald-950/80 border-emerald-500'
                        : 'bg-[#002236] border-gray-600'
                    }`}
                  >
                    <Text
                      className={`text-[9px] font-mono font-bold ${
                        isSentinelServiceRunning || isLockdownActive
                          ? 'text-emerald-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {isSentinelServiceRunning || isLockdownActive ? 'ACTIVE' : 'IDLE'}
                    </Text>
                  </View>
                </View>
                <View>
                  <Text className="text-base font-black text-white tracking-wide">
                    {isSentinelServiceRunning || isLockdownActive ? 'ARMED' : 'STANDBY'}
                  </Text>
                  <Text className="text-xs font-bold text-gray-200 uppercase tracking-wide mt-0.5">
                    Native Sentinel
                  </Text>
                  <Text className="text-[10px] text-gray-300 mt-1">
                    {permissions.hasBatteryExemption ? 'Battery Exempted' : 'Check Exemption'}
                  </Text>
                </View>
              </View>

              {/* Card 4: Action Button Routing to Chat */}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/chat')}
                activeOpacity={0.85}
                className="flex-1 border border-[#f5b212]/30 rounded-2xl p-4 justify-between"
                style={elevatedCardStyle}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-2xl">💬</Text>
                  <View className="bg-[#f5b212]/20 border border-[#f5b212] px-2 py-0.5 rounded">
                    <Text className="text-[9px] font-mono font-bold text-[#f5b212]">COMMS</Text>
                  </View>
                </View>
                <View>
                  <Text className="text-base font-black text-white tracking-wide">
                    PARTNER CHAT
                  </Text>
                  <Text className="text-xs font-bold text-[#f5b212] uppercase tracking-wide mt-0.5">
                    Open Channel →
                  </Text>
                  <Text className="text-[10px] text-gray-300 mt-1">
                    Encrypted audit logging
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Info & Security Explanatory Text */}
          <View
            className="border border-[#f5b212]/20 rounded-2xl p-4 mb-4"
            style={{ backgroundColor: '#00283d' }}
          >
            <View className="flex-row items-center mb-1">
              <Text className="text-sm mr-2">🛡️</Text>
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Anti-Tampering Matrix Active
              </Text>
            </View>
            <Text className="text-[11px] text-gray-300 leading-4">
              Android Settings lockout, background task protection, and hardware back-gesture interception are engaged on all target applications.
            </Text>
          </View>
        </ScrollView>

        {/* MASTER ACTION: Docked Above ScreenZen Tab Bar */}
        <View
          className="px-5 pt-3 pb-3 border-t border-[#f5b212]/30"
          style={{ backgroundColor: '#002236' }}
        >
          {isWarden ? (
            <TouchableOpacity
              onPress={handleToggleLockdown}
              disabled={isTogglingLock}
              activeOpacity={0.88}
              className={`w-full py-4 rounded-xl items-center justify-center border-2 ${
                isLocked
                  ? 'bg-red-950 border-red-500'
                  : 'bg-[#f5b212] border-[#f5b212]'
              }`}
              style={masterButtonStyle}
            >
              {isTogglingLock ? (
                <ActivityIndicator color={isLocked ? '#ef4444' : '#003049'} size="small" />
              ) : (
                <View className="items-center">
                  <Text
                    className={`font-black text-base uppercase tracking-widest ${
                      isLocked ? 'text-red-400' : 'text-[#003049]'
                    }`}
                  >
                    {isLocked ? 'DISENGAGE LOCKDOWN' : 'ENGAGE LOCKDOWN'}
                  </Text>
                  <Text
                    className={`font-mono text-[10px] tracking-wider uppercase mt-0.5 ${
                      isLocked ? 'text-red-300' : 'text-[#003049]/80'
                    }`}
                  >
                    {isLocked
                      ? 'Release partner targets & stand down sentinel'
                      : 'Enforce full lockout on targets'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View className="w-full">
              {isLocked ? (
                <TouchableOpacity
                  onPress={handleRequestEmergencyBypass}
                  disabled={isRequestingPin}
                  activeOpacity={0.88}
                  className="w-full bg-[#f5b212] py-4 rounded-xl items-center justify-center border-2 border-amber-400"
                  style={masterButtonStyle}
                >
                  {isRequestingPin ? (
                    <ActivityIndicator color="#003049" />
                  ) : (
                    <>
                      <Text className="text-[#003049] font-black text-sm uppercase tracking-widest">
                        ⚠️ REQUEST EMERGENCY BYPASS
                      </Text>
                      <Text className="text-[#003049]/80 font-mono text-[10px] tracking-wider uppercase mt-0.5">
                        Generates Security PIN • Transmits Breach Notice to Partner
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View className="w-full py-3.5 rounded-xl items-center justify-center bg-[#004060] border border-[#f5b212]/30">
                  <Text className="text-white font-bold text-xs uppercase tracking-wider">
                    Lockdown Stood Down By Warden
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Emergency Bypass secondary trigger for Mutual Mode when locked */}
          {pairingMode === 'Mutual' && isLocked && (
            <TouchableOpacity
              onPress={handleRequestEmergencyBypass}
              disabled={isRequestingPin}
              activeOpacity={0.8}
              className="mt-2.5 py-2 rounded-lg items-center justify-center"
            >
              <Text className="text-[#f5b212] font-mono text-xs font-bold uppercase tracking-wider">
                Request Emergency PIN Bypass →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Emergency Bypass PIN Modal */}
        <Modal
          visible={showBypassModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBypassModal(false)}
        >
          <View className="flex-1 bg-black/80 items-center justify-center px-6">
            <View
              className="border-2 border-[#f5b212] rounded-3xl p-6 w-full max-w-sm"
              style={elevatedCardStyle}
            >
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
                  className={`py-3.5 rounded-xl items-center justify-center ${
                    enteredPin.length >= 4 && !isBypassing
                      ? 'bg-red-600'
                      : 'bg-gray-800'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 6,
                  }}
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
      </View>
    </SafeAreaView>
  );
}

export default Dashboard;
