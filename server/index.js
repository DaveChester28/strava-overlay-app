const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Strava Overlay API - Production Ready' });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    strava_client_id: process.env.STRAVA_CLIENT_ID || 'not set',
    strava_ready: !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)
  });
});

app.get('/auth/callback', (req, res) => {
  const { code, scope, error } = req.query;
  
  if (error) {
    return res.json({ error: 'OAuth denied', details: error });
  }
  
  res.json({
    success: true,
    message: 'OAuth code received successfully!',
    code: code,
    scope: scope,
    next_step: 'Use POST /auth/token to exchange for access token'
  });
});

app.post('/auth/token', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    console.log('Exchanging OAuth code with Strava...');
    
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    console.log('Strava OAuth successful for athlete:', tokenResponse.data.athlete.id);

    res.json({
      success: true,
      message: 'Successfully connected to Strava!',
      data: {
        access_token: tokenResponse.data.access_token,
        athlete: {
          id: tokenResponse.data.athlete.id,
          name: `${tokenResponse.data.athlete.firstname} ${tokenResponse.data.athlete.lastname}`,
          profile_picture: tokenResponse.data.athlete.profile
        }
      }
    });

  } catch (error) {
    console.error('Strava OAuth error:', error.response?.data || error.message);
    res.status(400).json({ 
      error: 'Failed to exchange code for token',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/activities', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const accessToken = authHeader.replace('Bearer ', '');
  
  try {
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { per_page: 10 }
    });

    res.json({
      success: true,
      data: activitiesResponse.data,
      count: activitiesResponse.data.length
    });

  } catch (error) {
    console.error('Activities fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// SVG Overlay Generation (works without native dependencies)
app.post('/api/generate-overlay', async (req, res) => {
  try {
    const { activityId, aspectRatio = '1:1' } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
    // Fetch activity details
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const activity = activityResponse.data;
    
    // Generate SVG overlay
    const svgOverlay = generateActivitySVG(activity, aspectRatio);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${activity.name.replace(/[^a-zA-Z0-9]/g, '-')}-overlay.svg"`);
    res.send(svgOverlay);
    
  } catch (error) {
    console.error('Overlay generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate overlay',
      details: error.message 
    });
  }
});

function generateActivitySVG(activity, aspectRatio) {
  const dimensions = getDimensions(aspectRatio);
  const { width, height } = dimensions;
  
  // Calculate metrics
  const paceSeconds = (activity.moving_time / (activity.distance / 1000));
  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceSecs = Math.round(paceSeconds % 60);
  const paceText = `${paceMinutes}:${paceSecs.toString().padStart(2, '0')}`;
  
  const distance = (activity.distance / 1000).toFixed(1);
  const timeMinutes = Math.floor(activity.moving_time / 60);
  const elevation = Math.round(activity.total_elevation_gain);
  const date = new Date(activity.start_date_local).toLocaleDateString();
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#bgGradient)"/>
  
  <text x="${width/2}" y="200" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif" font-size="48" font-weight="bold">${activity.name}</text>
  
  <text x="${width/2}" y="400" text-anchor="middle" fill="#1e293b" font-family="Arial, sans-serif" font-size="120" font-weight="bold">${paceText}</text>
  
  <text x="${width/2}" y="450" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="32" font-weight="bold">PER KM</text>
  
  <text x="150" y="650" text-anchor="start" fill="#1e293b" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${distance} km</text>
  <text x="150" y="680" text-anchor="start" fill="#64748b" font-family="Arial, sans-serif" font-size="24">DISTANCE</text>
  
  <text x="400" y="650" text-anchor="start" fill="#1e293b" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${timeMinutes} min</text>
  <text x="400" y="680" text-anchor="start" fill="#64748b" font-family="Arial, sans-serif" font-size="24">TIME</text>
  
  <text x="650" y="650" text-anchor="start" fill="#1e293b" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${elevation} m</text>
  <text x="650" y="680" text-anchor="start" fill="#64748b" font-family="Arial, sans-serif" font-size="24">ELEVATION</text>
  
  <text x="${width/2}" y="800" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="28">${date}</text>
  
  <text x="${width-50}" y="${height-50}" text-anchor="end" fill="#64748b" font-family="Arial, sans-serif" font-size="20">Powered by Strava</text>
</svg>`;
}

function getDimensions(aspectRatio) {
  switch(aspectRatio) {
    case '1:1': return { width: 1080, height: 1080 };
    case '4:5': return { width: 1080, height: 1350 };
    case '9:16': return { width: 1080, height: 1920 };
    default: return { width: 1080, height: 1080 };
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Token refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    res.json({
      success: true,
      data: {
        access_token: tokenResponse.data.access_token,
        refresh_token: tokenResponse.data.refresh_token,
        expires_at: tokenResponse.data.expires_at
      }
    });

  } catch (error) {
    res.status(400).json({ error: 'Token refresh failed' });
  }
});
// Updated Mon 22 Sep 2025 21:02:17 BST
