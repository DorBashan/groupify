import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { getAuthUrl, exchangeCode, getCurrentUser } from '../services/spotify.js';

const router = Router();

// Initiate Spotify OAuth for a group member
// state encodes: groupId:memberId(new uuid)
router.get('/login', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ error: 'groupId required' });

  const result = await db.execute({ sql: 'SELECT id FROM groups WHERE id = ?', args: [groupId] });
  if (!result.rows[0]) return res.status(404).json({ error: 'Group not found' });

  const memberId = uuidv4();
  const state = `${groupId}:${memberId}`;
  const authUrl = getAuthUrl(state);

  res.json({ authUrl, memberId });
});

// Spotify OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/join?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/join?error=missing_params`);
  }

  const [groupId, memberId] = state.split(':');
  if (!groupId || !memberId) {
    return res.redirect(`${process.env.FRONTEND_URL}/join?error=invalid_state`);
  }

  const groupResult = await db.execute({ sql: 'SELECT id FROM groups WHERE id = ?', args: [groupId] });
  if (!groupResult.rows[0]) {
    return res.redirect(`${process.env.FRONTEND_URL}/join?error=group_not_found`);
  }

  try {
    const tokens = await exchangeCode(code);
    const spotifyUser = await getCurrentUser(tokens.access_token);

    const expiresAt = Date.now() + tokens.expires_in * 1000;
    const avatarUrl = spotifyUser.images?.[0]?.url || null;
    const country = spotifyUser.country || null;

    // Upsert member — if same Spotify user joins again, update their tokens
    const existingResult = await db.execute({
      sql: 'SELECT id FROM members WHERE group_id = ? AND spotify_id = ?',
      args: [groupId, spotifyUser.id],
    });
    const existing = existingResult.rows[0];

    const finalMemberId = existing ? existing.id : memberId;

    if (existing) {
      await db.execute({
        sql: `UPDATE members SET access_token = ?, refresh_token = ?, token_expires_at = ?,
          display_name = ?, avatar_url = ?, country = ?
        WHERE id = ?`,
        args: [
          tokens.access_token,
          tokens.refresh_token,
          expiresAt,
          spotifyUser.display_name || spotifyUser.id,
          avatarUrl,
          country,
          existing.id,
        ],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO members (id, group_id, spotify_id, display_name, avatar_url, country,
          access_token, refresh_token, token_expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          memberId,
          groupId,
          spotifyUser.id,
          spotifyUser.display_name || spotifyUser.id,
          avatarUrl,
          country,
          tokens.access_token,
          tokens.refresh_token,
          expiresAt,
        ],
      });
    }

    res.redirect(
      `${process.env.FRONTEND_URL}/group/${groupId}?memberId=${finalMemberId}&joined=1`
    );
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/join/${groupId}?error=auth_failed`);
  }
});

export default router;
