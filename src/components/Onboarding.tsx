import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { NativePermissions, SpecialPermissionsStatus } from '../lib/NativePermissions';

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const pairingId = useAuthStore((state) => state.pairingId);

  const [permissions, setPermissions] = useState<SpecialPermissionsStatus>({
    hasOverlay: false,
    hasUsage: false,
    hasBatteryExemption: false,
  });

  // Check OS Clearances status
  const checkClearances = useCallback(async () => {
    try {
      const status = await NativePermissions.checkSpecialPermissions();
      setPermissions(status);
    } catch (err) {
      console.warn('[Onboarding] Error checking permissions:', err);
    }
  }, []);

  useEffect(() => {
    checkClearances();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        checkClearances();
      }
    });
    return () => subscription.remove();
  }, [checkClearances]);

  const handleFinishOnboarding = () => {
    completeOnboarding();
    if (pairingId) {
      router.replace('/dashboard');
    } else {
      router.replace('/pairing');
    }
  };

  const allClearancesGranted =
    permissions.hasOverlay && permissions.hasUsage && permissions.hasBatteryExemption;

  return (
    <SafeAreaView className="flex-1 bg-[#003049]">
      <View className="flex-1 px-6 py-4 justify-between">
        {/* Top Bar: Progress Indicator & Step Count */}
        <View className="pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-[#f5b212] mr-2" />
              <Text className="text-[11px] font-mono tracking-widest text-[#f5b212] uppercase font-bold">
                PROTOCOL ONBOARDING
              </Text>
            </View>
            <Text className="text-xs font-mono font-bold text-gray-400">
              0{currentStep} // 03
            </Text>
          </View>

          {/* Progress Segment Bars */}
          <View className="flex-row gap-2">
            {[1, 2, 3].map((step) => (
              <View
                key={step}
                className={`h-1.5 flex-1 rounded-full ${
                  step <= currentStep ? 'bg-[#f5b212]' : 'bg-[#002236]'
                }`}
              />
            ))}
          </View>
        </View>

        {/* Scrollable Step Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        >
          {/* ================= STEP 1: THE PHILOSOPHY ================= */}
          {currentStep === 1 && (
            <View className="flex-1 justify-center py-4">
              <View className="items-center mb-6">
                <View
                  className="w-20 h-20 rounded-3xl bg-[#002236] border-2 border-[#f5b212] items-center justify-center mb-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text className="text-4xl">⚖️</Text>
                </View>
                <Text className="text-[10px] font-mono font-bold text-[#f5b212] tracking-widest uppercase mb-1">
                  DOCTRINE // PHASE 01
                </Text>
                <Text className="text-2xl font-black tracking-wider text-white text-center uppercase">
                  The Philosophy
                </Text>
                <Text className="text-xs text-gray-300 mt-2 text-center max-w-[310px] leading-5">
                  Willpower is an illusion under algorithmic siege. True digital sovereignty requires high-friction bilateral accountability.
                </Text>
              </View>

              {/* Tenet Cards */}
              <View className="gap-3.5">
                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center mb-1.5">
                    <Text className="text-base mr-2.5">🛡️</Text>
                    <Text className="text-sm font-black text-white uppercase tracking-wide">
                      Bilateral Contract
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    You do not self-regulate. You bind your app restrictions to a verified partner who holds enforcement authority.
                  </Text>
                </View>

                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center mb-1.5">
                    <Text className="text-base mr-2.5">⏳</Text>
                    <Text className="text-sm font-black text-white uppercase tracking-wide">
                      Extreme Friction
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    Impulse lives in micro-delays. We introduce deliberate, hardware-backed barriers to shatter compulsive reflex loops.
                  </Text>
                </View>

                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center mb-1.5">
                    <Text className="text-base mr-2.5">🚨</Text>
                    <Text className="text-sm font-black text-white uppercase tracking-wide">
                      Auditable Overrides
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    No quiet exits. Any emergency bypass broadcasts an instant audit dispatch directly to your partner's command screen.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ================= STEP 2: THE MECHANISM ================= */}
          {currentStep === 2 && (
            <View className="flex-1 justify-center py-4">
              <View className="items-center mb-6">
                <View
                  className="w-20 h-20 rounded-3xl bg-[#002236] border-2 border-[#f5b212] items-center justify-center mb-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text className="text-4xl">⚙️</Text>
                </View>
                <Text className="text-[10px] font-mono font-bold text-[#f5b212] tracking-widest uppercase mb-1">
                  ARCHITECTURE // PHASE 02
                </Text>
                <Text className="text-2xl font-black tracking-wider text-white text-center uppercase">
                  The Mechanism
                </Text>
                <Text className="text-xs text-gray-300 mt-2 text-center max-w-[310px] leading-5">
                  Unlike soft app blockers that collapse on restart, our Sentinel engine operates at the native Android OS kernel layer.
                </Text>
              </View>

              {/* Mechanism Cards */}
              <View className="gap-3.5">
                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <Text className="text-base mr-2.5">🛡️</Text>
                      <Text className="text-sm font-black text-white uppercase tracking-wide">
                        Native Sentinel Daemon
                      </Text>
                    </View>
                    <View className="bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-mono font-bold text-emerald-400">OS LEVEL</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    An un-killable Android Foreground Service monitors the active window 5 times per second using UsageStatsManager.
                  </Text>
                </View>

                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <Text className="text-base mr-2.5">🔒</Text>
                      <Text className="text-sm font-black text-white uppercase tracking-wide">
                        WindowManager Lockout
                      </Text>
                    </View>
                    <View className="bg-[#002236] border border-[#f5b212]/40 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-mono font-bold text-[#f5b212]">OVERLAY</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    Injects a hardware-intercepting system overlay directly onto target apps, black-holing back gestures and home keys.
                  </Text>
                </View>

                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <Text className="text-base mr-2.5">🧱</Text>
                      <Text className="text-sm font-black text-white uppercase tracking-wide">
                        Anti-Tampering Matrix
                      </Text>
                    </View>
                    <View className="bg-red-950/80 border border-red-500/50 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-mono font-bold text-red-400">HARDENED</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 leading-4 pl-7">
                    Hardcoded lockouts on Android Settings and installers block force-stopping. Persistent state survives full device reboots.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ================= STEP 3: SECURITY CLEARANCES ================= */}
          {currentStep === 3 && (
            <View className="flex-1 justify-center py-4">
              <View className="items-center mb-6">
                <View
                  className="w-20 h-20 rounded-3xl bg-[#002236] border-2 border-[#f5b212] items-center justify-center mb-4"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text className="text-4xl">🔐</Text>
                </View>
                <Text className="text-[10px] font-mono font-bold text-[#f5b212] tracking-widest uppercase mb-1">
                  HARDWARE ACCESS // PHASE 03
                </Text>
                <Text className="text-2xl font-black tracking-wider text-white text-center uppercase">
                  Security Clearances
                </Text>
                <Text className="text-xs text-gray-300 mt-2 text-center max-w-[310px] leading-5">
                  Grant Android OS access rights. These permissions empower the Sentinel service to monitor launches and draw shields.
                </Text>
              </View>

              {/* Clearance Items */}
              <View className="gap-3.5">
                {/* 1. System Alert Window */}
                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4.5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <Text className="text-lg mr-2.5">🪟</Text>
                      <View>
                        <Text className="text-sm font-black text-white uppercase tracking-wide">
                          Draw Over Other Apps
                        </Text>
                        <Text className="text-[10px] font-mono text-gray-400">
                          SYSTEM_ALERT_WINDOW
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`px-2.5 py-1 rounded-full border ${
                        permissions.hasOverlay
                          ? 'bg-emerald-950/60 border-emerald-500'
                          : 'bg-amber-950/60 border-[#f5b212]'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-mono font-bold tracking-wider uppercase ${
                          permissions.hasOverlay ? 'text-emerald-400' : 'text-[#f5b212]'
                        }`}
                      >
                        {permissions.hasOverlay ? '✓ GRANTED' : 'REQUIRED'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 mb-3 leading-4">
                    Required to project the un-dismissible full-screen lock overlay when a target application is launched.
                  </Text>
                  {!permissions.hasOverlay && (
                    <TouchableOpacity
                      onPress={() => NativePermissions.requestOverlayPermission()}
                      activeOpacity={0.8}
                      className="bg-[#f5b212] py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-[#003049] font-black text-xs uppercase tracking-wider">
                        Grant Overlay Clearance
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Usage Stats Access */}
                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4.5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <Text className="text-lg mr-2.5">📊</Text>
                      <View>
                        <Text className="text-sm font-black text-white uppercase tracking-wide">
                          Usage Stats Access
                        </Text>
                        <Text className="text-[10px] font-mono text-gray-400">
                          PACKAGE_USAGE_STATS
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`px-2.5 py-1 rounded-full border ${
                        permissions.hasUsage
                          ? 'bg-emerald-950/60 border-emerald-500'
                          : 'bg-amber-950/60 border-[#f5b212]'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-mono font-bold tracking-wider uppercase ${
                          permissions.hasUsage ? 'text-emerald-400' : 'text-[#f5b212]'
                        }`}
                      >
                        {permissions.hasUsage ? '✓ GRANTED' : 'REQUIRED'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 mb-3 leading-4">
                    Enables the Sentinel daemon to inspect foreground application packages in real-time to identify target launch events.
                  </Text>
                  {!permissions.hasUsage && (
                    <TouchableOpacity
                      onPress={() => NativePermissions.requestUsagePermission()}
                      activeOpacity={0.8}
                      className="bg-[#f5b212] py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-[#003049] font-black text-xs uppercase tracking-wider">
                        Grant Usage Clearance
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3. Battery Optimization Bypass */}
                <View
                  className="bg-[#004060] border border-[#f5b212]/30 rounded-2xl p-4.5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <Text className="text-lg mr-2.5">🔋</Text>
                      <View>
                        <Text className="text-sm font-black text-white uppercase tracking-wide">
                          Battery Exemption
                        </Text>
                        <Text className="text-[10px] font-mono text-gray-400">
                          IGNORE_BATTERY_OPTIMIZATIONS
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`px-2.5 py-1 rounded-full border ${
                        permissions.hasBatteryExemption
                          ? 'bg-emerald-950/60 border-emerald-500'
                          : 'bg-amber-950/60 border-[#f5b212]'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-mono font-bold tracking-wider uppercase ${
                          permissions.hasBatteryExemption ? 'text-emerald-400' : 'text-[#f5b212]'
                        }`}
                      >
                        {permissions.hasBatteryExemption ? '✓ EXEMPTED' : 'REQUIRED'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-gray-300 mb-3 leading-4">
                    Exempts the Sentinel daemon from Android sleep killer algorithms so accountability persists 24/7.
                  </Text>
                  {!permissions.hasBatteryExemption && (
                    <TouchableOpacity
                      onPress={() => NativePermissions.requestBatteryExemption()}
                      activeOpacity={0.8}
                      className="bg-[#f5b212] py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-[#003049] font-black text-xs uppercase tracking-wider">
                        Grant Battery Exemption
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Navigation Buttons */}
        <View className="pt-3 border-t border-[#f5b212]/20">
          <View className="flex-row items-center gap-3">
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                activeOpacity={0.8}
                className="bg-[#002236] border border-gray-700 px-5 py-4 rounded-xl items-center justify-center"
              >
                <Text className="text-white font-bold text-sm uppercase tracking-wider">
                  Back
                </Text>
              </TouchableOpacity>
            )}

            {currentStep < 3 ? (
              <TouchableOpacity
                onPress={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3)}
                activeOpacity={0.88}
                className="flex-1 bg-[#f5b212] py-4 rounded-xl items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <Text className="text-[#003049] font-black text-sm uppercase tracking-widest">
                  Continue →
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleFinishOnboarding}
                activeOpacity={0.88}
                className="flex-1 bg-[#f5b212] py-4 rounded-xl items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <Text className="text-[#003049] font-black text-sm uppercase tracking-widest">
                  {allClearancesGranted ? 'INITIALIZE PROTOCOL →' : 'PROCEED TO PAIRING →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
export default Onboarding;
