# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-26

### Added

- Base Spyfall game with full multiplayer game flow via Firebase Realtime Database
- 40 built-in locations across Classic (30) and Tech/Security (10) packs, each with 8 unique roles
- Firebase Anonymous Authentication for zero-friction player identity
- Real-time room synchronization with presence detection (connected/disconnected)
- Hash-based SPA router with 5 screens: Home, Lobby, Game, Results, Rules
- Majority vote accusation system with real-time vote tracking
- Spy location guess mechanic with immediate resolution
- Configurable round duration (60s-600s)
- Question prompt suggestions during gameplay to keep rounds flowing
- NATO and Hacker codename assignment for players each round
- Classify/Declassify reveal animation on the results screen
- Procedural sound effects via Web Audio API (join, vote, reveal, win/lose)
- Mute toggle for sound effects, persisted to localStorage
- Post-game debrief timeline styled as an incident post-mortem
- 10 achievement badges tracked per player in localStorage
- Hacker Mode: spy receives a hint (first letter of location or category)
- Double Agent Mode: two spies who do not know each other (5+ players)
- Custom location pack builder in the lobby UI
- Incident Response Mode: progress bar replaces timer, wrong votes accelerate exfiltration
- Terminal theme toggle (green-on-black CRT aesthetic with JetBrains Mono)
- Firebase Realtime Database security rules with host-only write restrictions
- Session recovery via sessionStorage (rejoin room on page refresh)
- Netlify deployment support with SPA redirects
- Mobile-first responsive design optimized for phones
