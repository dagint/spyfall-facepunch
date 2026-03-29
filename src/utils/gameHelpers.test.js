import { describe, it, expect } from 'vitest';
import { isSpy, getSpyUids } from './gameHelpers.js';

describe('isSpy', () => {
  it('returns false for null/undefined', () => {
    expect(isSpy(null, {})).toBe(false);
    expect(isSpy('u1', null)).toBe(false);
  });

  it('detects spy via spyId', () => {
    expect(isSpy('u1', { spyId: 'u1' })).toBe(true);
    expect(isSpy('u2', { spyId: 'u1' })).toBe(false);
  });

  it('detects spy via spyIds (double agent)', () => {
    const data = { spyIds: { u1: true, u2: true } };
    expect(isSpy('u1', data)).toBe(true);
    expect(isSpy('u2', data)).toBe(true);
    expect(isSpy('u3', data)).toBe(false);
  });
});

describe('getSpyUids', () => {
  it('returns empty for null', () => {
    expect(getSpyUids(null)).toEqual([]);
  });

  it('returns single spy', () => {
    expect(getSpyUids({ spyId: 'u1' })).toEqual(['u1']);
  });

  it('returns multiple spies from spyIds', () => {
    const uids = getSpyUids({ spyIds: { u1: true, u3: true } });
    expect(uids).toHaveLength(2);
    expect(uids).toContain('u1');
    expect(uids).toContain('u3');
  });

  it('prefers spyIds over spyId', () => {
    const uids = getSpyUids({ spyId: 'u1', spyIds: { u2: true, u3: true } });
    expect(uids).toEqual(['u2', 'u3']);
  });
});
