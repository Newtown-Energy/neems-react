import { createContext, useContext } from 'react';

/**
 * Provides a way to force an immediate refresh of the active-alarms poll from
 * deep within the SLD element tree (e.g. an Acknowledge button inside
 * `AlarmIndicator`) without prop-drilling the callback through every element
 * and the layout. Defaults to a no-op so elements rendered outside a provider
 * (e.g. in isolation) stay safe.
 *
 * Resolves to whether the refresh published an update. The Acknowledge button
 * has no use for that, but a caller waiting on fresh positions does, and a
 * context that dropped it would quietly hand them a promise that resolves the
 * same whether or not anything landed.
 */
export type SldAlarmRefetch = () => Promise<boolean>;

export const SldAlarmRefetchContext = createContext<SldAlarmRefetch>(
  // Default no-op for elements rendered outside a provider. Nothing was
  // published, and saying otherwise would be a lie a caller could act on.
  () => Promise.resolve(false),
);

/** Read the SLD active-alarm refetch callback. */
export function useSldAlarmRefetch(): SldAlarmRefetch {
  return useContext(SldAlarmRefetchContext);
}
