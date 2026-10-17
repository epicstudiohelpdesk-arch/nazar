export enum AuthenticationType {
  FINGERPRINT = 1,
  FACIAL_RECOGNITION = 2,
  IRIS = 3,
}

export const hasHardwareAsync = async (): Promise<boolean> => true;
export const isEnrolledAsync = async (): Promise<boolean> => true;
export const supportedAuthenticationTypesAsync = async (): Promise<AuthenticationType[]> => [
  AuthenticationType.FACIAL_RECOGNITION,
];
export const authenticateAsync = async (): Promise<{ success: boolean; error?: string }> => ({
  success: true,
});
export const cancelAuthenticate = async (): Promise<void> => {};
