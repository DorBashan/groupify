import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import groupsRouter from './routes/groups.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/groups', groupsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Only start the HTTP server when running locally, not on Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Groupify backend running on http://localhost:${PORT}`);
  });
}

export default app;
