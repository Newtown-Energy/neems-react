import { createContext, useContext } from 'react';

/**
 * Provides a way to force an immediate refresh of the active-alarms poll from
 * deep within the SLD element tree (e.g. an Acknowledge button inside
 * `AlarmIndicator`) without prop-drilling the callback through every element
 * and the layout. Defaults to a no-op so elements rendered outside a provider
 * (e.g. in isolation) stay safe.
 */
export type SldAlarmRefetch = () => Promise<void>;

export const SldAlarmRefetchContext = createContext<SldAlarmRefetch>(
  // Default no-op for elements rendered outside a provider.
  () => Promise.resolve(),
);

/** Read the SLD active-alarm refetch callback. */
export function useSldAlarmRefetch(): SldAlarmRefetch {
  return useContext(SldAlarmRefetchContext);
}
