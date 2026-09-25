import type { SiteDesignDto } from '@newtown-energy/types';
import { ApiError } from '../utils/api';
import { DESIGNS, designById } from './index';
import type { SiteDesign } from './types';

export type DesignResolution =
  | { design: SiteDesign; error?: never }
  | { design?: never; error: string };

/**
 * The frontend design for the backend's reported design id.
 *
 * An id this build does not know is an error, never a fallback: drawing one
 * site's diagram for another would show switches and alarms in the wrong
 * places with nothing on screen to say so.
 */
export function resolveDesign(dto: SiteDesignDto): DesignResolution {
  const design = designById(dto.id);
  if (!design) {
    const known = Object.keys(DESIGNS).join(', ');
    return {
      error:
        `The server runs site design "${dto.id}", which this version of the ` +
        `interface does not include (it knows: ${known}). The frontend and ` +
        `backend are likely out of step; deploy matching versions.`,
    };
  }
  // The design carries its own copy of the E-stop number so the diagram can
  // decide its lockout without a round trip. Checked here, once, so the copy
  // cannot quietly drift from the alarm the backend's shutdown logic reads.
  if (design.alarms.estopAlarmNum !== dto.estop_alarm_num) {
    return {
      error:
        `The server's "${dto.id}" design reports the E-stop as alarm ` +
        `${dto.estop_alarm_num}, but this interface expects alarm ` +
        `${design.alarms.estopAlarmNum}. The frontend and backend are out of ` +
        `step; deploy matching versions.`,
    };
  }
  return { design };
}

/**
 * What to tell an operator when the design could not be fetched at all.
 *
 * A 404 is not the server being down: it is a backend older than this
 * interface, which has no such endpoint, and "check the backend is running"
 * would send someone to fix the wrong thing.
 */
export function describeFetchFailure(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return (
        'The server does not report which site design it runs, so it is older ' +
        'than this interface. Deploy matching frontend and backend versions.'
      );
    }
    // The server was reached and answered; saying otherwise would send
    // someone to check a network that is fine.
    return `The server answered with an error (HTTP ${err.status}) when asked which site this is.`;
  }
  return 'Could not reach the server to learn which site this is.';
}

/**
 * How long to wait before fetching again after `attempt` consecutive failures.
 *
 * Doubling from one second, capped at thirty: a backend restart or deploy is
 * over in seconds, and an unattended display must come back on its own without
 * hammering a server that is still starting.
 */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}
