import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore, PairingMode } from '../store/useAuthStore';

// Helper: Generate a random 6-character alphanumeric pairing code
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface PairingScreenProps {
  onBack?: () => void;
}

interface RoleOption {
  mode: PairingMode;
  title: string;
  badge: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    mode: 'Mutual',
    title: 'Mutual Accountability',
    badge: 'PEER TO PEER',
    description: 'Both partners monitor and enforce locks on each other mutually.',
  },
  {
    mode: 'Warden',
    title: 'Warden Mode',
    badge: 'ENFORCER',
    description: 'You hold the master lock key. You control your partner’s lockdown state.',
  },
  {
    mode: 'Prisoner',
    title: 'Prisoner Mode',
    badge: 'DISCIPLINED',
    description: 'You submit to your partner’s lock. Only partner or emergency PIN can release you.',
  },
];

export function PairingScreen({ onBack }: PairingScreenProps) {
  const [partnerCode, setPartnerCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [activePairingRowId, setActivePairingRowId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<PairingMode>('Mutual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const setPairingId = useAuthStore((state) => state.setPairingId);
  const setPairingCode = useAuthStore((state) => state.setPairingCode);
  const setPairingMode = useAuthStore((state) => state.setPairingMode);
  const setUserRole = useAuthStore((state) => state.setUserRole);

  // Lifecycle Management: Channel subscription tied to activePairingRowId
  useEffect(() => {
    if (!activePairingRowId) return;

    console.log(`[Realtime] Initializing channel for pairing id: ${activePairingRowId}`);

    const channel = supabase
      .channel(`pairing:${activePairingRowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairings',
          filter: `id=eq.${activePairingRowId}`,
        },
        (payload) => {
          console.log('[Realtime] Pairing payload received:', payload);
          const row = payload.new as any;

          if (row && row.status === 'active') {
            console.log("[Realtime] Status transitioned to 'active'! Advancing to Command Center...");
            if (row.pairing_mode) {
              setPairingMode(row.pairing_mode as PairingMode);
            }
            setPairingId(activePairingRowId);
          }
        }
      )
      .subscribe((status, err) => {
        switch (status) {
          case 'SUBSCRIBED':
            console.log(`[Realtime] Status: SUBSCRIBED to pairing:${activePairingRowId}`);
            break;
          case 'CHANNEL_ERROR':
            console.warn(`[Realtime] Status: CHANNEL_ERROR for pairing:${activePairingRowId}:`, err?.message || err);
            break;
          case 'TIMED_OUT':
            console.warn(`[Realtime] Status: TIMED_OUT for pairing:${activePairingRowId}`);
            break;
          case 'CLOSED':
            console.log(`[Realtime] Status: CLOSED for pairing:${activePairingRowId}`);
            break;
          default:
            console.log(`[Realtime] Status: ${status}`);
        }
      });

    // Teardown
    return () => {
      console.log(`[Realtime] Teardown: cleanly removing channel pairing:${activePairingRowId}`);
      supabase.removeChannel(channel);
    };
  }, [activePairingRowId, setPairingId, setPairingMode]);

  // Step 1: Wire "Generate Invite" with Role Selection
  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      const code = generatePairingCode();
      const { data: userData } = await supabase.auth.getUser();

      // Insert new row with status 'pending' and chosen pairing_mode
      const { data, error } = await supabase
        .from('pairings')
        .insert([
          {
            pairing_code: code,
            status: 'pending',
            pairing_mode: selectedMode,
            user_1_id: userData?.user?.id ?? null,
          },
        ])
        .select()
        .single();

      if (error) {
        Alert.alert('Database Error', error.message);
        return;
      }

      setGeneratedCode(code);
      setPairingCode(code);
      setPairingMode(selectedMode);
      setUserRole('user_1');
      setActivePairingRowId(data.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate invite code.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: Wire "Connect Partner"
  const handleJoinPartner = async () => {
    const trimmed = partnerCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character partner invite code.');
      return;
    }

    setIsJoining(true);
    try {
      const { data, error } = await supabase
        .from('pairings')
        .select('*')
        .eq('pairing_code', trimmed)
        .maybeSingle();

      if (error) {
        Alert.alert('Query Error', error.message);
        return;
      }

      if (!data) {
        Alert.alert('Code Not Found', 'The entered code does not exist. Please check and try again.');
        return;
      }

      if (data.status !== 'pending') {
        Alert.alert('Unavailable', 'This pairing invite has already been claimed or expired.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('pairings')
        .update({
          status: 'active',
          user_2_id: userData?.user?.id ?? null,
        })
        .eq('id', data.id);

      if (updateError) {
        Alert.alert('Update Error', updateError.message);
        return;
      }

      // Update Zustand store with role, pairing_mode, and pairingId
      const serverMode = (data.pairing_mode as PairingMode) || 'Mutual';
      setUserRole('user_2');
      setPairingCode(trimmed);
      setPairingMode(serverMode);
      setPairingId(data.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to connect with partner.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          className="px-6 py-6"
          showsVerticalScrollIndicator={false}
        >
          {/* Header & Back Navigation */}
          <View className="flex-row items-center justify-between mb-4">
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                activeOpacity={0.7}
                className="bg-[#002236] border border-[#f5b212]/40 px-3 py-1.5 rounded-lg flex-row items-center"
              >
                <Text className="text-xs font-bold text-[#f5b212]">← Command Center</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <View className="bg-[#002236] border border-[#f5b212]/30 px-3 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-[#f5b212] uppercase tracking-widest">
                Accountability Link
              </Text>
            </View>
          </View>

          {/* Title Branding */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-black tracking-widest text-[#f5b212] uppercase text-center">
              Device Pairing
            </Text>
            <Text className="text-xs text-gray-300 mt-2 text-center max-w-[300px] leading-4">
              Select your accountability role and establish an encrypted peer link with your partner.
            </Text>
          </View>

          {/* Role Selection Section */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2.5">
              Choose Accountability Mode
            </Text>
            <View className="gap-2.5">
              {ROLE_OPTIONS.map((item) => {
                const isSelected = selectedMode === item.mode;
                return (
                  <TouchableOpacity
                    key={item.mode}
                    onPress={() => setSelectedMode(item.mode)}
                    activeOpacity={0.8}
                    className={`p-4 rounded-2xl border ${
                      isSelected
                        ? 'bg-[#002236] border-[#f5b212] shadow-lg'
                        : 'bg-[#001724]/80 border-gray-800'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`text-sm font-black tracking-wide ${
                          isSelected ? 'text-[#f5b212]' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-md border ${
                          isSelected
                            ? 'bg-[#f5b212]/20 border-[#f5b212]'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <Text
                          className={`text-[9px] font-bold tracking-wider uppercase ${
                            isSelected ? 'text-[#f5b212]' : 'text-gray-400'
                          }`}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-gray-400 leading-4">
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Step 1: Create Invite Card */}
          <View className="bg-[#002236] border border-[#f5b212]/25 rounded-2xl p-5 mb-5 shadow-xl">
            <View className="flex-row items-center mb-1">
              <View className="w-5 h-5 rounded-full bg-[#f5b212] items-center justify-center mr-2">
                <Text className="text-[#003049] font-black text-xs">1</Text>
              </View>
              <Text className="text-white font-bold text-sm tracking-wide">
                Step 1: Generate your secure Link
              </Text>
            </View>
            <Text className="text-[11px] text-gray-400 mb-4 pl-7">
              Creates a link applying your chosen ({selectedMode}) mode.
            </Text>

            <TouchableOpacity
              onPress={handleGenerateInvite}
              disabled={isGenerating}
              activeOpacity={0.88}
              className="bg-[#f5b212] py-3.5 rounded-xl items-center justify-center shadow-md"
            >
              {isGenerating ? (
                <ActivityIndicator color="#003049" />
              ) : (
                <Text className="text-[#003049] font-black text-sm uppercase tracking-wider">
                  Generate Accountability Link
                </Text>
              )}
            </TouchableOpacity>

            {generatedCode && (
              <View className="mt-4 p-4 bg-[#001724] rounded-xl border border-[#f5b212]/50 items-center">
                <Text className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase mb-1">
                  Your 6-Character Pairing Code
                </Text>
                <Text className="text-2xl font-black text-[#f5b212] tracking-widest font-mono">
                  {generatedCode}
                </Text>
                <View className="flex-row items-center mt-2">
                  <View className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
                  <Text className="text-[11px] text-emerald-400 font-medium">
                    Listening for partner connection...
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Step 2: Join Partner Card */}
          <View className="bg-[#002236] border border-gray-800 rounded-2xl p-5 shadow-xl mb-4">
            <View className="flex-row items-center mb-1">
              <View className="w-5 h-5 rounded-full bg-gray-600 items-center justify-center mr-2">
                <Text className="text-white font-black text-xs">2</Text>
              </View>
              <Text className="text-white font-bold text-sm tracking-wide">
                Step 2: Enter your partner's Link
              </Text>
            </View>
            <Text className="text-[11px] text-gray-400 mb-4 pl-7">
              If your partner generated a code, enter it below to complete the handshake.
            </Text>

            <TextInput
              value={partnerCode}
              onChangeText={setPartnerCode}
              placeholder="ENTER 6-DIGIT CODE"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-3 rounded-xl text-base mb-3 font-mono tracking-widest text-center font-bold"
            />

            <TouchableOpacity
              onPress={handleJoinPartner}
              disabled={isJoining}
              activeOpacity={0.82}
              className="border border-[#f5b212] bg-[#f5b212]/10 py-3.5 rounded-xl items-center justify-center"
            >
              {isJoining ? (
                <ActivityIndicator color="#f5b212" />
              ) : (
                <Text className="text-[#f5b212] font-black text-sm uppercase tracking-wider">
                  Connect to Partner
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Security Badge */}
          <View className="items-center py-4">
            <Text className="text-[11px] text-gray-500 font-medium">
              🔒 End-to-End Encrypted • Row-Level Security Enabled
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
