import { NativeModules, Platform } from 'react-native';

export interface InstalledApp {
  appName: string;
  packageName: string;
  icon?: string; // Base64-encoded PNG thumbnail
}

export interface InstalledAppsInterface {
  getNonSystemApps(): Promise<InstalledApp[]>;
}

// Extract native module with optional chaining
const rawInstalledApps = NativeModules?.InstalledApps;

// Exported object: if native module is absent from the binary, gracefully degrade
export const NativeInstalledApps: InstalledAppsInterface = {
  getNonSystemApps: async (): Promise<InstalledApp[]> => {
    if (Platform.OS === 'android' && rawInstalledApps?.getNonSystemApps) {
      try {
        const apps = await rawInstalledApps.getNonSystemApps();
        return Array.isArray(apps) ? apps.sort((a, b) => a.appName.localeCompare(b.appName)) : [];
      } catch (err) {
        console.warn('[NativeInstalledApps] Execution error querying native apps:', err);
        return [];
      }
    }

    console.warn('[NativeInstalledApps] Native module missing on this binary');
    return [];
  },
};

export const fetchInstalledApps = NativeInstalledApps.getNonSystemApps;

export default NativeInstalledApps;
