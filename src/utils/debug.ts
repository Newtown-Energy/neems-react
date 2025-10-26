/**
 * Debug utility for conditional logging throughout the application.
 *
 * Debug mode can be enabled in two ways:
 * 1. Query string: ?debug=true
 * 2. localStorage: localStorage.setItem('debugSchedule', 'true')
 *
 * Usage:
 *   import { debugLog } from '@/utils/debug';
 *   debugLog('Loading calendar for month:', currentMonth);
 */

/**
 * Check if debug mode is enabled via query string or localStorage
 */
export const isDebugEnabled = (): boolean => {
  // Check query string
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === 'true') {
    return true;
  }

  // Check localStorage
  try {
    return localStorage.getItem('debugSchedule') === 'true';
  } catch (e) {
    return false;
  }
};

/**
 * Log a debug message if debug mode is enabled
 */
export const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log('[DEBUG]', ...args);
  }
};
