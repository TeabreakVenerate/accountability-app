import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

export interface CatalogApp {
  appName: string;
  packageName: string;
}

interface AuthState {
  session: Session | null;
  pairingId: string | null;
  userRole: 'user_1' | 'user_2' | null;
  selectedApps: string[];
  partnerCatalog: CatalogApp[];
  myTargets: string[];
  partnerTargets: string[];
  isAppsConfigured: boolean;
  isLockdownActive: boolean;
  setSession: (session: Session | null) => void;
  setPairingId: (pairingId: string | null) => void;
  setUserRole: (role: 'user_1' | 'user_2' | null) => void;
  setSelectedApps: (apps: string[]) => void;
  setPartnerCatalog: (catalog: CatalogApp[]) => void;
  setMyTargets: (targets: string[]) => void;
  setPartnerTargets: (targets: string[]) => void;
  setIsAppsConfigured: (isConfigured: boolean) => void;
  setIsLockdownActive: (isActive: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  pairingId: null,
  userRole: null,
  selectedApps: [],
  partnerCatalog: [],
  myTargets: [],
  partnerTargets: [],
  isAppsConfigured: false,
  isLockdownActive: false,
  setSession: (session) => set({ session }),
  setPairingId: (pairingId) =>
    set((state) => ({
      pairingId,
      // If unpairing, clear app selection state and deactivate lockdown
      ...(pairingId === null
        ? {
            userRole: null,
            selectedApps: [],
            partnerCatalog: [],
            myTargets: [],
            partnerTargets: [],
            isAppsConfigured: false,
            isLockdownActive: false,
          }
        : {}),
    })),
  setUserRole: (userRole) => set({ userRole }),
  setSelectedApps: (selectedApps) => set({ selectedApps }),
  setPartnerCatalog: (partnerCatalog) => set({ partnerCatalog }),
  setMyTargets: (myTargets) => set({ myTargets }),
  setPartnerTargets: (partnerTargets) => set({ partnerTargets }),
  setIsAppsConfigured: (isAppsConfigured) => set({ isAppsConfigured }),
  setIsLockdownActive: (isLockdownActive) => set({ isLockdownActive }),
}));
