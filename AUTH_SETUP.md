# Profile Secret Authentication System

This cornhole tournament app uses a simple, low-friction authentication system based on profile secrets instead of email/password or magic links.

## How It Works

### For Users (Players)
1. Navigate to the app
2. Click "Claim Profile" button in the header
3. Select their name from a dropdown list
4. Enter their personal profile secret
5. If correct, they're authenticated and their name appears in the header

### For Tournament Organizers

#### 1. Add Profile Secrets to Existing Players

Run this SQL in your Supabase SQL Editor:

```sql
-- First, add the profile_secret column if not already done
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_secret TEXT;

-- Then set secrets for each player
UPDATE players SET profile_secret = '1234' WHERE playerid = 1;
UPDATE players SET profile_secret = 'golf' WHERE playerid = 2;
UPDATE players SET profile_secret = 'bags' WHERE playerid = 3;
-- ... etc for all players
```

#### 2. Recommended Secret Types

- **Simple PINs**: `1234`, `5678` (easy to remember for casual events)
- **Words**: `golf`, `cornhole`, `champion` (memorable keywords)
- **Player-specific**: Use last 4 of phone, birth year, etc.

#### 3. Setting Secrets in Bulk

```sql
-- Example: Set secrets based on player IDs
UPDATE players
SET profile_secret = CONCAT('player', playerid::text)
WHERE profile_secret IS NULL;

-- Example: Random 4-digit codes
UPDATE players
SET profile_secret = LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0')
WHERE profile_secret IS NULL;
```

## Technical Details

### Storage
- **Client-side**: Claimed profile stored in `localStorage` under key `cornhole_claimed_profile`
- **Server-side**: Profile secrets stored in `players.profile_secret` column (Supabase)

### Security Notes
- Secrets are validated **case-insensitive** for user convenience
- No encryption on secrets (not needed for tournament management)
- Session persists until user clicks "Release" or clears browser data
- No server-side session management required

### Auth Context API

```typescript
import { useAuth } from '@/lib/auth'

function MyComponent() {
  const {
    claimedPlayer,      // PlayerRow | null
    claimProfile,       // (player: PlayerRow) => void
    releaseProfile,     // () => void
    isProfileClaimed    // boolean
  } = useAuth()

  // Use claimedPlayer to show user-specific content
  if (isProfileClaimed) {
    return <div>Welcome, {claimedPlayer.firstname}!</div>
  }
}
```

### Files Involved

- **`/src/lib/auth.tsx`** - Auth context provider and hooks
- **`/src/pages/ClaimProfilePage.tsx`** - Profile claiming UI
- **`/src/App.tsx`** - Header with claim/release buttons
- **`/add-profile-secret.sql`** - SQL migration to add column

## Benefits

✅ **Low friction**: No email verification or magic links
✅ **In-person friendly**: Easy to share secrets verbally at events
✅ **Simple**: No complex auth infrastructure
✅ **Flexible**: Works for casual and organized tournaments
✅ **Shared player database**: Works alongside golf app's auth system

## Future Enhancements (Optional)

If you want to add more security later:

1. **Rate limiting**: Prevent brute force attempts
2. **Admin panel**: UI for organizers to set secrets
3. **Secret reset**: Email-based secret recovery
4. **Hybrid auth**: Keep simple secrets but add optional email auth
