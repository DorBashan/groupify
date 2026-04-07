import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Group from './pages/Group.jsx';
import Join from './pages/Join.jsx';

const styles = `
  :root {
    --green: #1db954;
    --green-dark: #17a349;
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1e1e1e;
    --border: #2a2a2a;
    --text: #ffffff;
    --text-muted: #a0a0a0;
  }

  a { color: var(--green); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 100px;
    border: none;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    transition: transform 0.1s, opacity 0.1s;
  }
  .btn:hover { transform: scale(1.03); }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .btn-primary { background: var(--green); color: #000; }
  .btn-primary:hover { background: var(--green-dark); }

  .btn-secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { border-color: var(--text-muted); }

  .btn-outline {
    background: transparent;
    color: var(--green);
    border: 1px solid var(--green);
  }
  .btn-outline:hover { background: rgba(29,185,84,0.1); }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
  }

  .input {
    width: 100%;
    padding: 12px 16px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input:focus { border-color: var(--green); }
  .input::placeholder { color: var(--text-muted); }

  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 600;
  }
  .badge-green { background: rgba(29,185,84,0.2); color: var(--green); }

  .spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: var(--green);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-msg {
    color: #ff5555;
    background: rgba(255,85,85,0.1);
    border: 1px solid rgba(255,85,85,0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
  }
`;

export default function App() {
  return (
    <>
      <style>{styles}</style>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/group/:groupId" element={<Group />} />
        <Route path="/join/:groupId" element={<Join />} />
      </Routes>
    </>
  );
}
