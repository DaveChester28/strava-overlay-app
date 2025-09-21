const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Enhanced health check with Strava status
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    message: 'Strava Overlay API is running! 🚀',
    strava: {
      clientConfigured: !!process.env.STRAVA_CLIENT_ID,
      secretConfigured: !!process.env.STRAVA_CLIENT_SECRET,
      ready: !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)
    }
  });
});

// Real Strava OAuth token exchange
app.post('/auth/token', async (req, res) => {
  try {
    const { code, codeVerifier } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code'
    });

    console.log('✅ Strava OAuth successful for athlete:', tokenResponse.data.athlete.id);

    res.json({
      success: true,
      data: {
        accessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
        expiresAt: tokenResponse.data.expires_at,
        athlete: tokenResponse.data.athlete
      }
    });

  } catch (error) {
    console.error('❌ Strava OAuth error:', error.response?.data || error.message);
    res.status(400).json({ error: 'OAuth exchange failed' });
  }
});

// Get user's activities
app.get('/api/activities', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { page: 1, per_page: 30 }
    });

    res.json({
      success: true,
      data: activitiesResponse.data
    });

  } catch (error) {
    console.error('❌ Activities fetch error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Strava Overlay API running on port ${PORT}`);
  console.log(`✅ Strava Client ID: ${process.env.STRAVA_CLIENT_ID ? 'Configured' : 'Missing'}`);
  console.log(`✅ Strava Client Secret: ${process.env.STRAVA_CLIENT_SECRET ? 'Configured' : 'Missing'}`);
});

module.exports = app;
