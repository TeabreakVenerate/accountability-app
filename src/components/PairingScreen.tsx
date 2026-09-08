import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

// Helper: Generate a random 6-character alphanumeric pairing code
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function PairingScreen() {
  const [partnerCode, setPartnerCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const setPairingId = useAuthStore((state) => state.setPairingId);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Clean up channel on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Wire "Generate Invite" with Realtime Socket listener
  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      // Unsubscribe from any previous channel before creating a new one
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const code = generatePairingCode();
      const { data: userData } = await supabase.auth.getUser();

      // 1. Insert new row with status 'pending'
      const { data, error } = await supabase
        .from('pairings')
        .insert([
          {
            pairing_code: code,
            status: 'pending',
            user_1_id: userData?.user?.id ?? null,
          },
        ])
        .select()
        .single();

      if (error) {
        Alert.alert('Database Error', error.message);
        return;
      }

      // 2. Update local UI state
      setGeneratedCode(code);

      // 3. Initialize Realtime channel listening to UPDATE events on the newly generated row
      console.log(`[Realtime] Initializing channel for pairing id: ${data.id}`);

      const channel = supabase
        .channel(`pairing:${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'pairings',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            console.log("REALTIME PAYLOAD RECEIVED:", payload);

            // 4. If status changed to 'active', update Zustand store to trigger Dashboard mount
            if (payload.new && (payload.new as any).status === 'active') {
              console.log("[Realtime] Status transitioned to 'active'! Mounting Dashboard...");
              setPairingId(data.id);
            }
          }
        )
        .subscribe((status, err) => {
          console.log("Subscription status:", status);
          if (err) {
            console.error("Subscription error:", err);
          }
        });

      channelRef.current = channel;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate invite code.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Wire "Connect Partner"
  const handleJoinPartner = async () => {
    const trimmed = partnerCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 6) {
      Alert.alert('Validation Error', 'Please enter a valid 6-character partner invite code.');
      return;
    }

    setIsJoining(true);
    try {
      // 1. Query Supabase for the entered pairing_code
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
        Alert.alert('Code Not Found', 'The entered pairing code does not exist. Please check and try again.');
        return;
      }

      // 2. Check if status is pending
      if (data.status !== 'pending') {
        Alert.alert('Unavailable', 'This pairing invite has already been used or expired.');
        return;
      }

      // 3. Update status to active and assign user_2_id
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

      // 4. Update Zustand useAuthStore with pairingId to trigger navigation
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        {/* Header Branding */}
        <View className="items-center mb-10">
          <Text className="text-3xl font-extrabold tracking-widest text-[#f5b212] uppercase">
            Accountability
          </Text>
          <Text className="text-sm text-gray-300 mt-2 font-medium tracking-wide">
            Mutual Monitoring & Remote Lockdown
          </Text>
        </View>

        {/* Action Card */}
        <View className="bg-[#002236] border border-[#f5b212]/20 rounded-2xl p-6 shadow-lg">
          {/* Section 1: Generate Invite */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-base mb-2">
              Start a New Pairing
            </Text>
            <TouchableOpacity
              onPress={handleGenerateInvite}
              disabled={isGenerating}
              activeOpacity={0.85}
              className="bg-[#f5b212] py-4 rounded-xl items-center justify-center shadow-md"
            >
              {isGenerating ? (
                <ActivityIndicator color="#003049" />
              ) : (
                <Text className="text-[#003049] font-bold text-lg tracking-wide uppercase">
                  Generate Invite
                </Text>
              )}
            </TouchableOpacity>

            {generatedCode && (
              <View className="mt-4 p-4 bg-[#001724] rounded-xl border border-[#f5b212]/40 items-center">
                <Text className="text-xs text-gray-400 mb-1">Your 6-Character Pairing Code:</Text>
                <Text className="text-2xl font-bold text-[#f5b212] tracking-widest selectable">
                  {generatedCode}
                </Text>
                <Text className="text-[11px] text-gray-400 mt-2 text-center">
                  Share this code with your partner. Realtime listener active — waiting for partner to connect...
                </Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-[1px] bg-gray-700" />
            <Text className="mx-4 text-xs font-bold text-gray-400 tracking-wider">
              OR JOIN EXISTING
            </Text>
            <View className="flex-1 h-[1px] bg-gray-700" />
          </View>

          {/* Section 2: Join Partner */}
          <View className="mt-2">
            <Text className="text-white font-semibold text-base mb-2">
              Join Partner
            </Text>
            <TextInput
              value={partnerCode}
              onChangeText={setPartnerCode}
              placeholder="e.g. 7XK9A2"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-3.5 rounded-xl text-base mb-3 font-mono tracking-widest text-center"
            />
            <TouchableOpacity
              onPress={handleJoinPartner}
              disabled={isJoining}
              activeOpacity={0.8}
              className="border border-[#f5b212] py-3.5 rounded-xl items-center justify-center bg-[#f5b212]/10"
            >
              {isJoining ? (
                <ActivityIndicator color="#f5b212" />
              ) : (
                <Text className="text-[#f5b212] font-semibold text-base tracking-wide">
                  Connect Partner
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Status */}
        <View className="mt-8 items-center">
          <Text className="text-xs text-gray-500">
            Encrypted End-to-End • Supabase Realtime Active
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
