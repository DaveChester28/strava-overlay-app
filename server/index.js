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
    version: '2.1.0',
    strava_client_id: process.env.STRAVA_CLIENT_ID || 'not set',
    strava_ready: !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
    features: ['oauth', 'activities', 'overlay-generation', 'token-refresh']
  });
});

// OAuth callback endpoint
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

// Token exchange endpoint
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
        refresh_token: tokenResponse.data.refresh_token,
        expires_at: tokenResponse.data.expires_at,
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
    console.error('Token refresh error:', error.response?.data || error.message);
    res.status(400).json({ 
      error: 'Token refresh failed',
      details: error.response?.data || error.message
    });
  }
});

// Get user's activities
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
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Enhanced SVG overlay generation
app.post('/api/generate-overlay', async (req, res) => {
  try {
    const { activityId, aspectRatio = '1:1' } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
    console.log(`Generating overlay for activity ${activityId} with aspect ratio ${aspectRatio}`);
    
    // Fetch activity details
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const activity = activityResponse.data;
    console.log(`Activity loaded: ${activity.name} (${(activity.distance/1000).toFixed(1)}km)`);
    
    // Generate SVG overlay
   const dimensions = getDimensions(aspectRatio);
const templateId = req.body.templateId || 'clean-pace';
const svgContent = templateId === 'route-glow' 
  ? generateRouteGlowOverlay(activity, dimensions)
  : generateActivitySVG(activity, aspectRatio);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${activity.name.replace(/[^a-zA-Z0-9]/g, '-')}-overlay.svg"`);
    res.send(svgContent);
    
  } catch (error) {
    console.error('Overlay generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate overlay',
      details: error.message 
    });
  }
});

// Enhanced SVG generation with professional design
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
  const date = new Date(activity.start_date_local).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short', 
    year: 'numeric'
  });
  
  // Truncate long activity names
  const displayName = activity.name.length > 40 
    ? activity.name.substring(0, 37) + '...' 
    : activity.name;
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#334155;stop-opacity:1" />
    </linearGradient>
    
    <linearGradient id="paceGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
    
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#bgGradient)"/>
  
  <text x="${width/2}" y="160" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600" opacity="0.9">${displayName}</text>
  
  <rect x="${width/2 - 200}" y="220" width="400" height="200" rx="24" fill="url(#paceGlow)" filter="url(#glow)" opacity="0.9"/>
  
  <text x="${width/2}" y="300" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" letter-spacing="-2px">${paceText}</text>
  
  <text x="${width/2}" y="340" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" letter-spacing="2px">PER KM</text>
  
  <text x="${width/2}" y="380" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="400">${date}</text>
  
  <g transform="translate(${width/2 - 300}, 480)">
    <rect x="0" y="0" width="180" height="120" rx="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <text x="90" y="35" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" letter-spacing="1px">DISTANCE</text>
    <text x="90" y="70" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="600">${distance}</text>
    <text x="90" y="95" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="400">km</text>
  </g>
  
  <g transform="translate(${width/2 - 90}, 480)">
    <rect x="0" y="0" width="180" height="120" rx="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <text x="90" y="35" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" letter-spacing="1px">TIME</text>
    <text x="90" y="70" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="600">${timeMinutes}</text>
    <text x="90" y="95" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="400">min</text>
  </g>
  
  <g transform="translate(${width/2 + 120}, 480)">
    <rect x="0" y="0" width="180" height="120" rx="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <text x="90" y="35" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" letter-spacing="1px">ELEVATION</text>
    <text x="90" y="70" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="600">${elevation}</text>
    <text x="90" y="95" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="400">m</text>
  </g>
  
  <text x="${width/2}" y="${height - 80}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="400">Powered by Strava</text>
  
  <circle cx="100" cy="100" r="3" fill="#3b82f6" opacity="0.6"/>
  <circle cx="${width-100}" cy="100" r="3" fill="#10b981" opacity="0.6"/>
  <circle cx="100" cy="${height-100}" r="3" fill="#f59e0b" opacity="0.6"/>
  <circle cx="${width-100}" cy="${height-100}" r="3" fill="#ef4444" opacity="0.6"/>
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
  console.log(`Strava Client ID: ${process.env.STRAVA_CLIENT_ID ? 'Configured' : 'Missing'}`);
  console.log(`Features: OAuth, Activities, Overlay Generation, Token Refresh`);
});

// Add route template import after axios line
const { generateRouteGlowOverlay } = require('./templates/route-glow');

// Add route template option to overlay generation
// (Add this inside your overlay generation endpoint, in the switch statement or after activity fetch)
// Update the overlay generation to support multiple templates:

/*
Replace this section in your overlay endpoint:
const svgContent = generateActivitySVG(activity, aspectRatio);

With this:
const svgContent = req.body.templateId === 'route-glow' 
  ? generateRouteGlowOverlay(activity, dimensions)
  : generateActivitySVG(activity, aspectRatio);
*/
