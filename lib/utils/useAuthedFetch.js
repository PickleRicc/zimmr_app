import { useAuth } from '../../contexts/AuthContext';

// Hook returns a fetch wrapper that automatically attaches the user's JWT
export function useAuthedFetch() {
  const { session } = useAuth();

  return async (input, init = {}) => {
    const token = session?.access_token;
    const headers = {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const res = await fetch(input, { ...init, headers });
    return res;
  };
}
