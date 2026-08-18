import { useCallback, useEffect, useState } from "react";
import type { User } from "@casacarlos/contracts";
import { api, getToken, setToken } from "../api.js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (usuario: string, password: string) => {
    const result = await api.login(usuario, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const loginByPin = useCallback(async (pin: string) => {
    const result = await api.loginByPin(pin);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return { user, loading, login, loginByPin, logout };
}
