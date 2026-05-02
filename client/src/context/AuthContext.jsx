import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function normalizeAuthUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id != null ? raw.id : raw._id;
  return {
    id: id != null ? String(id) : "",
    firstName: raw.firstName || "",
    lastName: raw.lastName || "",
    email: raw.email || "",
    avatar: typeof raw.avatar === "string" ? raw.avatar.trim() : ""
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const rawUser = localStorage.getItem("auth_user");
    if (!rawUser) return null;
    try {
      return normalizeAuthUser(JSON.parse(rawUser));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (cancelled || !data?.user) return;
        const n = normalizeAuthUser(data.user);
        if (n) {
          setUser(n);
          localStorage.setItem("auth_user", JSON.stringify(n));
        }
      } catch {
        /* giữ user từ localStorage nếu /me lỗi */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = (nextToken, nextUser = null) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
    if (nextUser) {
      const n = normalizeAuthUser(nextUser);
      if (n) {
        localStorage.setItem("auth_user", JSON.stringify(n));
        setUser(n);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    setToken("");
    setUser(null);
  };

  const updateUser = (nextUser) => {
    if (!nextUser) {
      setUser(null);
      localStorage.removeItem("auth_user");
      return;
    }
    setUser((prev) => {
      const merged = { ...(prev || {}), ...nextUser };
      const n = normalizeAuthUser(merged);
      if (n) localStorage.setItem("auth_user", JSON.stringify(n));
      return n;
    });
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
      updateUser
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
