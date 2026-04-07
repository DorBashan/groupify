import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

const STORAGE_KEY = 'groupify_recent_groups';

export function saveRecentGroup(id, name) {
  const existing = getRecentGroups().filter((g) => g.id !== id);
  const updated = [{ id, name }, ...existing].slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getRecentGroups() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function Home() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentGroups, setRecentGroups] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setRecentGroups(getRecentGroups());
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const group = await api.createGroup(name.trim());
      saveRecentGroup(group.id, group.name);
      navigate(`/group/${group.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #0f2d1a 0%, #0a0a0a 60%)',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
          <img src="/logo.svg" alt="Groupify" style={{ width: 48, height: 48 }} />
          <h1 style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '-1px' }}>
            Groupify
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px', maxWidth: '420px', lineHeight: 1.5 }}>
          Create the perfect playlist for your group, based on everyone's Spotify taste.
        </p>
      </div>

      {/* Create Group Card */}
      <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Start a new group
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          Give your group a name, then share the link with your friends.
        </p>

        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: '16px' }}>
            <input
              className="input"
              type="text"
              placeholder="e.g. Road trip crew, Friday vibes..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          {error && <div className="error-msg" style={{ marginBottom: '16px' }}>{error}</div>}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !name.trim()}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? <span className="spinner" /> : '✦'}
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>

      {/* Recent groups */}
      {recentGroups.length > 0 && (
        <div style={{ width: '100%', maxWidth: '440px', marginTop: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent groups
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentGroups.map((g) => (
              <Link
                key={g.id}
                to={`/group/${g.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: 'var(--text)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--green)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span style={{ fontWeight: 500 }}>{g.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ marginTop: '64px', maxWidth: '560px', width: '100%' }}>
        <h3 style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '32px' }}>
          How it works
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          {[
            { icon: '👥', title: 'Create a group', desc: 'Give your group a name and share the link.' },
            { icon: '🎵', title: 'Everyone connects', desc: 'Each member logs in with their Spotify account.' },
            { icon: '🎧', title: 'Get your playlist', desc: 'We build a playlist that works for the whole group.' },
          ].map((step) => (
            <div key={step.title} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{step.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>{step.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

