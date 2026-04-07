# Groupify

> Create the perfect playlist for your group, based on everyone's Spotify taste.

Groupify lets a group of friends connect their Spotify accounts and generates a shared playlist that works for everyone — finding common songs, artists, and genres across the group's listening history.

**Live app:** [groupify-app.vercel.app](https://groupify-app.vercel.app)

---

## How it works

1. **Create a group** — give it a name and share the link with your friends
2. **Everyone connects Spotify** — each member logs in with their own Spotify account
3. **Generate a playlist** — the algorithm finds music everyone loves and builds a 50-song playlist
4. **Save to Spotify** — any member can save the playlist directly to their Spotify account

---

## Algorithm

The playlist is built in three steps, each falling back to the next if not enough songs are found:

1. **Shared songs** — tracks that appear in multiple members' libraries (top tracks + saved songs + playlists), sorted by how many members have them
2. **Shared artists** — artists followed or listened to by multiple members; pulls their top tracks, prioritizing songs already in the collected pool
3. **Shared genres** — common genres across the group; searches for top tracks in those genres

Additional rules:
- Max **8 songs per artist** to keep the playlist diverse
- A **Groq AI** (Llama 3) generates a creative playlist name based on the selected songs
- Falls back to a static name if AI is unavailable

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + React Router |
| Backend | Node.js + Express |
| Database | [Turso](https://turso.tech) (cloud SQLite via libsql) |
| Auth | Spotify OAuth 2.0 (Authorization Code Flow) |
| AI | [Groq](https://groq.com) — `llama-3.1-8b-instant` |
| Deployment | [Vercel](https://vercel.com) (frontend + serverless API) |

---

## Running locally

### Prerequisites
- Node.js 18+
- A [Spotify Developer app](https://developer.spotify.com/dashboard)
- A [Groq API key](https://console.groq.com) (optional — playlist naming falls back gracefully)

### Setup

```bash
# Clone the repo
git clone https://github.com/DorBashan/groupify.git
cd groupify

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

Create `backend/.env`:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/auth/callback
FRONTEND_URL=http://localhost:5173
PORT=3001
DB_PATH=./groupify.db
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

Add `http://127.0.0.1:3001/api/auth/callback` as a Redirect URI in your Spotify app settings.

### Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploying to Vercel

1. Create a [Turso](https://turso.tech) database and get your URL + auth token
2. Import the repo into Vercel
3. Add these environment variables in Vercel:

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
FRONTEND_URL=https://your-app.vercel.app
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
```

4. Add `https://your-app.vercel.app/api/auth/callback` as a Redirect URI in your Spotify app

---

## Spotify scopes required

| Scope | Purpose |
|---|---|
| `user-top-read` | Read top tracks and artists |
| `user-library-read` | Read saved songs |
| `user-follow-read` | Read followed artists |
| `playlist-read-private` | Read private playlists |
| `playlist-read-collaborative` | Read collaborative playlists |
| `playlist-modify-public` | Save generated playlist |
| `playlist-modify-private` | Save generated playlist (private) |
| `user-read-private` | Read country for market-aware API calls |
| `user-read-email` | Read email for account identification |

---

## Project structure

```
groupify/
├── api/
│   └── index.js          # Vercel serverless entry point
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js   # Spotify OAuth flow
│   │   │   └── groups.js # Group + playlist endpoints
│   │   ├── services/
│   │   │   ├── algorithm.js  # Playlist generation logic
│   │   │   ├── ai.js         # Groq AI playlist naming
│   │   │   └── spotify.js    # Spotify API client
│   │   ├── db.js         # Turso/libsql database setup
│   │   └── index.js      # Express app
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx  # Create group + recent groups
│   │   │   ├── Group.jsx # Group view + playlist
│   │   │   └── Join.jsx  # Member join page
│   │   └── api.js        # API client
│   └── package.json
└── vercel.json
```
