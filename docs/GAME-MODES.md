# Game Modes

Detailed documentation for each game mode in Spyfall.

## Standard Mode

The base Spyfall experience.

### Setup
- 3-10 players join a room via a shared 4-letter room code
- The host selects a location pack (Classic, Tech, or All) and a round duration
- One player is secretly assigned as the **spy**; all others receive the **location** and a unique **role**

### Gameplay
1. The spy does **not** know the location. Everyone else does.
2. Players take turns asking each other questions to figure out who the spy is -- without revealing the location to the spy.
3. The spy tries to blend in, gather clues from the questions, and figure out the location.
4. At any time, players can call a **vote** to accuse someone of being the spy.
5. At any time, the spy can attempt to **guess the location**.

### Win Conditions
| Outcome | Winner |
| --- | --- |
| Players vote out the spy (majority vote) | **Players win** |
| Players vote out a non-spy | **Spy wins** |
| Spy correctly guesses the location | **Spy wins** |
| Timer runs out without a vote | **Spy wins** |

### Tips
- Ask questions specific enough to prove you know the location, but vague enough that the spy cannot deduce it.
- Pay attention to who gives overly generic answers.
- The spy should ask questions that could apply to many locations to avoid suspicion.

---

## Hacker Mode

An accessibility modifier that gives the spy a small advantage. Recommended for new players or groups where the spy wins rarely.

### How It Works
- When Hacker Mode is enabled in the lobby settings, the spy receives a **hint** about the location.
- The host chooses the hint type:
  - **First Letter** -- The spy sees the first letter of the location name (e.g., `First letter: "A"` for Airplane).
  - **Category** -- The spy sees the location's pack (e.g., `Category: Classic` or `Category: Tech/Security`).

### Strategy Adjustments
- The spy has a meaningful advantage, so players should be more cautious with their questions.
- With the first letter hint, the spy can narrow down locations significantly -- players should vary their question topics.
- With the category hint, the spy knows whether the location is classic or tech-themed, which eliminates roughly half the possibilities.

### Settings
- **Hacker Mode**: On/Off (toggle in lobby)
- **Hint Type**: First Letter / Category (dropdown, visible when Hacker Mode is on)

---

## Double Agent Mode

A variant for larger groups that adds a second spy.

### How It Works
- Requires **5 or more players** (the toggle is disabled with fewer).
- Two players are assigned as spies instead of one.
- **Spies do not know each other's identity.** Each spy only knows they are a spy -- they do not know who the other spy is.

### Gameplay Changes
- With two spies, the odds of accidentally voting out a non-spy are higher.
- Spies may unknowingly help or hinder each other with their questions.
- A majority vote accusation still targets one player at a time. If a non-spy is voted out, both spies win.

### Win Conditions
| Outcome | Winner |
| --- | --- |
| Players vote out **both** spies | **Players win** |
| Players vote out a non-spy | **Spies win** |
| Either spy correctly guesses the location | **Spies win** |
| Timer runs out | **Spies win** |

### Strategy
- Players need to be more certain before voting -- a wrong accusation ends the game immediately.
- The two spies may give conflicting vague answers, which can be a tell for observant players.
- Spies should pay close attention to who else seems unsure about the location.

---

## Incident Response Mode

A tension-building alternative to the standard timer that replaces the countdown clock with an escalating progress bar.

### How It Works
- Instead of a fixed timer, a **data exfiltration progress bar** fills up over the course of the game.
- The progress bar advances automatically each **round** (each cycle of questions).
- A wrong accusation (voting out a non-spy) causes a **boost** to the progress bar (+15%).
- When the progress bar reaches **100%**, the spy wins -- the "data exfiltration" is complete.

### Mechanics
- The `durationSec` field is set to `null` -- there is no countdown timer.
- Progress increment per round is calculated as `max(8, floor(60 / playerCount))`:
  - 3 players: +20% per round
  - 5 players: +12% per round
  - 8 players: +8% per round
- Wrong vote boost: +15% (configurable in engine)
- The spy can still guess the location at any time.

### UI
- The standard countdown timer is replaced with a horizontal progress bar labeled with incident response terminology (e.g., "Exfiltration Progress").
- The bar color transitions from green to yellow to red as it fills.

### Strategy
- Players feel increasing urgency as the bar fills, similar to a real incident response scenario.
- Wrong accusations are punished more severely than in standard mode, encouraging careful deliberation.
- The spy benefits from stalling and sowing doubt to drive up the bar.

---

## Custom Locations

The host can create and add custom location packs to supplement or replace the built-in locations.

### How It Works
1. In the lobby, the host opens the **Custom Locations** builder.
2. The host adds locations with:
   - A **name** (e.g., "Haunted Mansion")
   - A **pack** label (e.g., "custom")
   - Up to **8 roles** (e.g., "Ghost", "Caretaker", "Visitor", ...)
3. Custom locations are saved to the Firebase room under `/customLocations`.
4. When the game starts, custom locations are included in the random selection pool alongside the chosen built-in pack.

### Notes
- Custom locations are scoped to the room -- they are not persisted across sessions.
- If a custom location is selected, the `locationIndex` in the game state is set to `-1`, and the full location object is stored inline.
- Roles should be distinct and evocative to make gameplay interesting. Aim for 6-8 roles per location.

### Example Custom Location

```
Name: Secret Underground Lab
Pack: custom
Roles:
  1. Mad Scientist
  2. Lab Assistant
  3. Security Guard
  4. Test Subject
  5. Government Inspector
  6. Janitor
  7. IT Administrator
  8. Delivery Driver
```
