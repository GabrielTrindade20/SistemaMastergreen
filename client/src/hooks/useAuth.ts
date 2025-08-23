import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, LoginUser } from "@shared/schema";
import { useState, useEffect } from "react";

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check auth status once on mount
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/me", {
          credentials: 'include' // Importante para incluir cookies
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginUser) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: 'include' // Importante para incluir cookies
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Login successful, reloading to update interface");
      // Usar window.location.href para recarregar completamente
      window.location.href = "/dashboard";
    },
    onError: (error) => {
      console.log("Login error:", error);
      setError(error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", { 
        method: "POST",
        credentials: 'include' // Importante para incluir cookies
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Logout successful, reloading to update interface");
      // Usar window.location.href para recarregar completamente
      window.location.href = "/";
    },
  });

  return {
    user: user as User | undefined,
    isLoading,
    error,
    isAuthenticated: !!user,
    login: loginMutation,
    logout: logoutMutation,
  };
}