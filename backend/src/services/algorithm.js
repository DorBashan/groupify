import {
  getTopTracks,
  getTopArtists,
  getFollowedArtists,
  getSavedTracks,
  getUserPlaylists,
  getPlaylistTracks,
  getArtistTopTracks,
  searchTracksByGenre,
} from './spotify.js';
import { generatePlaylistNameWithAI } from './ai.js';

async function collectMemberTracks(member, trackMap) {
  const seen = new Set();

  function addTrack(track) {
    if (!track?.id || seen.has(track.id)) return;
    seen.add(track.id);
    if (!trackMap.has(track.id)) {
      trackMap.set(track.id, { track, memberIds: new Set() });
    }
    trackMap.get(track.id).memberIds.add(member.id);
  }

  try {
    const tracks = await getTopTracks(member, 50);
    tracks.forEach(addTrack);
  } catch (err) {
    console.warn(`top tracks failed for ${member.display_name}:`, err.message);
  }

  try {
    const saved = await getSavedTracks(member, 500);
    saved.forEach(addTrack);
  } catch (err) {
    console.warn(`saved tracks failed for ${member.display_name}:`, err.message);
  }

  try {
    const playlists = await getUserPlaylists(member);
    for (const playlist of playlists.slice(0, 5)) {
      try {
        const tracks = await getPlaylistTracks(member, playlist.id);
        tracks.forEach(addTrack);
      } catch {}
    }
  } catch (err) {
    console.warn(`playlists failed for ${member.display_name}:`, err.message);
  }
}

async function collectMemberArtists(member, artistMap) {
  function addArtist(artist) {
    if (!artist?.id) return;
    if (!artistMap.has(artist.id)) {
      artistMap.set(artist.id, { artist, genres: artist.genres || [], memberIds: new Set() });
    }
    artistMap.get(artist.id).memberIds.add(member.id);
  }

  try {
    const artists = await getTopArtists(member, 50);
    artists.forEach(addArtist);
  } catch (err) {
    console.warn(`top artists failed for ${member.display_name}:`, err.message);
  }

  try {
    const followed = await getFollowedArtists(member, 500);
    followed.forEach(addArtist);
  } catch (err) {
    console.warn(`followed artists failed for ${member.display_name}:`, err.message);
  }
}

function findSharedGenres(artistMap, totalMembers) {
  const genreMembers = new Map();
  for (const { genres, memberIds } of artistMap.values()) {
    for (const genre of genres) {
      if (!genreMembers.has(genre)) genreMembers.set(genre, new Set());
      for (const mid of memberIds) genreMembers.get(genre).add(mid);
    }
  }

  const sorted = [...genreMembers.entries()].sort((a, b) => b[1].size - a[1].size);

  for (const minMembers of [Math.ceil(totalMembers / 2), 2, 1]) {
    const genres = sorted
      .filter(([, ids]) => ids.size >= Math.min(minMembers, totalMembers))
      .map(([genre]) => genre);
    if (genres.length > 0) return genres;
  }
  return [];
}

export async function generatePlaylist(members, targetSize = 50) {
  const totalMembers = members.length;

  const trackMap = new Map(); // trackId -> { track, memberIds: Set }
  const artistMap = new Map(); // artistId -> { artist, genres, memberIds: Set }

  const explanation = {
    commonSongCount: 0,
    commonArtists: [],  // { id, name, memberCount }
    commonGenres: [],   // string[]
    noMatchFound: false,
  };

  console.log(`Collecting music data for ${totalMembers} members...`);

  for (const member of members) {
    await collectMemberTracks(member, trackMap);
    await collectMemberArtists(member, artistMap);
  }

  console.log(`Unique tracks: ${trackMap.size} | Unique artists: ${artistMap.size}`);

  const selected = [];
  const selectedIds = new Set();
  const artistTrackCount = new Map(); // artistId -> number of tracks already in selected
  const MAX_PER_ARTIST = 8;

  function tryAdd(track) {
    if (selected.length >= targetSize) return false;
    if (selectedIds.has(track.id)) return false;
    // Check per-artist cap
    for (const a of track.artists || []) {
      if ((artistTrackCount.get(a.id) || 0) >= MAX_PER_ARTIST) return false;
    }
    selected.push(track);
    selectedIds.add(track.id);
    for (const a of track.artists || []) {
      artistTrackCount.set(a.id, (artistTrackCount.get(a.id) || 0) + 1);
    }
    return true;
  }

  // ── STEP 1: shared songs ──────────────────────────────────────────────────
  const ranked = [...trackMap.values()]
    .map(({ track, memberIds }) => ({ track, memberCount: memberIds.size }))
    .sort((a, b) =>
      b.memberCount !== a.memberCount
        ? b.memberCount - a.memberCount
        : (b.track.popularity || 0) - (a.track.popularity || 0)
    );

  for (const { track, memberCount } of ranked) {
    if (selected.length >= targetSize) break;
    if (memberCount < 2) break;
    tryAdd(track);
  }

  explanation.commonSongCount = selected.length;
  console.log(`Step 1 — shared songs: ${explanation.commonSongCount}`);

  // ── STEP 2: shared artists ────────────────────────────────────────────────
  if (selected.length < targetSize) {
    const sharedArtistEntries = [...artistMap.entries()]
      .filter(([, { memberIds }]) => memberIds.size >= Math.min(2, totalMembers))
      .sort((a, b) => {
        if (b[1].memberIds.size !== a[1].memberIds.size)
          return b[1].memberIds.size - a[1].memberIds.size;
        return (b[1].artist.popularity || 0) - (a[1].artist.popularity || 0);
      });

    explanation.commonArtists = sharedArtistEntries.map(([id, { artist, memberIds }]) => ({
      id,
      name: artist.name,
      memberCount: memberIds.size,
    }));

    console.log(`Step 2 — shared artists: ${explanation.commonArtists.length}`);

    if (sharedArtistEntries.length > 0) {
      const sharedArtistIds = new Set(sharedArtistEntries.map(([id]) => id));

      // First pass: search the already-collected pool
      const poolTracks = [...trackMap.values()]
        .filter(({ track }) => track.artists?.some((a) => sharedArtistIds.has(a.id)))
        .sort((a, b) => (b.track.popularity || 0) - (a.track.popularity || 0));

      for (const { track } of poolTracks) {
        if (selected.length >= targetSize) break;
        tryAdd(track);
      }

      // Second pass: fall back to Spotify API for artists that still have room
      for (const [artistId] of sharedArtistEntries) {
        if (selected.length >= targetSize) break;
        if ((artistTrackCount.get(artistId) || 0) >= MAX_PER_ARTIST) continue;
        try {
          const topTracks = await getArtistTopTracks(members[0], artistId);
          for (const track of topTracks) {
            if (selected.length >= targetSize) break;
            tryAdd(track);
          }
        } catch (err) {
          console.warn(`Artist top tracks failed for ${artistId}:`, err.message);
        }
      }
    }
  }

  // ── STEP 3: shared genres ─────────────────────────────────────────────────
  if (selected.length < targetSize) {
    const sharedGenres = findSharedGenres(artistMap, totalMembers);
    explanation.commonGenres = sharedGenres.slice(0, 10);

    console.log(`Step 3 — shared genres: ${explanation.commonGenres.join(', ')}`);

    if (sharedGenres.length > 0) {
      const genreArtistIds = new Set(
        [...artistMap.entries()]
          .filter(([, { genres }]) => genres.some((g) => sharedGenres.includes(g)))
          .map(([id]) => id)
      );

      // First pass: search the already-collected pool
      const poolTracks = [...trackMap.values()]
        .filter(({ track }) => track.artists?.some((a) => genreArtistIds.has(a.id)))
        .sort((a, b) => (b.track.popularity || 0) - (a.track.popularity || 0));

      for (const { track } of poolTracks) {
        if (selected.length >= targetSize) break;
        tryAdd(track);
      }

      // Second pass: fall back to Spotify search per genre
      for (const genre of sharedGenres) {
        if (selected.length >= targetSize) break;
        try {
          const genreTracks = await searchTracksByGenre(members[0], genre, 50);
          for (const track of genreTracks) {
            if (selected.length >= targetSize) break;
            tryAdd(track);
          }
        } catch (err) {
          console.warn(`Genre search failed for "${genre}":`, err.message);
        }
      }
    }
  }

  // ── NO MATCH ──────────────────────────────────────────────────────────────
  if (selected.length === 0) {
    explanation.noMatchFound = true;
  }

  const aiName = await generatePlaylistNameWithAI(selected, explanation);
  const playlistName = aiName || generatePlaylistName(explanation);

  console.log(`Playlist built: ${selected.length} tracks — "${playlistName}"${aiName ? ' (AI)' : ' (static)'}`);
  return { tracks: selected.slice(0, targetSize), explanation, playlistName };
}

const GENRE_NAMES = {
  'pop':              ['Pop Royalty', 'Chart Collective', 'Top of the Pops'],
  'hip hop':          ['Bars & Beats', 'Hip-Hop Collective', 'Flow State'],
  'hip-hop':          ['Bars & Beats', 'Hip-Hop Collective', 'Flow State'],
  'rap':              ['Mic Check', 'Rap Rotation', 'The Cipher'],
  'r&b':              ['Smooth R&B', 'Soul Sessions', 'Rhythm & Blues'],
  'rock':             ['Rock Solid', 'Guitar Heroes', 'The Rock Vault'],
  'indie':            ['Indie Gems', 'Alt Collective', 'The Indie Shelf'],
  'alternative':      ['Alt Nation', 'The Other Side', 'Off the Radar'],
  'electronic':       ['Electric Nights', 'Synth City', 'Digital Dreams'],
  'edm':              ['Bass Drop', 'Drop It', 'Club Protocol'],
  'dance':            ['Dance Floor', 'Move Your Body', 'All Night Long'],
  'house':            ['Late Night House', 'Four to the Floor', 'House Sessions'],
  'jazz':             ['Jazz Club', 'Cool Jazz Nights', 'The Jazz Lounge'],
  'classical':        ['Classical Vibes', 'Symphony Hours', 'The Grand Playlist'],
  'country':          ['Country Roads', 'Southern Comfort', 'Boots & Beats'],
  'latin':            ['Latin Heat', 'Ritmo Collective', 'Fuego Mix'],
  'metal':            ['Heavy Rotation', 'Metal Machine', 'The Pit'],
  'punk':             ['Loud & Fast', 'Punk Not Dead', 'Three Chords'],
  'folk':             ['Around the Fire', 'Folk Tales', 'Acoustic Roots'],
  'soul':             ['Soul Kitchen', 'Deep Soul', 'Feel It'],
  'reggae':           ['Island Vibes', 'Reggae Roots', 'One Love Mix'],
  'blues':            ['Midnight Blues', 'Twelve Bar', 'Deep Blue'],
  'funk':             ['Funk Machine', 'Get Funky', 'The Groove'],
};

function generatePlaylistName(explanation) {
  const { commonArtists, commonGenres, noMatchFound } = explanation;

  if (noMatchFound) return 'Something for Everyone';

  // Artist-based: two top shared artists
  if (commonArtists.length >= 2) {
    const a = commonArtists[0].name;
    const b = commonArtists[1].name;
    const picks = [`${a} × ${b}`, `${a} & ${b} Night`, `${a}, ${b} & More`];
    return picks[Math.abs(hashStr(a + b)) % picks.length];
  }

  if (commonArtists.length === 1) {
    const name = commonArtists[0].name;
    const picks = [`${name} & Friends`, `The ${name} Mix`, `${name} Essentials`];
    return picks[Math.abs(hashStr(name)) % picks.length];
  }

  // Genre-based
  for (const genre of commonGenres) {
    const key = Object.keys(GENRE_NAMES).find((k) => genre.toLowerCase().includes(k));
    if (key) {
      const options = GENRE_NAMES[key];
      return options[Math.abs(hashStr(genre)) % options.length];
    }
  }

  return 'The Group Playlist';
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
