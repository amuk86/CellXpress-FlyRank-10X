import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { useRouter } from "next/router";
import { getClientAuth } from "../lib/firebaseClient.js";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export default function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      return onIdTokenChanged(getClientAuth(), async (current) => {
        if (current) {
          try {
            const token = await current.getIdTokenResult();
            if (token.claims.staff !== true) {
              await signOut(getClientAuth());
              setError(
                "This account is not authorized for the staff workspace.",
              );
              setUser(null);
              setLoading(false);
              return;
            }
          } catch {
            setError(
              "Could not verify your staff session. Please sign in again.",
            );
            setUser(null);
            setLoading(false);
            return;
          }
        }
        setUser(current);
        setLoading(false);
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!loading && !user && router.pathname !== "/login")
      router.replace("/login");
    if (!loading && user && router.pathname === "/login") router.replace("/");
  }, [user, loading, router.pathname]);
  const apiFetch = async (url, options = {}) => {
    const current = getClientAuth().currentUser;
    if (!current) throw new Error("Please sign in again.");
    const token = await current.getIdToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.status === 401) {
      await signOut(getClientAuth());
      throw new Error("Session expired. Please sign in again.");
    }
    return response;
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        error,
        setError,
        apiFetch,
        logout: () => signOut(getClientAuth()),
      }}
    >
      {loading || (!user && router.pathname !== "/login") ? (
        <div className="page">
          <p role="status">Opening staff workspace…</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
