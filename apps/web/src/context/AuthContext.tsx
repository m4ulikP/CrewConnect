import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { UserDTO, LoginInput, RegisterInput } from "@crewconnect/shared";
import { apiGetMe, apiLogin, apiRegister, apiLogout, ApiClientError } from "../lib/api";

interface AuthContextType {
  user: UserDTO | null;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiGetMe();
      setUser(res.user);
    } catch {
      // Unauthenticated session - not a catastrophic error
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (data: LoginInput) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiLogin(data);
      setUser(res.user);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to log in. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiRegister(data);
      setUser(res.user);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to create account. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await apiLogout();
      setUser(null);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
