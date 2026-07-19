# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: Next.js version

Uses **Next.js 16.2.10** with **React 19** and **Tailwind CSS v4** — all newer than most training data and with breaking changes. Before writing framework/routing/config code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`). Do not assume APIs from older Next.js.

## Commands

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet.

## Architecture

App Router project. Current `app/` holds only the default scaffold (`layout.tsx`, `page.tsx`, `globals.css`) — the real product is not built yet.

- **Tailwind v4**: no `tailwind.config.*`. Theme tokens live in `app/globals.css` via `@import "tailwindcss"` + `@theme inline {}`. PostCSS plugin is `@tailwindcss/postcss`.
- **Path alias**: `@/*` → repo root.

## Product & design mockups

Arcade Vault (Spanish-language) is an online arcade platform where users play games and compete for high scores. `resources/templates/` contains standalone browser-React prototype mockups (global-script React, hash routing, `localStorage`) — **design references, not the app itself**. Port these screens into the App Router:

- `biblioteca` → Library (game grid)
- `detalle` → Game detail
- `reproductor`/`player` → Game player + score submission
- `salon` → Hall of Fame (leaderboard)
- `auth` → Login
- `nav`/`app` → nav shell + routing/state (user, scores)

`styles.css` there defines the neon-arcade visual language to reproduce.

## Workflow

Project follows Spec Driven Design via the `/spec` and `/spec-impl` skills (Klerith/fernando-skills). Use them for new features.
