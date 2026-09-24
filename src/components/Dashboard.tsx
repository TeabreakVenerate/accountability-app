import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const setPairingId = useAuthStore((state) => state.setPairingId);
  const selectedApps = useAuthStore((state) => state.selectedApps);
  const setIsAppsConfigured = useAuthStore((state) => state.setIsAppsConfigured);

  const handleInitiateLockdown = () => {
    Alert.alert(
      'LOCKDOWN INITIATED',
      `Target overlay engaged for ${selectedApps.length} monitored applications.`,
      [{ text: 'ACKNOWLEDGE', style: 'default' }]
    );
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Partner',
      'Are you sure you want to unpair? This will reset your active session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
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

          {/* Connection Secure Badge */}
          <View className="flex-row items-center bg-[#002236] border border-[#f5b212]/40 px-4 py-1.5 rounded-full mb-4">
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-sm" />
            <Text className="text-emerald-400 font-semibold text-xs tracking-wider uppercase">
              Connection Secure
            </Text>
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

            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-white font-bold text-sm">
                  {selectedApps.length} Target Apps Monitored
                </Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">
                  Overlay armed on app launch
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAppsConfigured(false)}
                activeOpacity={0.7}
                className="bg-[#f5b212]/15 border border-[#f5b212]/40 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-xs text-[#f5b212] font-semibold">
                  Edit Targets
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Center: Heavy INITIATE LOCKDOWN Button */}
        <View className="items-center my-auto">
          <TouchableOpacity
            onPress={handleInitiateLockdown}
            activeOpacity={0.88}
            className="w-full bg-[#f5b212] py-7 px-6 rounded-2xl items-center justify-center shadow-2xl border-2 border-[#f5b212]"
          >
            <Text className="text-[#003049] font-black text-2xl tracking-widest uppercase text-center">
              INITIATE LOCKDOWN
            </Text>
            <Text className="text-[#003049]/80 font-bold text-xs tracking-wider uppercase mt-1">
              Trigger High-Friction Remote Overlay
            </Text>
          </TouchableOpacity>
          <Text className="text-xs text-gray-400 mt-4 text-center px-4">
            Pressing this instantly forces the opaque React Native overlay view over unauthorized apps on the partner device.
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
