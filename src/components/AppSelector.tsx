import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { fetchInstalledApps, InstalledApp } from '../lib/NativeInstalledApps';
import { NativePermissions, SpecialPermissionsStatus } from '../lib/NativePermissions';

export function AppSelector() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const selectedApps = useAuthStore((state) => state.selectedApps);
  const setSelectedApps = useAuthStore((state) => state.setSelectedApps);
  const setIsAppsConfigured = useAuthStore((state) => state.setIsAppsConfigured);

  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [localSelection, setLocalSelection] = useState<string[]>(selectedApps);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Security Clearance State
  const [permissions, setPermissions] = useState<SpecialPermissionsStatus>({
    hasOverlay: true,
    hasUsage: true,
  });

  const checkPermissions = useCallback(async () => {
    try {
      const status = await NativePermissions.checkSpecialPermissions();
      setPermissions(status);
    } catch (err) {
      console.warn('[AppSelector] Failed checking permissions:', err);
    }
  }, []);

  // Check permissions on mount and whenever returning from Android Settings
  useEffect(() => {
    checkPermissions();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  // Fetch live non-system installed apps on mount via guarded Android bridge
  useEffect(() => {
    let isMounted = true;

    async function loadApps() {
      setIsLoading(true);
      try {
        const apps = await fetchInstalledApps();
        if (isMounted) {
          setInstalledApps(apps);
        }
      } catch (err: any) {
        console.warn('[AppSelector] Graceful catch: could not query installed applications:', err);
        if (isMounted) {
          setInstalledApps([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadApps();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return installedApps;
    const q = searchQuery.toLowerCase();
    return installedApps.filter(
      (app) =>
        app.appName.toLowerCase().includes(q) ||
        app.packageName.toLowerCase().includes(q)
    );
  }, [installedApps, searchQuery]);

  const toggleApp = (packageName: string) => {
    setLocalSelection((prev) =>
      prev.includes(packageName)
        ? prev.filter((pkg) => pkg !== packageName)
        : [...prev, packageName]
    );
  };

  const handleSelectAll = () => {
    if (localSelection.length === filteredApps.length && filteredApps.length > 0) {
      setLocalSelection([]);
    } else {
      setLocalSelection(filteredApps.map((a) => a.packageName));
    }
  };

  const handleGrantPermissions = async () => {
    await NativePermissions.requestSpecialPermissions();
  };

  const handleConfirmTargets = async () => {
    if (localSelection.length === 0) {
      Alert.alert(
        'No Apps Selected',
        'Please select at least one application to monitor for your accountability contract.'
      );
      return;
    }

    if (!permissions.hasOverlay || !permissions.hasUsage) {
      Alert.alert(
        'Permissions Incomplete',
        'System Alert Window and Usage Access clearances are required for the accountability overlay to engage. Please grant clearances before launching.',
        [
          { text: 'Grant Now', onPress: handleGrantPermissions },
          { text: 'Continue Anyway', onPress: () => persistTargets(), style: 'destructive' },
        ]
      );
      return;
    }

    await persistTargets();
  };

  const persistTargets = async () => {
    setIsSaving(true);
    try {
      if (pairingId) {
        // Save target_apps array (package names) to Supabase pairings table
        const { error } = await supabase
          .from('pairings')
          .update({ target_apps: localSelection })
          .eq('id', pairingId);

        if (error) {
          Alert.alert('Database Sync Error', error.message);
          return;
        }
      }

      // Update Zustand state
      setSelectedApps(localSelection);
      setIsAppsConfigured(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save target apps.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasMissingPermissions = !permissions.hasOverlay || !permissions.hasUsage;

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <View className="flex-1 px-6 pt-6 pb-4">
        {/* Header Flow Info */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-[#002236] border border-[#f5b212]/30 px-3 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-[#f5b212] uppercase tracking-wider">
                Step 2 of 2 • Boundary Setup
              </Text>
            </View>
            <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
              <Text className="text-xs text-[#f5b212] font-semibold underline">
                {localSelection.length === filteredApps.length && filteredApps.length > 0
                  ? 'Deselect All'
                  : 'Select All Visible'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-2xl font-black text-white tracking-wide uppercase">
            Select Target Apps
          </Text>
          <Text className="text-xs text-gray-300 mt-1 leading-4">
            Select installed applications that will trigger the lockdown overlay when launched.
          </Text>

          {/* High-Priority Security Clearance Banner */}
          {hasMissingPermissions && (
            <View className="mt-3 p-4 bg-amber-950/40 border border-[#f5b212] rounded-2xl shadow-lg">
              <View className="flex-row items-center mb-1">
                <Text className="text-sm font-black text-[#f5b212] tracking-wider uppercase">
                  ⚠️ Security Clearance Required
                </Text>
              </View>
              <Text className="text-[11px] text-gray-300 mb-3 leading-4">
                To detect unauthorized app launches and draw the lockdown overlay, grant the required OS permissions.
              </Text>

              <View className="flex-row gap-2 mb-3">
                <View
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border flex-row items-center justify-between ${
                    permissions.hasOverlay
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-red-950/30 border-red-500/40'
                  }`}
                >
                  <Text className="text-[10px] text-white font-medium">Draw Over Apps</Text>
                  <Text
                    className={`text-[10px] font-bold ${
                      permissions.hasOverlay ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {permissions.hasOverlay ? 'GRANTED' : 'MISSING'}
                  </Text>
                </View>

                <View
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border flex-row items-center justify-between ${
                    permissions.hasUsage
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-red-950/30 border-red-500/40'
                  }`}
                >
                  <Text className="text-[10px] text-white font-medium">Usage Access</Text>
                  <Text
                    className={`text-[10px] font-bold ${
                      permissions.hasUsage ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {permissions.hasUsage ? 'GRANTED' : 'MISSING'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleGrantPermissions}
                activeOpacity={0.85}
                className="bg-[#f5b212] py-2.5 rounded-xl items-center justify-center shadow-md"
              >
                <Text className="text-[#003049] font-black text-xs uppercase tracking-wider">
                  Grant OS Security Clearances
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search Filter */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search installed apps..."
            placeholderTextColor="#64748b"
            clearButtonMode="while-editing"
            className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-2.5 rounded-xl text-sm mt-3 font-medium"
          />
        </View>

        {/* Apps List or Loader / Empty State */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f5b212" />
            <Text className="text-xs text-gray-400 mt-3 font-medium">
              Scanning installed Android applications...
            </Text>
          </View>
        ) : filteredApps.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base font-bold text-gray-300 text-center">
              No Applications Detected
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1 max-w-[260px]">
              If testing on a custom build, verify your APK includes InstalledAppsModule or install third-party apps on the emulator.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            showsVerticalScrollIndicator={false}
            className="flex-1 mb-3"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            renderItem={({ item }) => {
              const isSelected = localSelection.includes(item.packageName);
              return (
                <TouchableOpacity
                  onPress={() => toggleApp(item.packageName)}
                  activeOpacity={0.8}
                  className={`mb-2.5 p-3.5 rounded-2xl border flex-row items-center justify-between ${
                    isSelected
                      ? 'bg-[#002236] border-[#f5b212]'
                      : 'bg-[#001724]/70 border-gray-800'
                  }`}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    {/* Render Base64 Icon from PackageManager */}
                    {item.icon ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${item.icon}` }}
                        className="w-10 h-10 rounded-xl mr-3"
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                          isSelected ? 'bg-[#f5b212]' : 'bg-[#002236]'
                        }`}
                      >
                        <Text
                          className={`text-base font-black ${
                            isSelected ? 'text-[#003049]' : 'text-gray-400'
                          }`}
                        >
                          {item.appName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View className="flex-1">
                      <Text
                        className="text-sm font-bold text-white tracking-wide"
                        numberOfLines={1}
                      >
                        {item.appName}
                      </Text>
                      <Text
                        className="text-[10px] text-gray-400 font-mono mt-0.5"
                        numberOfLines={1}
                      >
                        {item.packageName}
                      </Text>
                    </View>
                  </View>

                  {/* Custom Toggle Checkbox */}
                  <View
                    className={`w-6 h-6 rounded-lg items-center justify-center border ${
                      isSelected
                        ? 'bg-[#f5b212] border-[#f5b212]'
                        : 'border-gray-600 bg-[#001724]'
                    }`}
                  >
                    {isSelected && (
                      <Text className="text-[#003049] font-black text-xs">✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Footer Summary & Action */}
        <View className="pt-2 border-t border-gray-800">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xs text-gray-400">Enforcement Targets:</Text>
            <Text className="text-xs font-bold text-[#f5b212]">
              {localSelection.length} Apps Selected
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleConfirmTargets}
            disabled={isSaving || isLoading}
            activeOpacity={0.88}
            className="w-full bg-[#f5b212] py-4 rounded-xl items-center justify-center shadow-lg"
          >
            {isSaving ? (
              <ActivityIndicator color="#003049" />
            ) : (
              <Text className="text-[#003049] font-black text-base uppercase tracking-wider">
                Confirm Targets & Launch
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
