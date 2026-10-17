export interface ITokenStorage {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  getDeviceId(): Promise<string | null>;
  setDeviceId(id: string): Promise<void>;
  getPasskeyCredentialId(): Promise<string | null>;
  setPasskeyCredentialId(id: string): Promise<void>;
  clearPasskeyCredentialId(): Promise<void>;
  clearTokens(): Promise<void>;
}

export class InMemoryTokenStorage implements ITokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private deviceId: string | null = null;
  private passkeyCredentialId: string | null = null;

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async setAccessToken(token: string): Promise<void> {
    this.accessToken = token;
  }

  async getRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  async setRefreshToken(token: string): Promise<void> {
    this.refreshToken = token;
  }

  async getDeviceId(): Promise<string | null> {
    return this.deviceId;
  }

  async setDeviceId(id: string): Promise<void> {
    this.deviceId = id;
  }

  async getPasskeyCredentialId(): Promise<string | null> {
    return this.passkeyCredentialId;
  }

  async setPasskeyCredentialId(id: string): Promise<void> {
    this.passkeyCredentialId = id;
  }

  async clearPasskeyCredentialId(): Promise<void> {
    this.passkeyCredentialId = null;
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export interface ISecureStoreAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export class SecureTokenStorage implements ITokenStorage {
  private static readonly ACCESS_TOKEN_KEY = 'nazar_auth_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'nazar_auth_refresh_token';
  private static readonly DEVICE_ID_KEY = 'nazar_auth_device_id';
  private static readonly PASSKEY_CREDENTIAL_KEY = 'nazar_auth_passkey_credential_id';

  constructor(
    private readonly secureStore: ISecureStoreAdapter,
    private readonly fallbackStorage?: ITokenStorage
  ) {}

  async getAccessToken(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(SecureTokenStorage.ACCESS_TOKEN_KEY);
    } catch {
      return this.fallbackStorage ? this.fallbackStorage.getAccessToken() : null;
    }
  }

  async setAccessToken(token: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(SecureTokenStorage.ACCESS_TOKEN_KEY, token);
    } catch {
      if (this.fallbackStorage) {
        await this.fallbackStorage.setAccessToken(token);
      }
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(SecureTokenStorage.REFRESH_TOKEN_KEY);
    } catch {
      return this.fallbackStorage ? this.fallbackStorage.getRefreshToken() : null;
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(SecureTokenStorage.REFRESH_TOKEN_KEY, token);
    } catch {
      if (this.fallbackStorage) {
        await this.fallbackStorage.setRefreshToken(token);
      }
    }
  }

  async getDeviceId(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(SecureTokenStorage.DEVICE_ID_KEY);
    } catch {
      return this.fallbackStorage ? this.fallbackStorage.getDeviceId() : null;
    }
  }

  async setDeviceId(id: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(SecureTokenStorage.DEVICE_ID_KEY, id);
    } catch {
      if (this.fallbackStorage) {
        await this.fallbackStorage.setDeviceId(id);
      }
    }
  }

  async getPasskeyCredentialId(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(SecureTokenStorage.PASSKEY_CREDENTIAL_KEY);
    } catch {
      return this.fallbackStorage ? this.fallbackStorage.getPasskeyCredentialId() : null;
    }
  }

  async setPasskeyCredentialId(id: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(SecureTokenStorage.PASSKEY_CREDENTIAL_KEY, id);
    } catch {
      if (this.fallbackStorage) {
        await this.fallbackStorage.setPasskeyCredentialId(id);
      }
    }
  }

  async clearPasskeyCredentialId(): Promise<void> {
    try {
      await this.secureStore.deleteItemAsync(SecureTokenStorage.PASSKEY_CREDENTIAL_KEY);
    } catch {
      // Ignore
    }
    if (this.fallbackStorage) {
      await this.fallbackStorage.clearPasskeyCredentialId();
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await this.secureStore.deleteItemAsync(SecureTokenStorage.ACCESS_TOKEN_KEY);
      await this.secureStore.deleteItemAsync(SecureTokenStorage.REFRESH_TOKEN_KEY);
    } catch {
      // Ignore or clear fallback
    }
    if (this.fallbackStorage) {
      await this.fallbackStorage.clearTokens();
    }
  }
}
