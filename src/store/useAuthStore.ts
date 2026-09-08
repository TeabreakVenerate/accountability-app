import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  pairingId: string | null;
  setSession: (session: Session | null) => void;
  setPairingId: (pairingId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  pairingId: null,
  setSession: (session) => set({ session }),
  setPairingId: (pairingId) => set({ pairingId }),
}));
