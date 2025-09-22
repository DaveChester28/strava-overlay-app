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
    templates: ['clean-pace', 'route-glow'],
    features: ['oauth', 'activities', 'overlay-generation', 'token-refresh']
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
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

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

app.post('/api/generate-overlay', async (req, res) => {
  try {
    const { activityId, aspectRatio = '1:1', templateId = 'clean-pace' } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
<<<<<<< Updated upstream
    console.log(`Generating overlay for activity ${activityId} with template ${templateId}, aspect ratio ${aspectRatio}`);
=======
    console.log(`Generating ${templateId} overlay for activity ${activityId}`);
>>>>>>> Stashed changes
    
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const activity = activityResponse.data;
<<<<<<< Updated upstream
console.log(`Activity loaded: ${activity.name}...`);

const dimensions = getDimensions(aspectRatio);  // ← ADD THIS LINE
const templateId = req.body.templateId || 'clean-pace';

// Generate SVG overlay
const svgContent = templateId === 'route-glow' 
  ? generateRouteGlowOverlay(activity, dimensions)
  : generateActivitySVG(activity, aspectRatio);
=======
    const dimensions = getDimensions(aspectRatio);
    
    let svgContent;
    
    if (templateId === 'route-glow') {
      svgContent = generateRouteGlowTemplate(activity, dimensions);
    } else {
      svgContent = generateCleanPaceTemplate(activity, dimensions);
    }
>>>>>>> Stashed changes
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${activity.name.replace(/[^a-zA-Z0-9]/g, '-')}-${templateId}-overlay.svg"`);
    res.send(svgContent);
    
  } catch (error) {
    console.error('Overlay generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate overlay',
      details: error.message 
    });
  }
});

function generateCleanPaceTemplate(activity, dimensions) {
  const { width, height } = dimensions;
  
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

function generateRouteGlowTemplate(activity, dimensions) {
  const { width, height } = dimensions;
  
  const paceSeconds = (activity.moving_time / (activity.distance / 1000));
  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceSecs = Math.round(paceSeconds % 60);
  const paceText = `${paceMinutes}:${paceSecs.toString().padStart(2, '0')}`;
  
  const distance = (activity.distance / 1000).toFixed(1);
  const timeMinutes = Math.floor(activity.moving_time / 60);
  const elevation = Math.round(activity.total_elevation_gain);
  const date = new Date(activity.start_date_local).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
  
  const displayName = activity.name.length > 35 
    ? activity.name.substring(0, 32) + '...' 
    : activity.name;
  
  // Decode and render route
  let routePath = '';
  if (activity.map && activity.map.summary_polyline) {
    const coordinates = decodePolyline(activity.map.summary_polyline);
    if (coordinates.length > 0) {
      routePath = generateRoutePath(coordinates, width, height);
    }
  }
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="darkBg" cx="50%" cy="50%" r="100%">
      <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0c0a09;stop-opacity:1" />
    </radialGradient>
    
    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#06d6a0;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
    
    <filter id="routeGlow">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#darkBg)"/>
  
  ${routePath ? `
    <g opacity="0.4">
      <path d="${routePath}" stroke="url(#routeGradient)" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <path d="${routePath}" stroke="url(#routeGradient)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#routeGlow)"/>
  ` : ''}
  
  <text x="${width/2}" y="140" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700">${displayName}</text>
  
  <g transform="translate(140, 200)">
    <rect x="0" y="0" width="180" height="100" rx="50" fill="rgba(6, 214, 160, 0.15)" stroke="#06d6a0" stroke-width="2"/>
    <text x="90" y="35" text-anchor="middle" fill="#34d399" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500">DISTANCE</text>
    <text x="90" y="65" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600">${distance} km</text>
  </g>
  
  <g transform="translate(${width/2 - 120}, 180)">
    <rect x="0" y="0" width="240" height="120" rx="60" fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" stroke-width="2"/>
    <text x="120" y="40" text-anchor="middle" fill="#60a5fa" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500">PACE</text>
    <text x="120" y="80" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700">${paceText}</text>
  </g>
  
  <g transform="translate(${width - 320}, 200)">
    <rect x="0" y="0" width="180" height="100" rx="50" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" stroke-width="2"/>
    <text x="90" y="35" text-anchor="middle" fill="#a78bfa" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500">TIME</text>
    <text x="90" y="65" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600">${timeMinutes} min</text>
  </g>
  
  <g transform="translate(${width/2 - 90}, ${height - 200})">
    <rect x="0" y="0" width="180" height="80" rx="40" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="2"/>
    <text x="90" y="30" text-anchor="middle" fill="#fbbf24" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500">ELEVATION</text>
    <text x="90" y="55" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">${elevation} m</text>
  </g>
  
  <text x="${width/2}" y="${height - 60}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="400">Powered by Strava</text>
</svg>`;
}

function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b;

    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);

    lat += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    result = 1;
    shift = 0;

    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);

    lng += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function generateRoutePath(coordinates, canvasWidth, canvasHeight) {
  if (coordinates.length < 2) return '';
  
  let minLat = coordinates[0][0], maxLat = coordinates[0][0];
  let minLng = coordinates[0][1], maxLng = coordinates[0][1];
  
  coordinates.forEach(([lat, lng]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });
  
  const padding = 160;
  const mapWidth = canvasWidth - (padding * 2);
  const mapHeight = canvasHeight - (padding * 2);
  
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  
  const scale = Math.min(mapWidth / lngRange, mapHeight / latRange);
  
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const routeCenterLng = (minLng + maxLng) / 2;
  const routeCenterLat = (minLat + maxLat) / 2;
  
  let pathData = '';
  coordinates.forEach(([lat, lng], index) => {
    const x = centerX + (lng - routeCenterLng) * scale;
    const y = centerY - (lat - routeCenterLat) * scale;
    
    if (index === 0) {
      pathData += `M ${x} ${y}`;
    } else {
      pathData += ` L ${x} ${y}`;
    }
  });
  
  return pathData;
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
  console.log(`Templates: Clean Pace, Route Glow`);
});
