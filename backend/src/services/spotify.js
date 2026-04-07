import axios from 'axios';
import db from '../db.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export function getAuthUrl(state) {
  const scopes = [
    'user-top-read',
    'user-library-read',
    'user-follow-read',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
    'user-read-email',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state,
    show_dialog: 'true',
  });

  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code) {
  const response = await axios.post(
    SPOTIFY_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    }
  );
  return response.data;
}

async function refreshAccessToken(member) {
  const response = await axios.post(
    SPOTIFY_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: member.refresh_token,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    }
  );

  const { access_token, expires_in, refresh_token } = response.data;
  const expiresAt = Date.now() + expires_in * 1000;

  await db.execute({
    sql: `UPDATE members SET access_token = ?, token_expires_at = ?, refresh_token = COALESCE(?, refresh_token) WHERE id = ?`,
    args: [access_token, expiresAt, refresh_token || null, member.id],
  });

  return access_token;
}

async function getToken(member) {
  if (Date.now() >= member.token_expires_at - 60_000) {
    return refreshAccessToken(member);
  }
  return member.access_token;
}

async function spotifyGet(member, endpoint, params = {}) {
  const token = await getToken(member);
  const response = await axios.get(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return response.data;
}

export async function getCurrentUser(accessToken) {
  const response = await axios.get(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function getTopTracks(member, limit = 50) {
  const data = await spotifyGet(member, '/me/top/tracks', { limit });
  return data.items || [];
}

export async function getTopArtists(member, limit = 50) {
  const data = await spotifyGet(member, '/me/top/artists', { limit });
  return data.items || [];
}

export async function getSavedTracks(member, max = 500) {
  const results = [];
  const pageSize = 50;
  let offset = 0;

  while (results.length < max) {
    const data = await spotifyGet(member, '/me/tracks', { limit: pageSize, offset });
    const tracks = (data.items || []).map((item) => item.track).filter(Boolean);
    results.push(...tracks);
    if (!data.next || tracks.length < pageSize) break;
    offset += pageSize;
  }

  return results.slice(0, max);
}

export async function getFollowedArtists(member, max = 500) {
  const results = [];
  const pageSize = 50;
  let after = undefined;

  while (results.length < max) {
    const params = { type: 'artist', limit: pageSize };
    if (after) params.after = after;

    const data = await spotifyGet(member, '/me/following', params);
    const artists = data.artists?.items || [];
    results.push(...artists);

    const cursor = data.artists?.cursors?.after;
    if (!cursor || artists.length < pageSize) break;
    after = cursor;
  }

  return results.slice(0, max);
}

export async function getUserPlaylists(member) {
  const data = await spotifyGet(member, '/me/playlists', { limit: 20 });
  return data.items || [];
}

export async function getPlaylistTracks(member, playlistId) {
  const data = await spotifyGet(member, `/playlists/${playlistId}/tracks`, {
    limit: 50,
    fields: 'items(track(id,name,artists,album,popularity,uri))',
  });
  return (data.items || []).map((item) => item.track).filter(Boolean);
}

export async function getArtistTopTracks(member, artistId) {
  const market = member.country || 'US';
  const data = await spotifyGet(member, `/artists/${artistId}/top-tracks`, { market });
  return data.tracks || [];
}

export async function searchTracksByGenre(member, genre, limit = 50) {
  const data = await spotifyGet(member, '/search', {
    q: `genre:"${genre}"`,
    type: 'track',
    limit,
  });
  return data.tracks?.items || [];
}

export async function createPlaylist(member, name, description) {
  const token = await getToken(member);
  const response = await axios.post(
    `${SPOTIFY_API}/users/${member.spotify_id}/playlists`,
    { name, description, public: false },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

export async function addTracksToPlaylist(member, playlistId, trackUris) {
  const token = await getToken(member);
  // Spotify allows max 100 tracks per request
  for (let i = 0; i < trackUris.length; i += 100) {
    await axios.post(
      `${SPOTIFY_API}/playlists/${playlistId}/tracks`,
      { uris: trackUris.slice(i, i + 100) },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  }
}
