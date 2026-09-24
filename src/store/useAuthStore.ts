import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

export interface CatalogApp {
  appName: string;
  packageName: string;
}

export type PairingMode = 'Mutual' | 'Warden' | 'Prisoner';

interface AuthState {
  session: Session | null;
  pairingId: string | null;
  pairingCode: string | null;
  pairingMode: PairingMode | null;
  userRole: 'user_1' | 'user_2' | null;
  selectedApps: string[];
  partnerCatalog: CatalogApp[];
  myTargets: string[];
  partnerTargets: string[];
  isAppsConfigured: boolean;
  isLockdownActive: boolean;
  isLocked: boolean; // Remote lock status synced with Supabase is_locked
  bypassPin: string | null;
  disconnectRequestedAt: string | null; // ISO timestamp for 1-hour rage quit cooldown
  hasHydrated: boolean;

  setSession: (session: Session | null) => void;
  setPairingId: (pairingId: string | null) => void;
  setPairingCode: (code: string | null) => void;
  setPairingMode: (mode: PairingMode | null) => void;
  setUserRole: (role: 'user_1' | 'user_2' | null) => void;
  setSelectedApps: (apps: string[]) => void;
  setPartnerCatalog: (catalog: CatalogApp[]) => void;
  setMyTargets: (targets: string[]) => void;
  setPartnerTargets: (targets: string[]) => void;
  setIsAppsConfigured: (isConfigured: boolean) => void;
  setIsLockdownActive: (isActive: boolean) => void;
  setIsLocked: (isLocked: boolean) => void;
  setBypassPin: (pin: string | null) => void;
  setDisconnectRequestedAt: (timestamp: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
  resetPairing: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      pairingId: null,
      pairingCode: null,
      pairingMode: null,
      userRole: null,
      selectedApps: [],
      partnerCatalog: [],
      myTargets: [],
      partnerTargets: [],
      isAppsConfigured: false,
      isLockdownActive: false,
      isLocked: false,
      bypassPin: null,
      disconnectRequestedAt: null,
      hasHydrated: false,

      setSession: (session) => set({ session }),
      setPairingId: (pairingId) => set({ pairingId }),
      setPairingCode: (pairingCode) => set({ pairingCode }),
      setPairingMode: (pairingMode) => set({ pairingMode }),
      setUserRole: (userRole) => set({ userRole }),
      setSelectedApps: (selectedApps) => set({ selectedApps }),
      setPartnerCatalog: (partnerCatalog) => set({ partnerCatalog }),
      setMyTargets: (myTargets) => set({ myTargets }),
      setPartnerTargets: (partnerTargets) => set({ partnerTargets }),
      setIsAppsConfigured: (isAppsConfigured) => set({ isAppsConfigured }),
      setIsLockdownActive: (isLockdownActive) => set({ isLockdownActive }),
      setIsLocked: (isLocked) => set({ isLocked }),
      setBypassPin: (bypassPin) => set({ bypassPin }),
      setDisconnectRequestedAt: (disconnectRequestedAt) => set({ disconnectRequestedAt }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      resetPairing: () =>
        set({
          pairingId: null,
          pairingCode: null,
          pairingMode: null,
          userRole: null,
          selectedApps: [],
          partnerCatalog: [],
          myTargets: [],
          partnerTargets: [],
          isAppsConfigured: false,
          isLockdownActive: false,
          isLocked: false,
          bypassPin: null,
          disconnectRequestedAt: null,
        }),
    }),
    {
      name: 'accountability-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        pairingId: state.pairingId,
        pairingCode: state.pairingCode,
        pairingMode: state.pairingMode,
        userRole: state.userRole,
        selectedApps: state.selectedApps,
        partnerCatalog: state.partnerCatalog,
        myTargets: state.myTargets,
        partnerTargets: state.partnerTargets,
        isAppsConfigured: state.isAppsConfigured,
        isLockdownActive: state.isLockdownActive,
        isLocked: state.isLocked,
        disconnectRequestedAt: state.disconnectRequestedAt,
      }),
    }
  )
);
