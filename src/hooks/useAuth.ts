import { useEffect, useState } from "react";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/1/hello', { credentials: 'include' })
      .then(res => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  return { loading, isAuthenticated, setIsAuthenticated };
}
