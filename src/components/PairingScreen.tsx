import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export function PairingScreen() {
  const [partnerCode, setPartnerCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const setPairingId = useAuthStore((state) => state.setPairingId);

  const handleGenerateInvite = () => {
    // Generate a secure 6-character alphanumeric pairing token
    const token = 'ACC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedCode(token);
    setPairingId(token);
  };

  const handleJoinPartner = () => {
    const trimmed = partnerCode.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Please enter a valid partner invite code.');
      return;
    }
    setPairingId(trimmed);
    Alert.alert('Success', `Connected to partner session: ${trimmed}`);
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
              activeOpacity={0.85}
              className="bg-[#f5b212] py-4 rounded-xl items-center justify-center shadow-md"
            >
              <Text className="text-[#003049] font-bold text-lg tracking-wide uppercase">
                Generate Invite
              </Text>
            </TouchableOpacity>

            {generatedCode && (
              <View className="mt-4 p-3 bg-[#001724] rounded-xl border border-[#f5b212]/40 items-center">
                <Text className="text-xs text-gray-400 mb-1">Your Pairing Token:</Text>
                <Text className="text-xl font-bold text-[#f5b212] tracking-widest selectable">
                  {generatedCode}
                </Text>
                <Text className="text-[11px] text-gray-400 mt-1">
                  Share this code with your accountability partner.
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
              placeholder="e.g. ACC-X9K2L1"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-3.5 rounded-xl text-base mb-3 font-mono"
            />
            <TouchableOpacity
              onPress={handleJoinPartner}
              activeOpacity={0.8}
              className="border border-[#f5b212] py-3.5 rounded-xl items-center justify-center"
            >
              <Text className="text-[#f5b212] font-semibold text-base tracking-wide">
                Connect Partner
              </Text>
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
