import { NativeModules, Platform } from 'react-native';

export interface InstalledApp {
  appName: string;
  packageName: string;
  icon?: string; // Base64-encoded PNG thumbnail
}

interface InstalledAppsInterface {
  getNonSystemApps(): Promise<InstalledApp[]>;
}

const { InstalledApps } = NativeModules;

export const NativeInstalledApps = InstalledApps as InstalledAppsInterface | undefined;

export async function fetchInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS === 'android' && NativeInstalledApps?.getNonSystemApps) {
    try {
      const apps = await NativeInstalledApps.getNonSystemApps();
      return apps.sort((a, b) => a.appName.localeCompare(b.appName));
    } catch (err) {
      console.error('[NativeInstalledApps] Error fetching non-system apps:', err);
      throw err;
    }
  }

  console.warn('[NativeInstalledApps] Native module unavailable or not running on Android.');
  return [];
}

export default NativeInstalledApps;
