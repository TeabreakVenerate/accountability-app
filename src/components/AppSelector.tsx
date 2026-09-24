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
import { useAuthStore, CatalogApp } from '../store/useAuthStore';
import { fetchInstalledApps, InstalledApp } from '../lib/NativeInstalledApps';
import { NativePermissions, SpecialPermissionsStatus } from '../lib/NativePermissions';

export function AppSelector() {
  const pairingId = useAuthStore((state) => state.pairingId);
  const userRole = useAuthStore((state) => state.userRole);
  const setUserRole = useAuthStore((state) => state.setUserRole);
  const myTargets = useAuthStore((state) => state.myTargets);
  const setMyTargets = useAuthStore((state) => state.setMyTargets);
  const partnerTargets = useAuthStore((state) => state.partnerTargets);
  const setPartnerTargets = useAuthStore((state) => state.setPartnerTargets);
  const partnerCatalog = useAuthStore((state) => state.partnerCatalog);
  const setPartnerCatalog = useAuthStore((state) => state.setPartnerCatalog);
  const setIsAppsConfigured = useAuthStore((state) => state.setIsAppsConfigured);

  // Tab State: 'my_device' vs 'partner_device'
  const [activeTab, setActiveTab] = useState<'my_device' | 'partner_device'>('partner_device');

  const [localApps, setLocalApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Selected targets for the current tab
  // If activeTab is 'partner_device', we are setting partnerTargets
  // If activeTab is 'my_device', we are setting myTargets
  const [selectedPartnerTargets, setSelectedPartnerTargets] = useState<string[]>(partnerTargets);
  const [selectedMyTargets, setSelectedMyTargets] = useState<string[]>(myTargets);

  // Permission State
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

  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, [checkPermissions]);

  // Determine user role and load pairing data from Supabase
  const initPairingData = useCallback(async () => {
    if (!pairingId) return;

    try {
      const { data: pairing, error } = await supabase
        .from('pairings')
        .select('*')
        .eq('id', pairingId)
        .maybeSingle();

      if (error || !pairing) return;

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      let role = userRole;
      if (!role) {
        role = currentUserId === pairing.user_1_id ? 'user_1' : 'user_2';
        setUserRole(role);
      }

      // Populate partner catalog
      const partnerCatalogData =
        role === 'user_1' ? pairing.user_2_catalog : pairing.user_1_catalog;
      if (Array.isArray(partnerCatalogData)) {
        setPartnerCatalog(partnerCatalogData);
      }

      // Populate targets
      if (role === 'user_1') {
        if (Array.isArray(pairing.user_1_targets)) {
          setMyTargets(pairing.user_1_targets);
          setSelectedMyTargets(pairing.user_1_targets);
        }
        if (Array.isArray(pairing.user_2_targets)) {
          setPartnerTargets(pairing.user_2_targets);
          setSelectedPartnerTargets(pairing.user_2_targets);
        }
      } else {
        if (Array.isArray(pairing.user_2_targets)) {
          setMyTargets(pairing.user_2_targets);
          setSelectedMyTargets(pairing.user_2_targets);
        }
        if (Array.isArray(pairing.user_1_targets)) {
          setPartnerTargets(pairing.user_1_targets);
          setSelectedPartnerTargets(pairing.user_1_targets);
        }
      }
    } catch (err) {
      console.warn('[AppSelector] Failed initializing pairing data:', err);
    }
  }, [pairingId, userRole, setUserRole, setPartnerCatalog, setMyTargets, setPartnerTargets]);

  // Upload Hook: fetch native apps, strip icon property, push to Supabase
  const loadAndUploadLocalApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const apps = await fetchInstalledApps();
      setLocalApps(apps);

      if (pairingId) {
        // Strip out icon property to prevent Supabase payload-size crashes
        const strippedCatalog: CatalogApp[] = apps.map(({ appName, packageName }) => ({
          appName,
          packageName,
        }));

        const { data: pairing } = await supabase
          .from('pairings')
          .select('user_1_id')
          .eq('id', pairingId)
          .maybeSingle();

        const { data: userData } = await supabase.auth.getUser();
        const role =
          userRole || (userData?.user?.id === pairing?.user_1_id ? 'user_1' : 'user_2');

        const catalogColumn = role === 'user_1' ? 'user_1_catalog' : 'user_2_catalog';

        console.log(`[AppSelector] Uploading stripped catalog (${strippedCatalog.length} apps) to ${catalogColumn}...`);
        await supabase
          .from('pairings')
          .update({ [catalogColumn]: strippedCatalog })
          .eq('id', pairingId);
      }
    } catch (err) {
      console.warn('[AppSelector] Failed loading or uploading local apps:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pairingId, userRole]);

  // Initial load and Realtime listener on partner catalog & targets
  useEffect(() => {
    initPairingData();
    loadAndUploadLocalApps();

    if (!pairingId) return;

    // Realtime subscription for partner's updates
    const channel = supabase
      .channel(`catalog-sync:${pairingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pairings',
          filter: `id=eq.${pairingId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;

          const role = userRole || 'user_1';
          const partnerCatalogData =
            role === 'user_1' ? row.user_2_catalog : row.user_1_catalog;

          if (Array.isArray(partnerCatalogData)) {
            setPartnerCatalog(partnerCatalogData);
          }

          // Update targets if partner edited them
          if (role === 'user_1') {
            if (Array.isArray(row.user_1_targets)) {
              setMyTargets(row.user_1_targets);
              setSelectedMyTargets(row.user_1_targets);
            }
            if (Array.isArray(row.user_2_targets)) {
              setPartnerTargets(row.user_2_targets);
              setSelectedPartnerTargets(row.user_2_targets);
            }
          } else {
            if (Array.isArray(row.user_2_targets)) {
              setMyTargets(row.user_2_targets);
              setSelectedMyTargets(row.user_2_targets);
            }
            if (Array.isArray(row.user_1_targets)) {
              setPartnerTargets(row.user_1_targets);
              setSelectedPartnerTargets(row.user_1_targets);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairingId, initPairingData, loadAndUploadLocalApps, userRole, setPartnerCatalog, setMyTargets, setPartnerTargets]);

  // App list depending on active tab
  const displayedApps = useMemo(() => {
    if (activeTab === 'partner_device') {
      return partnerCatalog;
    }
    return localApps;
  }, [activeTab, partnerCatalog, localApps]);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return displayedApps;
    const q = searchQuery.toLowerCase();
    return displayedApps.filter(
      (app) =>
        app.appName.toLowerCase().includes(q) ||
        app.packageName.toLowerCase().includes(q)
    );
  }, [displayedApps, searchQuery]);

  const currentSelection = activeTab === 'partner_device' ? selectedPartnerTargets : selectedMyTargets;

  const toggleApp = (packageName: string) => {
    if (activeTab === 'partner_device') {
      setSelectedPartnerTargets((prev) =>
        prev.includes(packageName) ? prev.filter((p) => p !== packageName) : [...prev, packageName]
      );
    } else {
      setSelectedMyTargets((prev) =>
        prev.includes(packageName) ? prev.filter((p) => p !== packageName) : [...prev, packageName]
      );
    }
  };

  const handleSelectAll = () => {
    const allFiltered = filteredApps.map((a) => a.packageName);
    if (activeTab === 'partner_device') {
      if (selectedPartnerTargets.length === allFiltered.length && allFiltered.length > 0) {
        setSelectedPartnerTargets([]);
      } else {
        setSelectedPartnerTargets(allFiltered);
      }
    } else {
      if (selectedMyTargets.length === allFiltered.length && allFiltered.length > 0) {
        setSelectedMyTargets([]);
      } else {
        setSelectedMyTargets(allFiltered);
      }
    }
  };

  // Target Routing: Save selections to partner's or own target column in Supabase
  const handleConfirmTargets = async () => {
    setIsSaving(true);
    try {
      if (pairingId) {
        const role = userRole || 'user_1';

        // If user 1 is selecting partner's apps -> user_2_targets
        // If user 2 is selecting partner's apps -> user_1_targets
        const partnerTargetColumn = role === 'user_1' ? 'user_2_targets' : 'user_1_targets';
        const myTargetColumn = role === 'user_1' ? 'user_1_targets' : 'user_2_targets';

        const updatePayload: Record<string, string[]> = {
          [partnerTargetColumn]: selectedPartnerTargets,
          [myTargetColumn]: selectedMyTargets,
        };

        const { error } = await supabase
          .from('pairings')
          .update(updatePayload)
          .eq('id', pairingId);

        if (error) {
          Alert.alert('Database Sync Error', error.message);
          return;
        }

        // Update Zustand store
        setPartnerTargets(selectedPartnerTargets);
        setMyTargets(selectedMyTargets);
      }

      setIsAppsConfigured(true);
      Alert.alert(
        'Targets Synced',
        activeTab === 'partner_device'
          ? `Successfully saved ${selectedPartnerTargets.length} restrictions for your partner's device.`
          : `Saved ${selectedMyTargets.length} restrictions for your device.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save targets.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasMissingPermissions = !permissions.hasOverlay || !permissions.hasUsage;

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <View className="flex-1 px-6 pt-5 pb-4">
        {/* Header Flow Info */}
        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-[#002236] border border-[#f5b212]/30 px-3 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-[#f5b212] uppercase tracking-wider">
                Step 2 of 2 • Boundary Setup
              </Text>
            </View>
            <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
              <Text className="text-xs text-[#f5b212] font-semibold underline">
                {currentSelection.length === filteredApps.length && filteredApps.length > 0
                  ? 'Deselect All'
                  : 'Select All Visible'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-2xl font-black text-white tracking-wide uppercase">
            Target App Catalog
          </Text>
          <Text className="text-xs text-gray-300 mt-1 leading-4">
            {activeTab === 'partner_device'
              ? "Select which apps will be locked on your partner's device when accountability engages."
              : "Review and configure target apps installed on your local device."}
          </Text>

          {/* Device Tabs */}
          <View className="flex-row mt-4 p-1 bg-[#001724] border border-gray-800 rounded-xl">
            <TouchableOpacity
              onPress={() => setActiveTab('partner_device')}
              activeOpacity={0.8}
              className={`flex-1 py-2.5 rounded-lg items-center justify-center ${
                activeTab === 'partner_device' ? 'bg-[#f5b212]' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-xs font-black uppercase tracking-wider ${
                  activeTab === 'partner_device' ? 'text-[#003049]' : 'text-gray-400'
                }`}
              >
                Partner's Device
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('my_device')}
              activeOpacity={0.8}
              className={`flex-1 py-2.5 rounded-lg items-center justify-center ${
                activeTab === 'my_device' ? 'bg-[#f5b212]' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-xs font-black uppercase tracking-wider ${
                  activeTab === 'my_device' ? 'text-[#003049]' : 'text-gray-400'
                }`}
              >
                My Device
              </Text>
            </TouchableOpacity>
          </View>

          {/* Missing Permissions Banner */}
          {hasMissingPermissions && (
            <View className="mt-3 p-3 bg-amber-950/40 border border-[#f5b212] rounded-xl flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-[#f5b212]">OS Clearances Required</Text>
                <Text className="text-[10px] text-gray-300">Overlay & Usage Access needed</Text>
              </View>
              <TouchableOpacity
                onPress={() => NativePermissions.requestSpecialPermissions()}
                className="bg-[#f5b212] px-3 py-1.5 rounded-lg"
              >
                <Text className="text-[#003049] font-bold text-[11px] uppercase">Grant</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search Filter */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === 'partner_device'
                ? "Search partner's installed apps..."
                : 'Search your installed apps...'
            }
            placeholderTextColor="#64748b"
            clearButtonMode="while-editing"
            className="bg-[#001724] border border-gray-700 focus:border-[#f5b212] text-white px-4 py-2.5 rounded-xl text-sm mt-3 font-medium"
          />
        </View>

        {/* Apps List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f5b212" />
            <Text className="text-xs text-gray-400 mt-3 font-medium">
              Synchronizing app catalogs with Supabase...
            </Text>
          </View>
        ) : filteredApps.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base font-bold text-gray-300 text-center">
              {activeTab === 'partner_device'
                ? "No Partner Apps Received Yet"
                : 'No Applications Detected'}
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1.5 max-w-[280px]">
              {activeTab === 'partner_device'
                ? "Ask your accountability partner to open the app on their device. Their catalog will upload and sync automatically via Supabase Realtime."
                : 'Ensure third-party applications are installed on this device.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            showsVerticalScrollIndicator={false}
            className="flex-1 mb-2"
            initialNumToRender={14}
            maxToRenderPerBatch={14}
            renderItem={({ item }) => {
              const isSelected = currentSelection.includes(item.packageName);
              const isLocalApp = 'icon' in item && Boolean((item as InstalledApp).icon);

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
                    {/* Icon: Base64 for local app, default placeholder badge for remote partner app */}
                    {isLocalApp ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${(item as InstalledApp).icon}` }}
                        className="w-10 h-10 rounded-xl mr-3"
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        className={`w-10 h-10 rounded-xl items-center justify-center mr-3 border ${
                          isSelected
                            ? 'bg-[#f5b212] border-[#f5b212]'
                            : 'bg-[#002236] border-gray-700'
                        }`}
                      >
                        <Text
                          className={`text-base font-black ${
                            isSelected ? 'text-[#003049]' : 'text-gray-300'
                          }`}
                        >
                          {item.appName ? item.appName.charAt(0).toUpperCase() : '📱'}
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

                  {/* Toggle Checkbox */}
                  <View
                    className={`w-6 h-6 rounded-lg items-center justify-center border ${
                      isSelected
                        ? 'bg-[#f5b212] border-[#f5b212]'
                        : 'border-gray-600 bg-[#001724]'
                    }`}
                  >
                    {isSelected && <Text className="text-[#003049] font-black text-xs">✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Footer Summary & Action */}
        <View className="pt-2 border-t border-gray-800">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs text-gray-400">
              {activeTab === 'partner_device' ? 'Partner Restrictions:' : 'My Restrictions:'}
            </Text>
            <Text className="text-xs font-bold text-[#f5b212]">
              {currentSelection.length} Apps Selected
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
                {activeTab === 'partner_device'
                  ? 'Confirm Partner Restrictions'
                  : 'Confirm Local Restrictions'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
