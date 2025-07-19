import { useEffect, useState } from "react";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setUserEmail(storedEmail);
    }

    fetch('/api/1/hello', { credentials: 'include' })
      .then(res => {
        setIsAuthenticated(res.ok);
        // Only clear email if we're actually logged out (401/403)
        // Don't clear on network errors or server errors
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('userEmail');
          setUserEmail('');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        // Don't clear email on network errors - user might still be logged in
        // This helps with test stability
      })
      .finally(() => setLoading(false));
  }, []);

  return { loading, isAuthenticated, setIsAuthenticated, userEmail };
}
