/**
 * `expo-device` test double. Mirrors the fields the push runtime reads to build
 * a stable device identifier and to avoid prompting on simulators.
 */

export let isDevice: boolean = true;
export function __setIsDevice(value: boolean): void {
  isDevice = value;
}

export const Platform = {
  OS: 'ios' as 'ios' | 'android',
  Version: '18.0',
  ModelId: 'iPhone15,2',
};

export function __setPlatform(os: 'ios' | 'android', version: string, modelId: string): void {
  Platform.OS = os;
  Platform.Version = version;
  Platform.ModelId = modelId;
}

export const Device = {
  get osName(): string {
    return Platform.OS === 'ios' ? 'iOS' : 'Android';
  },
  get osVersion(): string {
    return Platform.Version;
  },
  get modelId(): string {
    return Platform.ModelId;
  },
  get deviceName(): string {
    return 'Test Device';
  },
};
