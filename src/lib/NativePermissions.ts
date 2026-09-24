import { NativeModules, Platform } from 'react-native';

export interface SpecialPermissionsStatus {
  hasOverlay: boolean;
  hasUsage: boolean;
}

export interface PermissionsModuleInterface {
  checkSpecialPermissions(): Promise<SpecialPermissionsStatus>;
  requestSpecialPermissions(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  requestUsagePermission(): Promise<boolean>;
}

// Extract native module with optional chaining
const rawPermissionsModule = NativeModules?.PermissionsModule;

// Exported object: if native module is absent on the binary, gracefully degrade
export const NativePermissions: PermissionsModuleInterface = {
  checkSpecialPermissions: async (): Promise<SpecialPermissionsStatus> => {
    if (Platform.OS === 'android' && rawPermissionsModule?.checkSpecialPermissions) {
      try {
        return await rawPermissionsModule.checkSpecialPermissions();
      } catch (err) {
        console.warn('[NativePermissions] Execution error checking permissions:', err);
        return { hasOverlay: false, hasUsage: false };
      }
    }

    console.warn('[NativePermissions] Native module missing on this binary');
    return { hasOverlay: false, hasUsage: false };
  },

  requestSpecialPermissions: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && rawPermissionsModule?.requestSpecialPermissions) {
      try {
        return await rawPermissionsModule.requestSpecialPermissions();
      } catch (err) {
        console.warn('[NativePermissions] Error launching settings intent:', err);
        return false;
      }
    }

    console.warn('[NativePermissions] Native module missing on this binary');
    return false;
  },

  requestOverlayPermission: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && rawPermissionsModule?.requestOverlayPermission) {
      try {
        return await rawPermissionsModule.requestOverlayPermission();
      } catch (err) {
        console.warn('[NativePermissions] Error requesting overlay:', err);
        return false;
      }
    }
    return false;
  },

  requestUsagePermission: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && rawPermissionsModule?.requestUsagePermission) {
      try {
        return await rawPermissionsModule.requestUsagePermission();
      } catch (err) {
        console.warn('[NativePermissions] Error requesting usage access:', err);
        return false;
      }
    }
    return false;
  },
};

export default NativePermissions;
