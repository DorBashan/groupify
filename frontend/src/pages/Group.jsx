import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { saveRecentGroup, getRecentGroups } from './Home.jsx';

const POLL_INTERVAL = 8000; // 8s

export default function Group() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // memberId stored in localStorage after OAuth redirect
  const memberId = (() => {
    const fromUrl = searchParams.get('memberId');
    if (fromUrl) {
      localStorage.setItem(`groupify_member_${groupId}`, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(`groupify_member_${groupId}`);
  })();

  const fetchGroup = useCallback(async () => {
    try {
      const data = await api.getGroup(groupId);
      setGroup(data);
      saveRecentGroup(data.id, data.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    const interval = setInterval(fetchGroup, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGroup]);

  const joinUrl = `${window.location.origin}/join/${groupId}`;

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      await api.generatePlaylist(groupId);
      await fetchGroup();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function startEdit() {
    setEditName(group.name);
    setEditing(true);
  }

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === group.name) { setEditing(false); return; }
    try {
      await api.updateGroup(groupId, trimmed);
      saveRecentGroup(groupId, trimmed);
      await fetchGroup();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteGroup(groupId);
      // Remove from recent groups in localStorage
      const updated = getRecentGroups().filter((g) => g.id !== groupId);
      localStorage.setItem('groupify_recent_groups', JSON.stringify(updated));
      navigate('/');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!memberId) {
      setError('Connect your Spotify first to save the playlist.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api.savePlaylist(groupId, memberId);
      setSavedUrl(result.playlistUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={centerStyle}><span className="spinner" style={{ width: 32, height: 32 }} /></div>;
  }

  if (!group) {
    return <div style={centerStyle}><div className="error-msg">Group not found.</div></div>;
  }

  const currentMember = group.members?.find((m) => m.id === memberId);
  const playlist = group.playlist_data;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
            ← Groupify
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  maxLength={60}
                  style={{ fontSize: '22px', fontWeight: 700, padding: '6px 12px' }}
                />
                <button className="btn btn-primary" type="submit">Save</button>
                <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </form>
            ) : (
              <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>{group.name}</h1>
            )}
            {currentMember && (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Joined as <strong style={{ color: 'var(--text)' }}>{currentMember.display_name}</strong>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!currentMember && (
              <Link to={`/join/${groupId}`} className="btn btn-outline">
                Connect my Spotify
              </Link>
            )}
            <GroupMenu
              onShare={() => { navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              onEdit={startEdit}
              onDelete={handleDelete}
              deleting={deleting}
              copied={copied}
            />
          </div>
        </div>

        {/* Invite section */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>Invite friends</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Share this link — they'll connect their Spotify and join the group.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <code style={{
                background: 'var(--surface2)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                maxWidth: '260px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{joinUrl}</code>
              <button className="btn btn-secondary" onClick={copyJoinLink} style={{ whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontWeight: 700 }}>Members</h2>
            <span className="badge badge-green">{group.members?.length || 0} connected</span>
          </div>
          {group.members?.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No one has joined yet. Share the invite link above!
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {group.members.map((m) => (
                <MemberCard key={m.id} member={m} isMe={m.id === memberId} />
              ))}
            </div>
          )}
        </div>

        {/* Generate button */}
        {group.members?.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {error && <div className="error-msg" style={{ marginBottom: '16px' }}>{error}</div>}
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ fontSize: '16px', padding: '14px 32px' }}
            >
              {generating ? (
                <><span className="spinner" /> Analyzing music & building playlist...</>
              ) : (
                <>{playlist ? '↻ Regenerate playlist' : '✦ Generate group playlist'}</>
              )}
            </button>
            {group.members?.length === 1 && !playlist && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
                Tip: invite more people for better results — but you can try with just one!
              </p>
            )}
          </div>
        )}

        {/* Playlist */}
        {playlist && (
          <PlaylistView
            playlist={playlist}
            groupName={group.name}
            onSave={handleSave}
            saving={saving}
            savedUrl={savedUrl}
            canSave={!!currentMember}
          />
        )}
      </div>
    </div>
  );
}

function GroupMenu({ onShare, onEdit, onDelete, deleting, copied }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{ padding: '10px 14px', fontSize: '18px', lineHeight: 1 }}
        title="More options"
      >
        ···
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          minWidth: '180px',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <MenuItem
            onClick={() => { onShare(); setOpen(false); }}
            label={copied ? 'Link copied!' : 'Share group link'}
          />
          <MenuItem
            onClick={() => { setOpen(false); onEdit(); }}
            label="Edit name"
          />
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <MenuItem
            onClick={() => { setOpen(false); onDelete(); }}
            label={deleting ? 'Deleting...' : 'Delete group'}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, label, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 16px',
        background: hover ? 'var(--surface2)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '14px',
        color: danger ? '#ff5555' : 'var(--text)',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );
}

function MemberCard({ member, isMe }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'var(--surface2)',
      borderRadius: '10px',
      padding: '12px',
      border: isMe ? '1px solid var(--green)' : '1px solid transparent',
    }}>
      <Avatar member={member} size={36} />
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.display_name}
        </div>
        {isMe && <div style={{ fontSize: '11px', color: 'var(--green)' }}>You</div>}
      </div>
    </div>
  );
}

function Avatar({ member, size = 40 }) {
  return member.avatar_url ? (
    <img
      src={member.avatar_url}
      alt={member.display_name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#1db95433',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: 'var(--green)',
    }}>
      {member.display_name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function AlgorithmInsights({ explanation }) {
  if (!explanation) return null;

  const { commonSongCount, commonArtists = [], commonGenres = [], noMatchFound } = explanation;

  const items = [];

  if (commonSongCount > 0) {
    items.push({
      icon: '🎵',
      label: `${commonSongCount} song${commonSongCount !== 1 ? 's' : ''} in common`,
      detail: null,
      color: 'var(--green)',
    });
  }

  if (commonArtists.length > 0) {
    const names = commonArtists.slice(0, 5).map((a) => a.name).join(', ');
    const extra = commonArtists.length > 5 ? ` +${commonArtists.length - 5} more` : '';
    items.push({
      icon: '🎤',
      label: `${commonArtists.length} shared artist${commonArtists.length !== 1 ? 's' : ''}`,
      detail: names + extra,
      color: 'var(--text)',
    });
  }

  if (commonGenres.length > 0) {
    items.push({
      icon: '🎼',
      label: `${commonGenres.length} shared genre${commonGenres.length !== 1 ? 's' : ''}`,
      detail: commonGenres.slice(0, 6).join(', '),
      color: 'var(--text)',
    });
  }

  if (noMatchFound) {
    return (
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-muted)',
        fontSize: '14px',
      }}>
        <span style={{ fontSize: '20px' }}>🤷</span>
        No music in common found between the group members. Try adding more members!
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        How this playlist was built
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <div key={item.label} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px 16px',
          }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
            <div>
              <span style={{ fontWeight: 600, fontSize: '14px', color: item.color }}>{item.label}</span>
              {item.detail && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaylistView({ playlist, groupName, onSave, saving, savedUrl, canSave }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: '22px', marginBottom: '4px' }}>
            {playlist.playlistName || 'Your Group Playlist'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {playlist.tracks.length} tracks · Generated {new Date(playlist.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {savedUrl ? (
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <SpotifyIcon /> Open in Spotify
            </a>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onSave}
              disabled={saving || !canSave}
              title={!canSave ? 'Connect your Spotify first' : ''}
            >
              {saving ? <><span className="spinner" /> Saving...</> : <><SpotifyIcon /> Save to my Spotify</>}
            </button>
          )}
        </div>
      </div>

      {!canSave && (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
          <a href={`/join/${window.location.pathname.split('/')[2]}`}>Connect your Spotify</a> to save this playlist.
        </p>
      )}

      <AlgorithmInsights explanation={playlist.explanation} />

      {playlist.tracks.length === 0 ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {playlist.tracks.map((track, index) => (
            <TrackRow key={track.id} track={track} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, index }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '8px 10px',
        borderRadius: '8px',
        background: hover ? 'var(--surface2)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ width: '24px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px', flexShrink: 0 }}>
        {index + 1}
      </div>
      {track.albumArt ? (
        <img src={track.albumArt} alt={track.album} style={{ width: 40, height: 40, borderRadius: '4px', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: '4px', background: 'var(--surface2)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.name}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artists.join(', ')}
        </div>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '12px', flexShrink: 0, display: 'none' }}>
        {track.album}
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
