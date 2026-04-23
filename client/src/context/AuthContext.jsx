import { createContext, useContext, useMemo, useState } from "react";
//Tạo context cho Auth Context để quản lý trạng thái đăng nhập và thông tin người dùng
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const rawUser = localStorage.getItem("auth_user");
    return rawUser ? JSON.parse(rawUser) : null;
  });

  const login = (nextToken, nextUser = null) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
    if (nextUser) {
      localStorage.setItem("auth_user", JSON.stringify(nextUser));
      setUser(nextUser);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    setToken("");
    setUser(null);
  };
//Tạo value cho Auth Context bao gồm token, user, isAuthenticated, login và logout
  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout
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
