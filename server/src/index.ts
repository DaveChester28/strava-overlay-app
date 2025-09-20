import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: 'Strava Overlay API is running! 🚀'
  });
});

// Mock OAuth endpoint (will be replaced with real Strava integration)
app.post('/auth/token', async (req, res) => {
  console.log('OAuth token request received:', req.body);
  
  res.json({
    success: true,
    data: {
      accessToken: 'demo_access_token_' + Date.now(),
      refreshToken: 'demo_refresh_token_' + Date.now(),
      expiresAt: Math.floor(Date.now() / 1000) + 21600, // 6 hours
      athlete: {
        id: 12345,
        username: 'demouser',
        firstname: 'Demo',
        lastname: 'User',
        profile: 'https://via.placeholder.com/150',
        city: 'San Francisco',
        state: 'CA',
        country: 'US'
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Strava Overlay API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
