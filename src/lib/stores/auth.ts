import { writable, derived } from 'svelte/store';
import localstory from 'localstory';

export interface AuthUser {
  login: string;
  avatarUrl: string;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

const storage = typeof window !== 'undefined'
  ? localstory(window.localStorage, 'dd-auth')
  : null;

// Track whether the initial hydration check has completed
const _authReady = writable(false);

function createAuthStore() {
  const stored = storage?.get('session') as AuthState | null;
  const { subscribe, set, update } = writable<AuthState | null>(stored ?? null);

  // Mark as ready after initial value is set
  if (typeof window !== 'undefined') {
    _authReady.set(true);
  }

  return {
    subscribe,

    login(token: string, user: AuthUser) {
      const session: AuthState = { token, user };
      storage?.set('session', session);
      set(session);
    },

    logout() {
      storage?.unset('session');
      set(null);
    },

    /** Re-hydrate from localStorage (call on mount) */
    hydrate() {
      const stored = storage?.get('session') as AuthState | null;
      if (stored) set(stored);
      _authReady.set(true);
    },
  };
}

export const auth = createAuthStore();

/** True once the auth store has checked localStorage */
export const authReady = derived(_authReady, (v) => v);

export const isAuthenticated = derived(auth, ($auth) => $auth !== null);

export const currentUser = derived(auth, ($auth) => $auth?.user ?? null);

export const authToken = derived(auth, ($auth) => $auth?.token ?? null);
