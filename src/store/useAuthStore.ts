import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  pairingId: string | null;
  selectedApps: string[];
  isAppsConfigured: boolean;
  isLockdownActive: boolean;
  setSession: (session: Session | null) => void;
  setPairingId: (pairingId: string | null) => void;
  setSelectedApps: (apps: string[]) => void;
  setIsAppsConfigured: (isConfigured: boolean) => void;
  setIsLockdownActive: (isActive: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  pairingId: null,
  selectedApps: [],
  isAppsConfigured: false,
  isLockdownActive: false,
  setSession: (session) => set({ session }),
  setPairingId: (pairingId) =>
    set((state) => ({
      pairingId,
      // If unpairing, clear app selection state and deactivate lockdown
      ...(pairingId === null ? { selectedApps: [], isAppsConfigured: false, isLockdownActive: false } : {}),
    })),
  setSelectedApps: (selectedApps) => set({ selectedApps }),
  setIsAppsConfigured: (isAppsConfigured) => set({ isAppsConfigured }),
  setIsLockdownActive: (isLockdownActive) => set({ isLockdownActive }),
}));
