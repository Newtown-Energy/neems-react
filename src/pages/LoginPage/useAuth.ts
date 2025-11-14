import { useEffect, useState } from "react";
import type { LoginSuccessResponse } from "../../types/auth";
import { apiRequest, ApiError } from "../../utils/api";
import { debugLog } from "../../utils/debug";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<LoginSuccessResponse | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  const clearUserData = () => {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userEmail');
    setUserInfo(null);
    setUserEmail('');
  };

  const saveUserInfo = (info: LoginSuccessResponse) => {
    localStorage.setItem('userInfo', JSON.stringify(info));
    localStorage.setItem('userEmail', info.email);
    setUserInfo(info);
    setUserEmail(info.email);
  };

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    const storedEmail = localStorage.getItem('userEmail');

    debugLog('useAuth: Checking authentication', {
      hasStoredUserInfo: !!storedUserInfo,
      hasStoredEmail: !!storedEmail
    });

    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        setUserInfo(parsedInfo);
        setUserEmail(parsedInfo.email);
        debugLog('useAuth: Loaded user info from localStorage', { email: parsedInfo.email });
      } catch {
        // If parsing fails, fall back to just email
        if (storedEmail) {
          setUserEmail(storedEmail);
          debugLog('useAuth: Failed to parse userInfo, using email only', { email: storedEmail });
        }
      }
    } else if (storedEmail) {
      setUserEmail(storedEmail);
      debugLog('useAuth: Loaded email from localStorage', { email: storedEmail });
    }

    debugLog('useAuth: Calling /api/1/hello to verify authentication');
    apiRequest<LoginSuccessResponse>('/api/1/hello')
      .then((data) => {
        debugLog('useAuth: Authentication verified', { email: data.email, roles: data.roles });
        setIsAuthenticated(true);
        saveUserInfo(data);
      })
      .catch((err) => {
        debugLog('useAuth: Authentication failed', { error: err, status: err instanceof ApiError ? err.status : undefined });
        setIsAuthenticated(false);
        if (err instanceof ApiError) {
          // Only clear user data if we're actually logged out (401/403)
          // Don't clear on network errors or server errors
          if (err.status === 401 || err.status === 403) {
            debugLog('useAuth: Clearing user data due to 401/403');
            clearUserData();
          }
        }
        // Don't clear user data on network errors - user might still be logged in
        // This helps with test stability
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    debugLog('useAuth: Logout initiated');
    try {
      await apiRequest('/api/1/logout', {
        method: 'POST'
      });
      debugLog('useAuth: Logout API call successful');
    } catch (error) {
      console.error('Logout request failed:', error);
      debugLog('useAuth: Logout API call failed', error);
    } finally {
      // Always clear user data and set as not authenticated, even if request fails
      debugLog('useAuth: Clearing user data and setting isAuthenticated to false');
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
