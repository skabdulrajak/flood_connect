import { createContext, useCallback, useEffect, useState } from 'react';
import { dataService } from '../services/dataService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const loadSession = useCallback(async () => {
    setLoading(true);
    setAuthError('');
    try {
      const sessionData = await dataService.getSession();
      setSession(sessionData.session || null);
      setUser(sessionData.user || null);
      setProfile(sessionData.profile || null);
    } catch (err) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthError(err?.message || 'Unable to verify authentication session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const unsubscribe = dataService.onAuthStateChange((nextState) => {
      setSession(nextState.session || null);
      setUser(nextState.user || null);
      setProfile(nextState.profile || null);
      setLoading(false);
    });

    // Re-verify session if restored from browser back-forward cache (bfcache)
    const handlePageShow = (event) => {
      if (event.persisted) {
        loadSession();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadSession]);

  const signInWithGoogle = useCallback(async () => {
    const result = await dataService.signInWithGoogle();
    setSession(result.session || { userId: result.user?.id });
    setUser(result.user);
    setProfile(result.profile);
    return result;
  }, []);

  const signIn = useCallback(async (credentials) => {
    const result = await dataService.signIn(credentials);
    setSession(result.session || { userId: result.user?.id });
    setUser(result.user);
    setProfile(result.profile);
    return result;
  }, []);

  const signUp = useCallback(async (registrationData) => {
    const result = await dataService.signUp(registrationData);
    if (!result.needsEmailConfirmation) {
      setSession(result.session || { userId: result.user?.id });
      setUser(result.user);
      setProfile(result.profile);
    }
    return result;
  }, []);

  const resendConfirmationEmail = useCallback(async (email) => {
    return dataService.resendConfirmationEmail(email);
  }, []);

  const signOut = useCallback(async () => {
    await dataService.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    return dataService.requestPasswordReset(email);
  }, []);

  const resetPassword = useCallback(async (payload) => {
    return dataService.resetPassword(payload);
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user?.id) throw new Error('No authenticated user found.');
      const updatedProfile = await dataService.updateProfile(user.id, updates);
      setProfile(updatedProfile);
      return updatedProfile;
    },
    [user?.id]
  );

  const value = {
    session,
    user,
    profile,
    role: profile?.role || null,
    isAuthenticated: Boolean(session && user && profile),
    isDemoMode: dataService.isDemoMode(),
    isFirebaseMode: dataService.isFirebaseMode(),
    loading,
    authError,
    signInWithGoogle,
    signIn,
    signUp,
    resendConfirmationEmail,
    signOut,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    refreshSession: loadSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
