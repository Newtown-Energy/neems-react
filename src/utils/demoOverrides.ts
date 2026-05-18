/**
 * Demo-time overrides.
 *
 * Tab-local state for the values the demo's "force the world into a
 * specific configuration" drawer can twist: a forced wall-clock,
 * utility curtailment ceiling, current battery SoC, the set of open
 * breakers, and the set of offline Megapacks. All of these flow into
 * the schedule warning engine via [ScheduleWarningContext].
 *
 * Forced alarms are kept separately — they live on the server (see the
 * `/api/1/Alarms/Forced` endpoint and `alarmApi.ts`) so they surface in
 * the SLD, alarms page, and FDNY view through the same path real
 * alarms use.
 *
 * Persistence here is intentionally `sessionStorage` (not
 * `localStorage`) so a fresh tab starts in the "real" state —
 * operators don't want yesterday's demo SoC override silently shaping
 * today's session.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const STORAGE_KEY = 'neems.demoOverrides';

export interface DemoOverridesState {
  /** ISO datetime string the rest of the app should treat as "now",
   *  or null to use the real wall-clock. */
  forcedNow: string | null;
  /** Utility curtailment ceiling in kW, or null when the utility is
   *  not curtailing. */
  curtailmentCeilingKw: number | null;
  /** Current SoC the warning engine should assume, 0–100. Null falls
   *  back to the engine's default (100%). */
  currentSocPercent: number | null;
  /** Names of breakers currently in the "open" state. Empty means
   *  everything is closed. */
  openBreakers: string[];
  /** Names of Megapacks currently offline. */
  offlineMegapacks: string[];
}

export const EMPTY_OVERRIDES: DemoOverridesState = {
  forcedNow: null,
  curtailmentCeilingKw: null,
  currentSocPercent: null,
  openBreakers: [],
  offlineMegapacks: []
};

function readStored(): DemoOverridesState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw) as Partial<DemoOverridesState>;
    return {
      forcedNow: typeof parsed.forcedNow === 'string' ? parsed.forcedNow : null,
      curtailmentCeilingKw:
        typeof parsed.curtailmentCeilingKw === 'number' ? parsed.curtailmentCeilingKw : null,
      currentSocPercent:
        typeof parsed.currentSocPercent === 'number' ? parsed.currentSocPercent : null,
      openBreakers: Array.isArray(parsed.openBreakers)
        ? parsed.openBreakers.filter((v): v is string => typeof v === 'string')
        : [],
      offlineMegapacks: Array.isArray(parsed.offlineMegapacks)
        ? parsed.offlineMegapacks.filter((v): v is string => typeof v === 'string')
        : []
    };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

function writeStored(value: DemoOverridesState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // sessionStorage can be disabled in some browsers — fall back to
    // in-memory state for this tab.
  }
}

interface DemoOverridesContextValue {
  overrides: DemoOverridesState;
  setForcedNow: (value: string | null) => void;
  setCurtailmentCeilingKw: (value: number | null) => void;
  setCurrentSocPercent: (value: number | null) => void;
  toggleOpenBreaker: (name: string) => void;
  toggleOfflineMegapack: (name: string) => void;
  reset: () => void;
  /** True iff any override is currently active — useful for surfacing
   *  a "demo overrides in effect" indicator in the top bar. */
  hasAnyOverride: boolean;
}

const DemoOverridesContext = createContext<DemoOverridesContextValue | undefined>(undefined);

export const DemoOverridesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [overrides, setOverrides] = useState<DemoOverridesState>(readStored);

  useEffect(() => {
    writeStored(overrides);
  }, [overrides]);

  const setForcedNow = useCallback((value: string | null) => {
    setOverrides(prev => ({ ...prev, forcedNow: value }));
  }, []);

  const setCurtailmentCeilingKw = useCallback((value: number | null) => {
    setOverrides(prev => ({ ...prev, curtailmentCeilingKw: value }));
  }, []);

  const setCurrentSocPercent = useCallback((value: number | null) => {
    setOverrides(prev => ({ ...prev, currentSocPercent: value }));
  }, []);

  const toggleOpenBreaker = useCallback((name: string) => {
    setOverrides(prev => {
      const has = prev.openBreakers.includes(name);
      return {
        ...prev,
        openBreakers: has
          ? prev.openBreakers.filter(n => n !== name)
          : [...prev.openBreakers, name]
      };
    });
  }, []);

  const toggleOfflineMegapack = useCallback((name: string) => {
    setOverrides(prev => {
      const has = prev.offlineMegapacks.includes(name);
      return {
        ...prev,
        offlineMegapacks: has
          ? prev.offlineMegapacks.filter(n => n !== name)
          : [...prev.offlineMegapacks, name]
      };
    });
  }, []);

  const reset = useCallback(() => {
    setOverrides(EMPTY_OVERRIDES);
  }, []);

  const hasAnyOverride = useMemo(
    () =>
      overrides.forcedNow !== null ||
      overrides.curtailmentCeilingKw !== null ||
      overrides.currentSocPercent !== null ||
      overrides.openBreakers.length > 0 ||
      overrides.offlineMegapacks.length > 0,
    [overrides]
  );

  const value = useMemo<DemoOverridesContextValue>(
    () => ({
      overrides,
      setForcedNow,
      setCurtailmentCeilingKw,
      setCurrentSocPercent,
      toggleOpenBreaker,
      toggleOfflineMegapack,
      reset,
      hasAnyOverride
    }),
    [
      overrides,
      setForcedNow,
      setCurtailmentCeilingKw,
      setCurrentSocPercent,
      toggleOpenBreaker,
      toggleOfflineMegapack,
      reset,
      hasAnyOverride
    ]
  );

  return React.createElement(DemoOverridesContext.Provider, { value }, children);
};

/**
 * Resolve the effective "now" Date — `overrides.forcedNow` when set,
 * otherwise the wall-clock when the hook last ran. Returns a new Date
 * every render so the calendar re-renders as the user nudges the
 * forced-now value. Callers that don't need reactive ticking can just
 * read [useDemoOverrides] directly.
 */
export function useEffectiveNow(): Date {
  const { overrides } = useDemoOverrides();
  if (overrides.forcedNow) {
    const parsed = new Date(overrides.forcedNow);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Read the demo overrides context. Returns [EMPTY_OVERRIDES] semantics
 * when called outside a provider so callers that only need to read
 * (e.g. the warning engine in pages that don't host the drawer) don't
 * crash.
 */
export function useDemoOverrides(): DemoOverridesContextValue {
  const ctx = useContext(DemoOverridesContext);
  if (ctx) return ctx;
  // Inert shim — every mutator is a no-op. Used when the consumer is
  // rendered outside the provider; the page just won't see overrides.
  const noop = (): void => {
    /* intentional no-op; provider not mounted */
  };
  return {
    overrides: EMPTY_OVERRIDES,
    setForcedNow: noop,
    setCurtailmentCeilingKw: noop,
    setCurrentSocPercent: noop,
    toggleOpenBreaker: noop,
    toggleOfflineMegapack: noop,
    reset: noop,
    hasAnyOverride: false
  };
}
