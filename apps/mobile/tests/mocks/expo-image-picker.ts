export const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
} as const;

export const CameraType = {
  front: 'front',
  back: 'back',
} as const;

export const launchImageLibraryAsync = async () => ({
  canceled: true,
  assets: null,
});

export const launchCameraAsync = async () => ({
  canceled: true,
  assets: null,
});

export const requestMediaLibraryPermissionsAsync = async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export const requestCameraPermissionsAsync = async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export default {
  MediaTypeOptions,
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
};
