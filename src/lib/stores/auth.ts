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

function createAuthStore() {
  const stored = storage?.get('session') as AuthState | null;
  const { subscribe, set, update } = writable<AuthState | null>(stored ?? null);

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
    },
  };
}

export const auth = createAuthStore();

export const isAuthenticated = derived(auth, ($auth) => $auth !== null);

export const currentUser = derived(auth, ($auth) => $auth?.user ?? null);

export const authToken = derived(auth, ($auth) => $auth?.token ?? null);
