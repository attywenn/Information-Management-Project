import { useState } from "react";
import { AuthContext } from "./authContextValue.js";
import { signOutPortalAccount } from "../services/supabaseBackendService.js";

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => {
    try {
      const stored = window.localStorage.getItem("auth");
      if (!stored) return { isLoggedIn: false, user: null, token: null };
      const parsed = JSON.parse(stored);
      if (parsed?.user?.username && parsed?.user?.role && parsed?.token) {
        return { isLoggedIn: true, user: parsed.user, token: parsed.token };
      }
    } catch {
      window.localStorage.removeItem("auth");
    }
    return { isLoggedIn: false, user: null, token: null };
  });

  const login = ({ token, ...userData }) => {
    const nextState = {
      isLoggedIn: true,
      user: userData?.username ? userData : null,
      token: token || null,
    };
    setAuthState(nextState);

    const payload = {
      user: userData?.username ? userData : null,
      token: token || null,
    };
    window.localStorage.setItem("auth", JSON.stringify(payload));
  };

  const updateUser = (patch) => {
    setAuthState((previousState) => {
      const nextUser = previousState.user ? { ...previousState.user, ...patch } : previousState.user;
      const nextState = { ...previousState, user: nextUser };
      window.localStorage.setItem(
        "auth",
        JSON.stringify({ user: nextUser, token: previousState.token })
      );
      return nextState;
    });
  };

  const logout = async () => {
    setAuthState({ isLoggedIn: false, user: null, token: null });

    window.localStorage.removeItem("auth");

    try {
      await signOutPortalAccount();
    } catch {
      // Ignore sign-out edge cases to avoid blocking UI logout.
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
