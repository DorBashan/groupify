import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Ask Groq to generate a creative playlist name based on the track list.
 * Falls back to null if the API key is missing or the call fails.
 */
export async function generatePlaylistNameWithAI(tracks, explanation) {
  if (!process.env.GROQ_API_KEY) return null;

  const songList = tracks
    .slice(0, 20)
    .map((t) => `"${t.name}" by ${t.artists?.map((a) => a.name).join(', ')}`)
    .join('\n');

  const context = [];
  if (explanation.commonSongCount > 0) {
    context.push(`${explanation.commonSongCount} songs were shared between group members`);
  }
  if (explanation.commonArtists?.length > 0) {
    context.push(`shared artists: ${explanation.commonArtists.slice(0, 3).map((a) => a.name).join(', ')}`);
  }
  if (explanation.commonGenres?.length > 0) {
    context.push(`shared genres: ${explanation.commonGenres.slice(0, 4).join(', ')}`);
  }

  const prompt = `You are a creative DJ naming playlists. Given these songs, generate one short, catchy, and evocative playlist name (3-6 words max). Return ONLY the name, nothing else — no quotes, no explanation.

Songs:
${songList}

${context.length > 0 ? `Context: ${context.join('; ')}` : ''}`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 30,
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    const name = response.data.choices?.[0]?.message?.content?.trim();
    return name || null;
  } catch (err) {
    console.warn('Groq playlist name generation failed:', err.response?.data?.error?.message || err.message);
    return null;
  }
}
