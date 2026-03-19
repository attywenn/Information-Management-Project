import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Backend has no session endpoint; login state is set only after POST /login success
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); // { username, role }
  const [token, setToken] = useState(null);

  const login = ({ username, role, token }) => {
    setIsLoggedIn(true);
    setUser(username ? { username, role } : null);
    setToken(token || null);

    // Persist to localStorage so refresh keeps the session
    const payload = {
      user: username ? { username, role } : null,
      token: token || null,
    };
    window.localStorage.setItem("auth", JSON.stringify(payload));
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setToken(null);

    window.localStorage.removeItem("auth");
  };

   // On first load, restore auth state from localStorage if available
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("auth");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.user?.username && parsed?.user?.role && parsed?.token) {
        setIsLoggedIn(true);
        setUser({ username: parsed.user.username, role: parsed.user.role });
        setToken(parsed.token);
      }
    } catch {
      window.localStorage.removeItem("auth");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
