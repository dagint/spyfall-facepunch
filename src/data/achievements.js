/**
 * Achievement definitions.
 * Each has an id, name, description, icon (emoji), and a check function.
 */
export const ACHIEVEMENTS = [
  {
    id: 'social_engineer',
    name: 'Social Engineer',
    desc: 'Win 3 games as the spy',
    icon: '\u{1F3AD}',
    check: (stats) => stats.spyWins >= 3,
  },
  {
    id: 'threat_hunter',
    name: 'Threat Hunter',
    desc: 'Catch the spy on the first vote',
    icon: '\u{1F50D}',
    check: (stats) => stats.firstVoteCatch >= 1,
  },
  {
    id: 'zero_day',
    name: 'Zero Day',
    desc: 'Guess the location as spy in under 60 seconds',
    icon: '\u{26A1}',
    check: (stats) => stats.fastSpyGuess >= 1,
  },
  {
    id: 'incident_commander',
    name: 'Incident Commander',
    desc: 'Play 10 games',
    icon: '\u{1F6E1}',
    check: (stats) => stats.gamesPlayed >= 10,
  },
  {
    id: 'double_agent',
    name: 'Double Agent',
    desc: 'Win 5 games as spy and 5 as player',
    icon: '\u{1F574}',
    check: (stats) => stats.spyWins >= 5 && stats.playerWins >= 5,
  },
  {
    id: 'phishing_expert',
    name: 'Phishing Expert',
    desc: 'Win by spy guess 3 times',
    icon: '\u{1F3A3}',
    check: (stats) => stats.spyGuessWins >= 3,
  },
  {
    id: 'blue_team',
    name: 'Blue Team',
    desc: 'Catch the spy 5 times',
    icon: '\u{1F6A8}',
    check: (stats) => stats.spyCatches >= 5,
  },
  {
    id: 'persistence',
    name: 'Persistence',
    desc: 'Survive as spy when time runs out 3 times',
    icon: '\u{23F0}',
    check: (stats) => stats.timeoutWins >= 3,
  },
  {
    id: 'rookie',
    name: 'Rookie Agent',
    desc: 'Play your first game',
    icon: '\u{1F31F}',
    check: (stats) => stats.gamesPlayed >= 1,
  },
  {
    id: 'veteran',
    name: 'Veteran Operative',
    desc: 'Play 25 games',
    icon: '\u{1F396}',
    check: (stats) => stats.gamesPlayed >= 25,
  },
];
