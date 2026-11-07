import { create } from 'zustand';

import { AuthSession, UserProfile, Vehicle } from '@typings/types';

interface SessionState {
  session: AuthSession | null;
  profile: UserProfile | null;
  vehicle: Vehicle | null;
  setSession: (session: AuthSession | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setVehicle: (vehicle: Vehicle | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  profile: null,
  vehicle: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setVehicle: (vehicle) => set({ vehicle }),
  clear: () => set({ session: null, profile: null, vehicle: null }),
}));
