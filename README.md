# Rero — Speak · Learn · Grow

Rero is a private, ad-free speaking diary and expression-learning web app starter built with React, TypeScript, and Vite.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL shown by Vite, usually http://localhost:5173.

## Verify
```bash
npm run build
npm run lint
```

## Features
- Responsive lavender dashboard and dark theme
- Speaking diary with browser speech recognition when supported
- Manual transcript editing and local persistence
- Timeline search and entry management
- Rule-based phrase matching and editable expression library
- Learning progress derived from local entries
- JSON export and additive import/restore
- Clear-data confirmation

## Privacy and limitations
Diary entries and expressions are stored in this browser's local storage. They are not automatically synced across devices. Export a JSON backup before clearing browser data or changing browser profiles. Browser speech recognition varies by browser and may require an internet connection; manual typing remains available. The app does not call a paid AI API and does not claim rule-based suggestions are AI-generated.

## Deploy
Build with `npm run build`. The production site is in `dist/`. It can be hosted on GitHub Pages, Netlify, or another static host. For GitHub Pages under a repository subpath, configure Vite's `base` to `/<repository-name>/` before building, or deploy to a root/custom domain.
