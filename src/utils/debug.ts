/**
 * Logging utilities for the application.
 *
 * - debugLog: gated by debug mode (query string ?debug=true or
 *   localStorage.debugSchedule === 'true'). Use for verbose tracing.
 * - warnLog / errorLog: always log. Use for warnings and errors that should
 *   be visible regardless of debug mode.
 *
 * Routing all console output through this module gives us a single place to
 * change logging behavior (e.g. forward to a remote sink) later.
 *
 * Usage:
 *   import { debugLog, warnLog, errorLog } from '@/utils/debug';
 *   debugLog('Loading calendar for month:', currentMonth);
 *   warnLog('Empty response from', url);
 *   errorLog('Error fetching users:', err);
 */

export const isDebugEnabled = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === 'true') {
    return true;
  }

  try {
    return localStorage.getItem('debugSchedule') === 'true';
  } catch {
    return false;
  }
};

export const debugLog = (...args: any[]): void => {
  if (isDebugEnabled()) {
    console.log('[DEBUG]', ...args);
  }
};

export const warnLog = (...args: any[]): void => {
  console.warn(...args);
};

export const errorLog = (...args: any[]): void => {
  console.error(...args);
};
