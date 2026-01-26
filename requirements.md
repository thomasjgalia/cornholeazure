Updated Requirements Document: Cornhole Tournament AppProject Overview
A web application for managing double-elimination cornhole tournaments with team-based play, built using the same tech stack as your golf tournament app.Tech Stack

Frontend Framework: Next.js with React
Language: TypeScript
Styling: Tailwind CSS
Backend/Database: Supabase (PostgreSQL)
Deployment: Vercel
Authentication: Supabase Auth (if needed)
Database SchemaTablesplayers

id (uuid, PK, auto-generated)
first_name (text, required)
last_name (text, required)
created_at (timestamp, default now())
events

id (uuid, PK, auto-generated)
name (text, required)
date (date, required)
champion_gets_bye (boolean, default true) - whether reigning champion receives first round bye
created_at (timestamp, default now())
event_teams

id (uuid, PK, auto-generated)
event_id (uuid, FK → events.id, on delete cascade)
player1_id (uuid, FK → players.id)
player2_id (uuid, FK → players.id)
is_reigning_champion (boolean, default false)
created_at (timestamp, default now())
event_matches

id (uuid, PK, auto-generated)
event_id (uuid, FK → events.id, on delete cascade)
round (integer) - positive for Winners Bracket, negative for Losers Bracket
match_number (integer) - for ordering within rounds
team1_id (uuid, FK → event_teams.id, nullable)
team2_id (uuid, FK → event_teams.id, nullable)
winner_id (uuid, FK → event_teams.id, nullable)
loser_id (uuid, FK → event_teams.id, nullable)
is_bye (boolean, default false) - indicates if this is a bye match
created_at (timestamp, default now())
Indexes

event_teams.event_id
event_teams.player1_id
event_teams.player2_id
event_matches.event_id
event_matches.team1_id
event_matches.team2_id
Constraints

Unique constraint on event_teams(event_id, player1_id, player2_id) to prevent duplicate teams
Check constraint: player1_id != player2_id on event_teams
Only one is_reigning_champion = true per event_id
Core Features1. Player Management

Create new players with first and last names
View all players (sorted alphabetically by last name, then first name)
Edit player information
Delete players (with cascade considerations)
Search/filter players
2. Event Management

Create new events with name and date
Configure whether reigning champion receives a bye
View all events (sorted by date, most recent first)
View event details
Edit event information
Delete events (cascades to teams and matches)
3. Team Formation

Create teams for a specific event
Select two players per team
Designate reigning champion team (only one per event)
View all teams for an event
Edit team composition
Remove teams from event
4. Bracket Management

Generate double-elimination bracket supporting ANY number of teams (minimum 2)
Handle both even and odd number of teams (4, 5, 6, 7, 8, etc.)
Intelligently place byes to balance the bracket
Option to give reigning champion a first-round bye (configurable per event)
Display Winners Bracket (positive round numbers)
Display Losers Bracket (negative round numbers)
Handle bracket progression logic:

Winners Bracket losers drop to Losers Bracket
Losers Bracket losers are eliminated
Finals logic (WB winner vs LB winner, with potential second final)


5. Match Management

Record match results (select winner)
Handle bye matches (automatic advancement)
Automatically update bracket progression
Display match history
Edit/correct match results with bracket recalculation
6. Tournament Display

Interactive bracket visualization
Current round highlighting
Team progression tracking
Champion display upon tournament completion
User Interface Pages/ - Home/Dashboard

Quick stats overview
Recent events
Quick actions (Create Event, Add Player)
/players

Player list with search/filter
Add new player button
Edit/delete actions per player
/events

Event list with date sorting
Create new event button
Event cards showing name, date, status
/events/[eventId]

Event details
Team management section
Bracket visualization
Match results interface
Tournament settings (champion bye toggle)
/events/[eventId]/teams

Team formation interface
Player selection for teams
Champion designation
Team count display
/events/[eventId]/bracket

Full bracket view
Match result entry
Tournament progression
Bye match indicators
Business Logic RequirementsBracket Generation AlgorithmThe bracket generation must support any number of teams (typically 4-7, but scalable to more).Key Requirements:

Calculate next power of 2 to determine bracket size

4 teams → 4-team bracket (no byes)
5 teams → 8-team bracket (3 byes)
6 teams → 8-team bracket (2 byes)
7 teams → 8-team bracket (1 bye)
8 teams → 8-team bracket (no byes)
9 teams → 16-team bracket (7 byes)



Bye Distribution Strategy:

Byes are placed in Round 1 of Winners Bracket
Distribute byes evenly (top and bottom of bracket)
If reigning champion exists AND champion_gets_bye = true, they receive the first bye
Remaining byes distributed to balance bracket



Seeding Logic:

Reigning champion: Seeded #1 (with optional bye)
Other teams: Random or sequential seeding
Byes positioned to create balanced paths to finals



Match Structure:

Bye matches: team1_id populated, team2_id = NULL, is_bye = true
Bye matches auto-resolve: winner = team1_id
Regular matches: both team_ids populated, is_bye = false


Algorithm Steps:
1. Count teams (n)
2. Calculate bracket_size = next power of 2 >= n
3. Calculate byes_needed = bracket_size - n
4. Determine reigning_champion_team
5. IF champion_gets_bye AND reigning_champion exists:
     - Assign first bye to reigning champion
     - Remaining byes = byes_needed - 1
6. Distribute remaining byes strategically
7. Create Round 1 Winners Bracket matches:
     - Bye matches for byes_needed slots
     - Regular matches for remaining slots
8. Generate subsequent rounds structure
9. Create Losers Bracket structureMatch Progression

Winner of WB match advances to next WB round
Loser of WB match drops to corresponding LB round
Winner of LB match advances in LB
Loser of LB match is eliminated
Bye matches auto-advance the single team
Finals: WB winner needs to beat LB winner twice (true double-elimination)
Data Validation

No duplicate teams in an event
Both players required for a team
Match can only have one winner
Winner must be one of the two teams in the match (or the bye team)
Only one reigning champion per event
Non-Functional RequirementsPerformance

Page load time < 2 seconds
Smooth bracket interactions
Optimistic UI updates where appropriate
Efficient bracket generation for up to 32+ teams
Security

Row Level Security (RLS) policies on all tables
Input validation and sanitization
Secure API endpoints
Responsive Design

Mobile-first approach
Bracket readable on mobile devices (scroll/zoom as needed)
Touch-friendly controls
Accessibility

Semantic HTML
ARIA labels where needed
Keyboard navigation support
Sufficient color contrast
Bye matches clearly indicated visually
Development PhasesPhase 1: Foundation

Database schema setup
TypeScript types generation
Supabase client configuration
Basic layout and navigation
Phase 2: Player & Event Management

Player CRUD operations
Event CRUD operations with champion_gets_bye option
Basic listing pages
Phase 3: Team Formation

Team creation interface
Player selection component
Champion designation
Team count validation
Phase 4: Bracket System

Dynamic bracket generation algorithm (any team count)
Bye distribution logic
Reigning champion bye option
Double-elimination logic
Match structure creation
Phase 5: Match Management

Result entry interface
Bye match auto-resolution
Bracket progression logic
Winner determination
Phase 6: Polish & Deployment

UI/UX refinements
Error handling
Loading states
Deployment to Vercel
