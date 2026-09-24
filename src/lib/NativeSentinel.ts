import { NativeModules, Platform } from 'react-native';

export interface SentinelModuleInterface {
  startSentinel(targetPackages: string[]): Promise<boolean>;
  stopSentinel(): Promise<boolean>;
  isSentinelRunning(): Promise<boolean>;
}

// Extract native module with optional chaining
const rawSentinelModule = NativeModules?.SentinelModule;

// Exported object: if native module is absent on the binary, gracefully degrade
export const NativeSentinel: SentinelModuleInterface = {
  startSentinel: async (targetPackages: string[]): Promise<boolean> => {
    if (Platform.OS === 'android' && rawSentinelModule?.startSentinel) {
      try {
        return await rawSentinelModule.startSentinel(targetPackages);
      } catch (err) {
        console.warn('[NativeSentinel] Error starting Sentinel service:', err);
        return false;
      }
    }

    console.warn('[NativeSentinel] Native module missing on this binary. Cannot start background sentinel.');
    return false;
  },

  stopSentinel: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && rawSentinelModule?.stopSentinel) {
      try {
        return await rawSentinelModule.stopSentinel();
      } catch (err) {
        console.warn('[NativeSentinel] Error stopping Sentinel service:', err);
        return false;
      }
    }

    console.warn('[NativeSentinel] Native module missing on this binary.');
    return false;
  },

  isSentinelRunning: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && rawSentinelModule?.isSentinelRunning) {
      try {
        return await rawSentinelModule.isSentinelRunning();
      } catch (err) {
        return false;
      }
    }
    return false;
  },
};

export default NativeSentinel;
