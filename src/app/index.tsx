import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function DashboardScreen() {
  const session = useAuthStore((state) => state.session);
  const pairingId = useAuthStore((state) => state.pairingId);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View className="flex-1 bg-[#003049] px-6 justify-center items-center">
      <View className="items-center mb-8">
        <Text className="text-2xl font-bold text-[#f5b212] tracking-wider uppercase">
          Accountability Active
        </Text>
        <Text className="text-sm text-gray-300 mt-2 text-center">
          Monitoring service active for user:
        </Text>
        <Text className="text-xs text-white font-mono mt-1">
          {session?.user?.email || session?.user?.id || 'Connected User'}
        </Text>
      </View>

      <View className="bg-[#002236] border border-[#f5b212]/20 rounded-2xl p-5 w-full mb-8">
        <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
          Pairing Session Status
        </Text>
        <Text className="text-white text-base font-medium mt-1">
          {pairingId ? `Active Session: ${pairingId}` : 'Paired with Partner'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleSignOut}
        activeOpacity={0.8}
        className="border border-[#f5b212] px-6 py-3 rounded-xl"
      >
        <Text className="text-[#f5b212] font-semibold text-sm uppercase tracking-wider">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
