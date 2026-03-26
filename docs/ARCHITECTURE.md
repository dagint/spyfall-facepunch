# Architecture

Technical architecture documentation for the Spyfall project.

## System Overview

Spyfall is a **client-only single-page application (SPA)** with a serverless Firebase backend. There is no application server -- all game logic runs in the browser, and Firebase Realtime Database handles multiplayer synchronization.

```
┌─────────────────────────────────────────────────────┐
│                   Client (Browser)                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Router   │  │  State   │  │   UI (Screens +    │ │
│  │ (hash)    │──│  Store   │──│   Components)      │ │
│  └──────────┘  └────┬─────┘  └────────────────────┘ │
│                     │                                │
│  ┌──────────────────┴──────────────────────────────┐ │
│  │              Game Engine                         │ │
│  │  (location pick, role assignment, vote logic)    │ │
│  └──────────────────┬──────────────────────────────┘ │
│                     │                                │
│  ┌──────────────────┴──────────────────────────────┐ │
│  │           Firebase SDK (Client)                  │ │
│  │  Anonymous Auth  |  Realtime Database Listeners  │ │
│  └──────────────────┬──────────────────────────────┘ │
└─────────────────────┼───────────────────────────────┘
                      │ WebSocket
┌─────────────────────┴───────────────────────────────┐
│              Firebase (Google Cloud)                  │
│                                                      │
│  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ Anonymous Auth  │  │  Realtime Database          │  │
│  │ (uid per session│  │  /rooms/{code}/...          │  │
│  └────────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **No framework** -- Vanilla JS with manual DOM rendering keeps the bundle small and eliminates framework overhead for a game that redraws infrequently.
- **Firebase Anonymous Auth** -- Players do not need accounts. A UID is generated per browser session and used to identify players within a room.
- **Client-side game logic** -- The host's browser computes game state (spy selection, role assignment) and writes it to Firebase. Other clients receive it via real-time listeners. This avoids the need for Cloud Functions.
- **Hash-based routing** -- Simple `#hash` routing with no history API dependency, ensuring compatibility with static hosts like Netlify.

## Data Flow

### Room Creation

```
Host clicks "Create Room"
  → generateRoomCode()              [src/utils/roomCode.js]
  → signInAnonymously()             [Firebase Auth]
  → write /rooms/{code}/host = uid  [Firebase RTDB]
  → write /rooms/{code}/players/{uid} = { name, connected }
  → listenToRoom(code)              [src/game/listeners.js]
  → navigate('lobby')               [src/router.js]
```

### Joining a Room

```
Player enters room code
  → signInAnonymously()
  → write /rooms/{code}/players/{uid} = { name, connected }
  → listenToRoom(code)
  → navigate('lobby')
```

### Starting a Game

```
Host clicks "Start Game"
  → buildGameState(playerUids, settings)  [src/game/engine.js]
      → pickLocation(pack, customLocations)
      → pickSpy(playerUids)  or  pickSpies(playerUids, 2)
      → assignRoles(playerUids, spyUid, locationIndex)
      → assignCodenames(playerUids, style)
      → generateSpyHint() (if Hacker Mode)
      → buildExfiltrationState() (if Incident Mode)
  → write /rooms/{code}/game = gameState
  → write /rooms/{code}/phase = "playing"
```

### Voting / Accusation

```
Player votes for suspect
  → write /rooms/{code}/game/votes/{uid} = targetUid
  → all clients receive updated votes via onValue listener
  → checkMajority(votes, totalPlayers)
  → if majority reached → host resolves accusation
```

### Game End

```
Host writes /rooms/{code}/game/result = { winner, type, ... }
Host writes /rooms/{code}/phase = "results"
  → all clients navigate to results screen
  → processGameResult() checks achievements locally
```

## Firebase Database Schema

```
/rooms
  /{roomCode}                    # 4-letter uppercase room code
    /host: string                # UID of the room host
    /phase: string               # "lobby" | "playing" | "results"
    /settings: {
      pack: string               # "classic" | "tech" | "all"
      durationSec: number        # Round duration in seconds
      hackerMode: boolean        # Enable spy hints
      hackerHintType: string     # "letter" | "category"
      doubleAgent: boolean       # Enable two-spy mode
      incidentMode: boolean      # Enable incident response mode
    }
    /players
      /{uid}: {
        name: string
        connected: boolean
      }
    /customLocations: [          # Optional custom location array
      { name, pack, roles }
    ]
    /game: {                     # Only present during active game
      locationIndex: number      # Index into LOCATIONS array (-1 for custom)
      location: {
        name: string
        pack: string
        roles: string[8]
      }
      spyId: string              # Primary spy UID
      spyIds: { [uid]: true }    # Multiple spies (Double Agent mode, or null)
      roles: { [uid]: number }   # Player UID → role index (null for spy)
      codenames: { [uid]: string }
      durationSec: number|null   # null in Incident Response mode
      startedAt: number          # Timestamp (ms)
      spyHint: string|null       # Hacker Mode hint text
      exfiltration: {            # Incident Response mode state
        progress: number         # 0-100
        roundNumber: number
        incrementPerRound: number
        voteBoost: number
      } | null
      votes: { [uid]: string }   # Current round votes
      accusation: object|null
      spyGuess: object|null
      events: { [eventId]: ... } # Debrief timeline events
      result: {
        winner: string           # "spy" | "players"
        type: string             # "vote" | "guess" | "timeout"
        correct: boolean
        ...
      } | null
    }
```

### Security Rules

Security rules in `database.rules.json` enforce:

- All reads and writes require authentication (`auth != null`)
- Only the host can modify `settings`, `phase`, `game` (top-level), and `customLocations`
- Players can only write their own entry under `/players/{uid}`
- Players can only write their own vote under `/game/votes/{uid}`
- The spy (or any spy in Double Agent mode) can write `/game/spyGuess`
- Anyone authenticated can write to `/game/events` (debrief timeline)

## State Management

The app uses a minimal pub/sub state store in `src/game/state.js`:

```
setState(partial)  → merges into state → notifies all subscribers
getState()         → returns current state snapshot
subscribe(fn)      → registers a callback, returns unsubscribe function
```

### State Shape

```js
{
  uid: string,          // Firebase anonymous UID
  playerName: string,   // Display name
  roomCode: string,     // Current room code
  room: {               // Full room object from Firebase (live-synced)
    host, phase, settings, players, game, customLocations
  }
}
```

### Data Flow Pattern

1. Firebase `onValue` listener receives room updates
2. `setState({ room })` is called with the new data
3. All subscribed screen render functions re-execute
4. Screens read state via `getState()`, `getPlayers()`, `getGameData()`, etc.

This is intentionally simple -- no reducers, no actions, no middleware. The entire room state is replaced on each Firebase update.

## Routing

Hash-based SPA router in `src/router.js`:

| Hash        | Screen         | File                        |
| ----------- | -------------- | --------------------------- |
| `#home`     | Home           | `src/ui/screens/home.js`    |
| `#lobby`    | Lobby          | `src/ui/screens/lobby.js`   |
| `#game`     | Active Game    | `src/ui/screens/game.js`    |
| `#results`  | Results        | `src/ui/screens/results.js` |
| `#rules`    | How to Play    | `src/ui/screens/rules.js`   |

Each route handler receives a `container` element and optional `params`, renders into it, and optionally returns a cleanup function for teardown (removing listeners, clearing timers, etc.).

Navigation is triggered by:
- `navigate(name, params)` -- programmatic navigation
- `hashchange` event -- browser back/forward

## Module Responsibilities

### `src/firebase.js`
Firebase app initialization, anonymous auth, and re-exports of all Realtime Database functions. Single point of configuration.

### `src/game/engine.js`
Pure game logic functions: location selection, spy picking, role assignment, codename assignment, hint generation, exfiltration state, majority vote checking. No side effects.

### `src/game/actions.js`
Firebase write operations: creating rooms, joining rooms, starting games, submitting votes, spy guesses, and resolving game results. The "command" layer.

### `src/game/listeners.js`
Firebase `onValue` subscriptions that sync remote room state into the local state store. Manages connection/disconnection presence.

### `src/game/state.js`
Local reactive state with pub/sub. No persistence -- state is ephemeral per session (room code is saved in `sessionStorage` for tab refresh recovery).

### `src/game/achievements.js`
Processes game results against achievement definitions. Reads/writes `localStorage` keyed by UID.

### `src/ui/screens/*.js`
Screen render functions. Each is a self-contained module that builds DOM, subscribes to state, and returns a cleanup function.

### `src/ui/components.js`
Shared UI building blocks (buttons, cards, modals, badges) used across screens.

### `src/ui/theme.js`
Terminal theme toggle. Applies/removes a CSS class to the document root that activates green-on-black CRT styling.

### `src/audio/sounds.js`
Web Audio API procedural sound synthesis. Generates game sounds (join, vote, reveal, win/lose) without audio files. Includes a mute toggle persisted to `localStorage`.

### `src/data/locations.js`
Static array of 40 location definitions (30 classic + 10 tech/security), each with a name, pack identifier, and 8 roles.

### `src/data/codenames.js`
NATO alphabet and hacker-themed codename pools. Assigns a unique codename to each player per round.

### `src/data/prompts.js`
Question prompt suggestions displayed during gameplay to help players formulate questions.

### `src/data/achievements.js`
Achievement definitions with id, name, description, icon, and a `check(stats)` predicate function.

### `src/utils/roomCode.js`
Generates random 4-letter uppercase room codes.

### `src/utils/timer.js`
Countdown timer utility used during gameplay rounds.
