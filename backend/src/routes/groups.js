import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { generatePlaylist } from '../services/algorithm.js';
import { createPlaylist, addTracksToPlaylist } from '../services/spotify.js';

const router = Router();

// Create a new group
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(id, name.trim());

  res.json({ id, name: name.trim() });
});

// Rename a group
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ok: true, name: name.trim() });
});

// Delete a group
router.delete('/:id', (req, res) => {
  const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Get group info with members
router.get('/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db
    .prepare('SELECT id, spotify_id, display_name, avatar_url, joined_at FROM members WHERE group_id = ? ORDER BY joined_at ASC')
    .all(req.params.id);

  res.json({
    ...group,
    playlist_data: group.playlist_data ? JSON.parse(group.playlist_data) : null,
    members,
  });
});

// Generate playlist for the group
router.post('/:id/generate', async (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db
    .prepare('SELECT * FROM members WHERE group_id = ?')
    .all(req.params.id);

  if (members.length === 0) {
    return res.status(400).json({ error: 'No members in group yet' });
  }

  try {
    const { tracks, explanation, playlistName } = await generatePlaylist(members, 50);

    const playlistData = {
      playlistName,
      tracks: tracks.map((t) => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: t.artists?.map((a) => a.name) || [],
        album: t.album?.name || '',
        albumArt: t.album?.images?.[0]?.url || null,
        popularity: t.popularity,
      })),
      explanation,
      generatedAt: new Date().toISOString(),
    };

    db.prepare('UPDATE groups SET playlist_data = ? WHERE id = ?').run(
      JSON.stringify(playlistData),
      req.params.id
    );

    res.json(playlistData);
  } catch (err) {
    console.error('Playlist generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate playlist: ' + err.message });
  }
});

// Save playlist to a specific member's Spotify account
router.post('/:id/save', async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId required' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!group.playlist_data) return res.status(400).json({ error: 'No playlist generated yet' });

  const member = db
    .prepare('SELECT * FROM members WHERE id = ? AND group_id = ?')
    .get(memberId, req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found in this group' });

  const playlistData = JSON.parse(group.playlist_data);
  const trackUris = playlistData.tracks.map((t) => t.uri);

  try {
    const generatedName = playlistData.playlistName || `Groupify: ${group.name}`;

    const playlist = await createPlaylist(
      member,
      generatedName,
      `A playlist made for the group "${group.name}" by Groupify`
    );
    await addTracksToPlaylist(member, playlist.id, trackUris);

    res.json({
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls?.spotify,
      trackCount: trackUris.length,
    });
  } catch (err) {
    console.error('Save playlist error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to save playlist: ' + err.message });
  }
});

export default router;
