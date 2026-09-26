import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PERMISSIONS_BY_ROLE, type User } from "@casacarlos/contracts";
import { api, getToken, setToken } from "../api.js";

// Durante una actualización puede existir una ventana muy corta en la que la
// SPA nueva todavía conversa con el servicio anterior. Esa versión no enviaba
// `permisos`; mantener el mapa histórico por rol evita una pantalla en blanco
// hasta que el instalador reinicie el servicio y aplique la migración.
const normalizeUser = (user: User): User => ({
  ...user,
  permisos: Array.isArray(user.permisos) ? user.permisos : DEFAULT_PERMISSIONS_BY_ROLE[user.rol],
});

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
      .then((current) => setUser(normalizeUser(current)))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (usuario: string, password: string) => {
    const result = await api.login(usuario, password);
    setToken(result.token);
    setUser(normalizeUser(result.user));
  }, []);

  const loginByPin = useCallback(async (pin: string) => {
    const result = await api.loginByPin(pin);
    setToken(result.token);
    setUser(normalizeUser(result.user));
  }, []);

  const register = useCallback(async (input: Parameters<typeof api.register>[0]) => {
    await api.register(input);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return { user, loading, login, loginByPin, register, logout };
}
