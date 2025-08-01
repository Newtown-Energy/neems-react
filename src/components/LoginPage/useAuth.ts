import { useEffect, useState } from "react";
import type { UserInfo } from "../../types/auth";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  const clearUserData = () => {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userEmail');
    setUserInfo(null);
    setUserEmail('');
  };

  const saveUserInfo = (info: UserInfo) => {
    localStorage.setItem('userInfo', JSON.stringify(info));
    localStorage.setItem('userEmail', info.email);
    setUserInfo(info);
    setUserEmail(info.email);
  };

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    const storedEmail = localStorage.getItem('userEmail');
    
    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedInfo);
        setUserEmail(parsedInfo.email);
      } catch {
        // If parsing fails, fall back to just email
        if (storedEmail) {
          setUserEmail(storedEmail);
        }
      }
    } else if (storedEmail) {
      setUserEmail(storedEmail);
    }

    fetch('/api/1/hello', { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
          return res.json();
        } else {
          setIsAuthenticated(false);
          // Only clear user data if we're actually logged out (401/403)
          // Don't clear on network errors or server errors
          if (res.status === 401 || res.status === 403) {
            clearUserData();
          }
          return null;
        }
      })
      .then((data: UserInfo | null) => {
        if (data) {
          saveUserInfo(data);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        // Don't clear user data on network errors - user might still be logged in
        // This helps with test stability
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/1/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Always clear user data and set as not authenticated, even if request fails
      clearUserData();
      setIsAuthenticated(false);
    }
  };

  return { 
    loading, 
    isAuthenticated, 
    setIsAuthenticated, 
    userEmail, 
    userInfo, 
    saveUserInfo, 
    clearUserData,
    logout
  };
}
