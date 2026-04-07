const BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  createGroup: (name) => request('POST', '/groups', { name }),
  getGroup: (id) => request('GET', `/groups/${id}`),
  getLoginUrl: (groupId) => request('GET', `/auth/login?groupId=${groupId}`),
  generatePlaylist: (groupId) => request('POST', `/groups/${groupId}/generate`),
  savePlaylist: (groupId, memberId) => request('POST', `/groups/${groupId}/save`, { memberId }),
  updateGroup: (groupId, name) => request('PUT', `/groups/${groupId}`, { name }),
  deleteGroup: (groupId) => request('DELETE', `/groups/${groupId}`),
};
