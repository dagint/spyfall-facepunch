# Features

Complete feature reference for the Spyfall project.

## Core Gameplay

### Real-Time Multiplayer
Players connect via a 4-letter room code. All game state is synchronized in real-time through Firebase Realtime Database. Players are identified by Firebase Anonymous Auth UIDs, so no account creation is required.

### 40 Built-In Locations
The game ships with 40 locations across two packs:

- **Classic Pack (30 locations)**: Airplane, Bank, Beach, Broadway Theater, Casino, Cathedral, Circus Tent, Corporate Party, Crusader Army, Day Spa, Embassy, Hospital, Hotel, Military Base, Movie Studio, Ocean Liner, Passenger Train, Pirate Ship, Polar Station, Police Station, Restaurant, School, Service Station, Space Station, Submarine, Supermarket, University, Amusement Park, Art Museum, Library
- **Tech Pack (10 locations)**: SOC (Security Operations Center), Data Center, Hacker Convention, Startup Incubator, Server Room, Tech Company Campus, Cybersecurity War Room, Cloud Provider HQ, AI Research Lab, Escape Room (Tech-Themed)

Each location has 8 unique roles that are randomly assigned to non-spy players.

### Voting System
Players can vote to accuse a suspect at any time during a round. A **simple majority** (ceil of playerCount / 2) is required to resolve the accusation. If the accused is the spy, players win. If not, the spy wins.

### Spy Location Guess
The spy can attempt to guess the location at any time. A correct guess wins the game for the spy immediately. An incorrect guess wins the game for the players.

---

## Game Modes

### Hacker Mode
Gives the spy a hint about the location. Two hint types are available:
- **First Letter**: Shows the first letter of the location name
- **Category**: Shows whether the location is from the Classic or Tech pack

### Double Agent Mode
Adds a second spy (requires 5+ players). Neither spy knows the other spy's identity. Both spies must be caught for the players to win.

### Incident Response Mode
Replaces the countdown timer with a progress bar that fills each round. Wrong accusations accelerate the bar. The spy wins when it hits 100%.

### Custom Locations
Host can create custom locations with names and roles via the lobby UI. Custom locations are added to the random selection pool for the game.

See [GAME-MODES.md](GAME-MODES.md) for detailed rules and strategies.

---

## Cosmetic & UX Features

### NATO / Hacker Codenames
Each player is assigned a unique codename at the start of each round:
- **Classic/All packs**: NATO alphabet codenames (Alpha, Bravo, Charlie, ...)
- **Tech pack**: Hacker-themed codenames

Codenames are displayed alongside player names during gameplay and in the results screen.

### Question Prompt Suggestions
During gameplay, players can tap a button to receive a random question prompt suggestion. These are general-purpose questions designed to help players who are unsure what to ask, keeping the game moving without stalling.

### Classify / Declassify Reveal Animation
When a game ends and results are shown, a "CLASSIFIED" / "DECLASSIFIED" animation plays as the location, spy identity, and roles are revealed. This adds thematic flair to the reveal moment.

### Procedural Sound Effects
All sound effects are generated procedurally using the Web Audio API -- no audio files are loaded. Sounds include:
- Player join/leave
- Vote submitted
- Game start
- Reveal / declassify
- Win / lose stings

#### Mute Toggle
A mute button in the UI disables all sound effects. The preference is persisted to `localStorage` so it survives page reloads.

### Post-Game Debrief Timeline
After each game, the results screen includes a timeline of key events styled as an **incident post-mortem**. Events (questions asked, votes cast, accusations made) are logged to Firebase during the game and displayed chronologically in the debrief.

### Terminal Theme
A toggle switches the entire UI to a green-on-black CRT terminal aesthetic:
- Monospace font (JetBrains Mono)
- Green text on black background
- Scanline / flicker effects via CSS

The theme preference is persisted and applied on page load via `src/ui/theme.js`.

---

## Achievements

10 achievement badges are tracked per player in `localStorage`. Achievements are checked at the end of each game based on cumulative stats.

| Badge | Name | Description | Condition |
| --- | --- | --- | --- |
| 🎭 | Social Engineer | Win 3 games as the spy | `spyWins >= 3` |
| 🔍 | Threat Hunter | Catch the spy on the first vote | `firstVoteCatch >= 1` |
| ⚡ | Zero Day | Guess the location as spy in under 60 seconds | `fastSpyGuess >= 1` |
| 🛡 | Incident Commander | Play 10 games | `gamesPlayed >= 10` |
| 🕴 | Double Agent | Win 5 games as spy and 5 as player | `spyWins >= 5 && playerWins >= 5` |
| 🎣 | Phishing Expert | Win by spy guess 3 times | `spyGuessWins >= 3` |
| 🚨 | Blue Team | Catch the spy 5 times | `spyCatches >= 5` |
| ⏰ | Persistence | Survive as spy when time runs out 3 times | `timeoutWins >= 3` |
| 🌟 | Rookie Agent | Play your first game | `gamesPlayed >= 1` |
| 🎖 | Veteran Operative | Play 25 games | `gamesPlayed >= 25` |

### Tracked Stats
The following stats are accumulated across games and stored in `localStorage`:

- `gamesPlayed` -- total games completed
- `spyWins` -- games won as the spy
- `playerWins` -- games won as a non-spy player
- `spyGuessWins` -- games won by correctly guessing the location as spy
- `spyCatches` -- times the player helped vote out the spy
- `firstVoteCatch` -- times the spy was caught on the first vote round
- `fastSpyGuess` -- times the spy guessed correctly in under 60 seconds
- `timeoutWins` -- times the spy won by running out the timer

---

## Settings Reference

Settings are configured by the host in the lobby screen before starting a game.

| Setting | Values | Default | Description |
| --- | --- | --- | --- |
| Location Pack | Classic, Tech, All | All | Which location pool to draw from |
| Round Duration | 60s - 600s | 480s (8 min) | Countdown timer length (standard mode) |
| Hacker Mode | On / Off | Off | Give the spy a hint |
| Hint Type | First Letter / Category | First Letter | Type of hint (only shown when Hacker Mode is on) |
| Double Agent | On / Off | Off | Two spies (requires 5+ players) |
| Incident Response Mode | On / Off | Off | Replace timer with progress bar |
| Terminal Theme | On / Off | Off | Green-on-black CRT aesthetic |
| Sound Effects | On / Off | On | Procedural audio via Web Audio API |
