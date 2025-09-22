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
    version: '2.2.0',
    strava_client_id: process.env.STRAVA_CLIENT_ID || 'not set',
    strava_ready: !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
    templates: ['clean-pace', 'route-glow']
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
    scope: scope
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
    
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const activity = activityResponse.data;
    const dimensions = getDimensions(aspectRatio);
    
    let svgContent;
    if (templateId === 'route-glow') {
      svgContent = generateRouteGlowTemplate(activity, dimensions);
    } else {
      svgContent = generateCleanPaceTemplate(activity, dimensions);
    }
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgContent);
    
  } catch (error) {
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
  const date = new Date(activity.start_date_local).toLocaleDateString('en-GB');
  
  const displayName = activity.name.length > 40 
    ? activity.name.substring(0, 37) + '...' 
    : activity.name;
  
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#334155;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="paceGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#bgGradient)"/>
  
  <text x="${width/2}" y="160" text-anchor="middle" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="36" font-weight="600">${displayName}</text>
  
  <rect x="${width/2 - 200}" y="220" width="400" height="200" rx="24" fill="url(#paceGlow)"/>
  
  <text x="${width/2}" y="300" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="72" font-weight="700">${paceText}</text>
  
  <text x="${width/2}" y="340" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, sans-serif" font-size="20" font-weight="500">PER KM</text>
  
  <text x="200" y="550" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24" font-weight="600">${distance} km</text>
  <text x="200" y="580" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, sans-serif" font-size="14">DISTANCE</text>
  
  <text x="${width/2}" y="550" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24" font-weight="600">${timeMinutes} min</text>
  <text x="${width/2}" y="580" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, sans-serif" font-size="14">TIME</text>
  
  <text x="${width-200}" y="550" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24" font-weight="600">${elevation} m</text>
  <text x="${width-200}" y="580" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="system-ui, sans-serif" font-size="14">ELEVATION</text>
  
  <text x="${width/2}" y="${height - 80}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="system-ui, sans-serif" font-size="14">Powered by Strava</text>
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
  
  const displayName = activity.name.length > 35 
    ? activity.name.substring(0, 32) + '...' 
    : activity.name;
  
  // Decode route if available
  let routePath = '';
  if (activity.map && activity.map.summary_polyline) {
    const coordinates = decodePolyline(activity.map.summary_polyline);
    if (coordinates.length > 0) {
      routePath = generateRoutePath(coordinates, width, height);
    }
  }
  
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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
  </defs>
  
  <rect width="100%" height="100%" fill="url(#darkBg)"/>
  
  ${routePath ? `<path d="${routePath}" stroke="url(#routeGradient)" stroke-width="8" fill="none" stroke-linecap="round"/>` : ''}
  
  <text x="${width/2}" y="140" text-anchor="middle" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="42" font-weight="700">${displayName}</text>
  
  <rect x="${width/2 - 120}" y="180" width="240" height="120" rx="60" fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" stroke-width="2"/>
  <text x="${width/2}" y="220" text-anchor="middle" fill="#60a5fa" font-family="system-ui, sans-serif" font-size="16">PACE</text>
  <text x="${width/2}" y="260" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="36" font-weight="700">${paceText}</text>
  
  <text x="200" y="400" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24">${distance} km</text>
  <text x="${width/2}" y="400" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24">${timeMinutes} min</text>
  <text x="${width-200}" y="400" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24">${elevation} m</text>
  
  <text x="${width/2}" y="${height - 60}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui, sans-serif" font-size="14">Powered by Strava</text>
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
});
