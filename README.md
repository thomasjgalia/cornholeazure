# Cornhole Tournament Manager

A double-elimination bracket tournament management system for cornhole events.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn/ui components
- **Backend:** Supabase (PostgreSQL)
- **Routing:** React Router v6
- **Deployment:** Vercel (planned)

## Features

- Player management (CRUD operations)
- Event creation with configurable champion bye option
- Team formation (2 players per team)
- Dynamic double-elimination bracket generation
  - Supports any number of teams (minimum 2)
  - Automatic bye distribution
  - Optional reigning champion bye
- Card-based bracket visualization
- Match result tracking
- Bracket progression automation

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in the Supabase SQL Editor
3. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

4. Fill in your Supabase credentials in `.env`:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5174`

### 4. Build for Production

```bash
npm run build
```

## Project Structure

```
/src
  /components
    /ui           # Reusable UI components (Button, Card, Dialog, etc.)
  /hooks          # Custom React hooks for data operations
  /lib            # Supabase client and utilities
  /pages          # Route pages
  /utils          # Helper functions (bracket generation, etc.)
  /types.ts       # TypeScript type definitions
  App.tsx         # Main layout component
  main.tsx        # App entry point
```

## Database Schema

### Tables

- **players**: Player information (first_name, last_name)
- **events**: Tournament events (name, date, champion_gets_bye)
- **event_teams**: Teams per event (2 players, optional champion flag)
- **event_matches**: Bracket matches (round, teams, winner, bye flag)

### Key Constraints

- Teams must have 2 different players
- Only one reigning champion per event
- Cascade delete when event is deleted

## Development Status

✅ Project structure and configuration
✅ Database schema
⏳ Player management
⏳ Event management
⏳ Team formation
⏳ Bracket generation algorithm
⏳ Bracket visualization
⏳ Match result entry

## Next Steps

1. Implement player CRUD operations
2. Implement event CRUD operations
3. Build team formation interface
4. Develop bracket generation algorithm
5. Create bracket visualization UI
6. Implement match result tracking
7. Test with various team counts (4-10 teams)
8. Deploy to Vercel
