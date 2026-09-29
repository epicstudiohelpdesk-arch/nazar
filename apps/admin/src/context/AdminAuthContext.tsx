import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AdminProfileDto, AdminLoginRequest } from '@platform/api-contracts';
import { adminApi } from '../api/admin-client.js';

interface AdminAuthContextType {
  admin: AdminProfileDto | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: AdminLoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [admin, setAdmin] = useState<AdminProfileDto | null>(null);
  const [token, setToken] = useState<string | null>(adminApi.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth(): Promise<void> {
      const storedToken = adminApi.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await adminApi.getMe();
        setAdmin(res.admin);
        setToken(storedToken);
      } catch (err: unknown) {
        console.warn('Session restoration failed:', err);
        adminApi.setToken(null);
        setToken(null);
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (credentials: AdminLoginRequest): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await adminApi.login(credentials);
      setAdmin(res.admin);
      setToken(res.accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await adminApi.logout();
    } catch {
      // ignore
    } finally {
      setAdmin(null);
      setToken(null);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.roles.includes('SUPER_ADMIN')) return true;
    return admin.permissions.includes(permission as any);
  };

  const hasRole = (role: string): boolean => {
    if (!admin) return false;
    return admin.roles.includes(role as any);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!admin,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
