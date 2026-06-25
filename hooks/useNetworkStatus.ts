import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

// Lightweight network store — just tracks online/offline state
interface NetworkStore {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOffline: false,
  setOffline: (v) => set({ isOffline: v }),
}));

export function useNetworkStatus() {
  const { isOffline, setOffline } = useNetworkStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected ?? true));
    });
    return () => unsubscribe();
  }, [setOffline]);

  return { isOffline };
}
