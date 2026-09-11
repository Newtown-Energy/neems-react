/**
 * Unit tests for latest-wins poll ordering.
 *
 * Run with `bun test src/utils/pollSequence.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import { createPollSequence } from './pollSequence';

describe('createPollSequence', () => {
  test('a lone request is current', () => {
    const isCurrent = createPollSequence().begin();
    expect(isCurrent()).toBe(true);
  });

  // The failure this guards: poll A is slow, poll B starts and answers, then A
  // fails. A must not get to mark the data stale.
  test('a request is superseded as soon as a newer one begins', () => {
    const sequence = createPollSequence();
    const a = sequence.begin();
    const b = sequence.begin();
    expect(a()).toBe(false);
    expect(b()).toBe(true);
  });

  // The newest request wins whether or not it finishes first.
  test('the newest request stays current however late it answers', () => {
    const sequence = createPollSequence();
    sequence.begin();
    const newest = sequence.begin();
    expect(newest()).toBe(true);
  });

  test('separate sequences do not interfere', () => {
    const a = createPollSequence().begin();
    createPollSequence().begin();
    expect(a()).toBe(true);
  });
});
