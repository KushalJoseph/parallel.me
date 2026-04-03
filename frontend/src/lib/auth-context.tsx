'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthContextValue {
  /** The currently signed-in Firebase user, or null if not authenticated. */
  user: User | null;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
  /**
   * Returns a fresh Firebase ID token for the current user.
   * Throws if the user is not signed in.
   */
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const getIdToken = async (): Promise<string> => {
    if (!auth.currentUser) {
      throw new Error('Not authenticated');
    }
    return auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
