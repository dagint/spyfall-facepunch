import { describe, it, expect } from 'vitest';
import { checkMajority, pickLocation, pickSpy, pickSpies, assignRoles, generateSpyHint, buildExfiltrationState, buildGameState } from './engine.js';

describe('checkMajority', () => {
  it('returns false when no votes', () => {
    expect(checkMajority(null, 5)).toEqual({ reached: false, target: null, count: 0 });
    expect(checkMajority({}, 5)).toEqual({ reached: false, target: null, count: 0 });
  });

  it('returns false when no majority', () => {
    const votes = { u1: 'u3', u2: 'u4' };
    const result = checkMajority(votes, 4);
    expect(result.reached).toBe(false);
  });

  it('detects majority with even player count', () => {
    // 4 players, majority = ceil(4/2) = 2
    const votes = { u1: 'u3', u2: 'u3' };
    const result = checkMajority(votes, 4);
    expect(result.reached).toBe(true);
    expect(result.target).toBe('u3');
    expect(result.count).toBe(2);
  });

  it('detects majority with odd player count', () => {
    // 5 players, majority = ceil(5/2) = 3
    const votes = { u1: 'u3', u2: 'u3', u4: 'u3' };
    const result = checkMajority(votes, 5);
    expect(result.reached).toBe(true);
    expect(result.target).toBe('u3');
    expect(result.count).toBe(3);
  });

  it('requires strict majority (not just plurality)', () => {
    // 5 players, majority = 3; 2 votes is not enough
    const votes = { u1: 'u3', u2: 'u3' };
    const result = checkMajority(votes, 5);
    expect(result.reached).toBe(false);
  });
});

describe('pickLocation', () => {
  it('returns a location with index', () => {
    const { index, location } = pickLocation('all');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(location).toBeDefined();
    expect(location.name).toBeTruthy();
  });

  it('filters by pack', () => {
    for (let i = 0; i < 20; i++) {
      const { location } = pickLocation('tech');
      expect(location.pack).toBe('tech');
    }
  });

  it('includes custom locations', () => {
    const custom = [{ name: 'Test Location', pack: 'custom', roles: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'] }];
    // Run enough times to statistically guarantee the custom location is hit
    let foundCustom = false;
    for (let i = 0; i < 1000; i++) {
      const { index, location } = pickLocation('all', custom);
      if (location.name === 'Test Location') {
        expect(index).toBe(-1);
        foundCustom = true;
        break;
      }
    }
    expect(foundCustom).toBe(true);
  });
});

describe('pickSpy', () => {
  it('returns a UID from the list', () => {
    const uids = ['a', 'b', 'c', 'd'];
    const spy = pickSpy(uids);
    expect(uids).toContain(spy);
  });
});

describe('pickSpies', () => {
  it('returns requested number of spies', () => {
    const uids = ['a', 'b', 'c', 'd', 'e'];
    const spies = pickSpies(uids, 2);
    expect(spies).toHaveLength(2);
    expect(new Set(spies).size).toBe(2); // unique
    spies.forEach((s) => expect(uids).toContain(s));
  });
});

describe('assignRoles', () => {
  it('assigns role indices to non-spy players', () => {
    const uids = ['a', 'b', 'c', 'd'];
    const roles = assignRoles(uids, 'a');
    expect(roles['a']).toBeNull(); // spy gets null
    expect(roles['b']).toBeGreaterThanOrEqual(0);
    expect(roles['c']).toBeGreaterThanOrEqual(0);
    expect(roles['d']).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple spies', () => {
    const uids = ['a', 'b', 'c', 'd', 'e'];
    const roles = assignRoles(uids, ['a', 'b']);
    expect(roles['a']).toBeNull();
    expect(roles['b']).toBeNull();
    expect(roles['c']).toBeGreaterThanOrEqual(0);
  });
});

describe('generateSpyHint', () => {
  it('generates letter hint', () => {
    const hint = generateSpyHint({ name: 'Hospital', pack: 'classic' }, 'letter');
    expect(hint).toBe('First letter: "H"');
  });

  it('generates category hint', () => {
    const hint = generateSpyHint({ name: 'SOC', pack: 'tech' }, 'category');
    expect(hint).toContain('Category:');
  });
});

describe('buildExfiltrationState', () => {
  it('creates valid exfiltration state', () => {
    const state = buildExfiltrationState(6);
    expect(state.progress).toBe(0);
    expect(state.roundNumber).toBe(0);
    expect(state.incrementPerRound).toBe(10); // floor(60/6) = 10
    expect(state.voteBoost).toBe(15);
  });

  it('clamps increment to minimum of 8', () => {
    const state = buildExfiltrationState(12);
    expect(state.incrementPerRound).toBe(8); // max(8, floor(60/12)=5) = 8
  });
});

describe('buildGameState', () => {
  const playerUids = ['u1', 'u2', 'u3', 'u4'];
  const baseSettings = {
    pack: 'all',
    durationSec: 480,
    hackerMode: false,
    hackerHintType: 'letter',
    doubleAgent: false,
    incidentMode: false,
    customLocations: [],
  };

  it('creates valid game state', () => {
    const { publicGame, secrets, playerRoles } = buildGameState(playerUids, baseSettings);

    expect(publicGame.durationSec).toBe(480);
    expect(publicGame.startedAt).toBeGreaterThan(0);
    expect(publicGame.votes).toBeNull();
    expect(publicGame.result).toBeNull();

    expect(secrets.spyId).toBeTruthy();
    expect(playerUids).toContain(secrets.spyId);
    expect(secrets.location.name).toBeTruthy();

    // Each player gets role data
    playerUids.forEach((uid) => {
      expect(playerRoles[uid]).toBeDefined();
      if (uid === secrets.spyId) {
        expect(playerRoles[uid].isSpy).toBe(true);
        expect(playerRoles[uid].location).toBeNull();
      } else {
        expect(playerRoles[uid].isSpy).toBe(false);
        expect(playerRoles[uid].location.name).toBeTruthy();
      }
    });
  });

  it('enables double agent with 5+ players', () => {
    const uids = ['u1', 'u2', 'u3', 'u4', 'u5'];
    const { secrets, playerRoles } = buildGameState(uids, { ...baseSettings, doubleAgent: true });

    expect(secrets.spyIds).toBeTruthy();
    const spyUids = Object.keys(secrets.spyIds);
    expect(spyUids).toHaveLength(2);

    spyUids.forEach((uid) => {
      expect(playerRoles[uid].isSpy).toBe(true);
    });
  });

  it('enables incident mode', () => {
    const { publicGame } = buildGameState(playerUids, { ...baseSettings, incidentMode: true });
    expect(publicGame.durationSec).toBeNull();
    expect(publicGame.exfiltration).toBeTruthy();
    expect(publicGame.exfiltration.progress).toBe(0);
  });

  it('enables hacker mode with spy hint', () => {
    const { playerRoles, secrets } = buildGameState(playerUids, { ...baseSettings, hackerMode: true, hackerHintType: 'letter' });
    const spyRole = playerRoles[secrets.spyId];
    expect(spyRole.spyHint).toBeTruthy();
    expect(spyRole.spyHint).toContain('First letter');
  });
});
