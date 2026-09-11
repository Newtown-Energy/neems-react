/**
 * Latest-wins ordering for overlapping polls.
 *
 * A poller that starts a request on a timer does not wait for the previous one
 * to finish, so answers can arrive out of order. When each answer describes the
 * whole of something — the site's alarm state, say — a slow one landing after a
 * newer one has already answered rewinds the screen. Worse when it is a
 * failure: a late "unreachable" raises the stale-data emergency over data that
 * is in fact current.
 *
 * `begin()` marks the start of a request and returns a check the request makes
 * before publishing: true only while no newer request has begun.
 */
export interface PollSequence {
  begin: () => () => boolean;
}

export function createPollSequence(): PollSequence {
  let latest = 0;
  return {
    begin: () => {
      latest += 1;
      const mine = latest;
      return () => mine === latest;
    },
  };
}
