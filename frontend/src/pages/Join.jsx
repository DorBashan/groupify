import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Join() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(searchParams.get('error') || '');

  useEffect(() => {
    if (!groupId) return;
    api.getGroup(groupId)
      .then(setGroup)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      const { authUrl, memberId } = await api.getLoginUrl(groupId);
      // Store memberId so we can retrieve it after redirect
      sessionStorage.setItem(`groupify_pending_${groupId}`, memberId);
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div style={centerStyle}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!group && !loading) {
    return (
      <div style={centerStyle}>
        <div className="error-msg">Group not found.</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #0f2d1a 0%, #0a0a0a 60%)',
    }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px' }}>
          <img src="/logo.svg" alt="Groupify" style={{ width: 64, height: 64 }} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          You're invited!
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
          Join the group
        </p>
        <div style={{
          display: 'inline-block',
          background: 'var(--surface2)',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '18px',
          fontWeight: 700,
          marginBottom: '24px',
        }}>
          {group?.name}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
          Connect your Spotify account so we can analyze your music taste and build the perfect group playlist.
        </p>

        {error && (
          <div className="error-msg" style={{ marginBottom: '20px' }}>
            {friendlyError(error)}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleConnect}
          disabled={connecting}
          style={{ width: '100%', justifyContent: 'center', fontSize: '16px' }}
        >
          {connecting ? (
            <><span className="spinner" /> Connecting...</>
          ) : (
            <><SpotifyIcon /> Connect with Spotify</>
          )}
        </button>

        {group?.members?.length > 0 && (
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
              Already joined ({group.members.length})
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {group.members.map((m) => (
                <Avatar key={m.id} member={m} size={32} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ member, size = 40 }) {
  return member.avatar_url ? (
    <img
      src={member.avatar_url}
      alt={member.display_name}
      title={member.display_name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
    />
  ) : (
    <div
      title={member.display_name}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 700, color: 'var(--green)',
      }}
    >
      {member.display_name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function friendlyError(code) {
  const map = {
    access_denied: 'You denied Spotify access. Please try again.',
    auth_failed: 'Authentication failed. Please try again.',
    group_not_found: 'This group no longer exists.',
  };
  return map[code] || `Error: ${code}`;
}

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
