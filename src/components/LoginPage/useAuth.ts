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
        if (!res.ok) {
          localStorage.removeItem('userEmail');
          setUserEmail('');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        localStorage.removeItem('userEmail');
        setUserEmail('');
      })
      .finally(() => setLoading(false));
  }, []);

  return { loading, isAuthenticated, setIsAuthenticated, userEmail };
}
