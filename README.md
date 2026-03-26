# Spyfall

A multiplayer social deduction party game where players try to identify the spy among them -- built with vanilla JavaScript, Vite, Tailwind CSS 4, and Firebase Realtime Database.

![Screenshot placeholder](docs/screenshot-placeholder.png)

## Features

- **40 locations** across Classic and Tech/Security packs, each with 8 unique roles
- **Real-time multiplayer** via Firebase Realtime Database with anonymous authentication
- **Multiple game modes** -- Hacker Mode, Double Agent, Incident Response Mode
- **Custom location pack builder** -- create and share your own locations
- **NATO/Hacker codenames** assigned to players each round
- **Question prompt suggestions** to keep gameplay flowing
- **Classify/Declassify reveal animation** on game results
- **Procedural sound effects** with mute toggle (Web Audio API)
- **Post-game debrief timeline** styled as an incident post-mortem
- **10 achievement badges** tracked locally per player
- **Terminal theme** -- green-on-black CRT aesthetic toggle
- **Mobile-first responsive design** -- optimized for phones passed around a table

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Firebase project with Realtime Database and Anonymous Authentication enabled

### Install

```bash
git clone https://github.com/your-username/spyfall-facepunchme.git
cd spyfall-facepunchme
npm install
```

### Configure Firebase

Create a `.env` file in the project root with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

Output is written to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Deployment (Netlify)

The project includes a `public/_redirects` file for Netlify SPA routing.

1. Connect your repository to Netlify
2. Set the build command to `npm run build`
3. Set the publish directory to `dist`
4. Add all `VITE_FIREBASE_*` environment variables in the Netlify dashboard
5. Deploy

## Tech Stack

| Layer         | Technology                                      |
| ------------- | ----------------------------------------------- |
| Runtime       | Vanilla JavaScript (ES modules, no framework)   |
| Bundler       | Vite 8                                          |
| Styling       | Tailwind CSS 4.2 (via `@tailwindcss/vite`)      |
| Backend       | Firebase 12.11 (Realtime Database + Anonymous Auth) |
| Audio         | Web Audio API (procedural synthesis)             |
| Fonts         | Inter, JetBrains Mono (Google Fonts)             |
| Hosting       | Netlify (static)                                 |

## Project Structure

```
spyfall-facepunchme/
├── index.html                  # Entry HTML
├── vite.config.js              # Vite + Tailwind plugin config
├── firebase.json               # Firebase emulator config
├── database.rules.json         # Realtime Database security rules
├── package.json
├── public/
│   ├── _redirects              # Netlify SPA redirect
│   └── favicon.svg
├── src/
│   ├── main.js                 # App bootstrap, route registration
│   ├── router.js               # Hash-based SPA router
│   ├── firebase.js             # Firebase init, auth, DB exports
│   ├── styles.css              # Tailwind imports + custom styles
│   ├── audio/
│   │   └── sounds.js           # Web Audio API procedural sound effects
│   ├── data/
│   │   ├── locations.js        # 40 locations (classic + tech packs)
│   │   ├── achievements.js     # 10 achievement definitions
│   │   ├── codenames.js        # NATO & hacker codename pools
│   │   └── prompts.js          # Question prompt suggestions
│   ├── game/
│   │   ├── state.js            # Reactive local state store
│   │   ├── engine.js           # Game logic (location pick, roles, hints)
│   │   ├── actions.js          # Firebase write actions (create, vote, etc.)
│   │   ├── listeners.js        # Firebase real-time listeners
│   │   └── achievements.js     # Achievement processing & localStorage
│   ├── ui/
│   │   ├── components.js       # Shared UI components
│   │   ├── theme.js            # Terminal theme toggle
│   │   └── screens/
│   │       ├── home.js         # Landing / join / create room
│   │       ├── lobby.js        # Pre-game lobby & settings
│   │       ├── game.js         # Active gameplay screen
│   │       ├── results.js      # Post-game results & debrief
│   │       └── rules.js        # How to play
│   └── utils/
│       ├── roomCode.js         # Room code generation
│       └── timer.js            # Countdown timer utility
└── dist/                       # Production build output
```

## Game Modes

| Mode                   | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| **Standard**           | One spy, timed rounds, majority vote to accuse                      |
| **Hacker Mode**        | Spy receives a hint (first letter of location or category)          |
| **Double Agent**       | Two spies who do not know each other's identity (5+ players)        |
| **Incident Response**  | No timer -- a progress bar fills each round; spy wins when it hits 100% |
| **Custom Locations**   | Host can create and add custom location packs to the game           |

See [docs/GAME-MODES.md](docs/GAME-MODES.md) for detailed rules and strategies.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) -- system design, data flow, Firebase schema
- [Game Modes](docs/GAME-MODES.md) -- detailed mode rules and strategies
- [Features](docs/FEATURES.md) -- full feature reference, settings, achievements
- [Changelog](CHANGELOG.md) -- version history

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run the dev server and test manually (`npm run dev`)
5. Commit your changes (`git commit -m "Add my feature"`)
6. Push to your branch (`git push origin feature/my-feature`)
7. Open a Pull Request

### Development Notes

- No build-time framework -- all UI is rendered via vanilla JS DOM manipulation
- State lives in `src/game/state.js` with a simple pub/sub model
- Routes are hash-based (`#home`, `#lobby`, `#game`, `#results`, `#rules`)
- Firebase config is loaded from environment variables (`VITE_FIREBASE_*`)

## License

This project is licensed under the [MIT License](LICENSE).
