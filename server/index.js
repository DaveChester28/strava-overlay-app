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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
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

// Add canvas import at top (after other requires)
const { generateCleanPaceOverlay } = require('./templates/clean-pace');

// Generate overlay endpoint
app.post('/api/generate-overlay', async (req, res) => {
  try {
    const { activityId, templateId = 'clean-pace', aspectRatio = '1:1' } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
    // Fetch activity details from Strava
    const activityResponse = await axios.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const activity = activityResponse.data;
    console.log(`Generating overlay for: ${activity.name}`);
    
    // Get dimensions for aspect ratio
    const dimensions = getDimensions(aspectRatio);
    
    // Generate overlay based on template
    let canvas;
    switch(templateId) {
      case 'clean-pace':
        canvas = generateCleanPaceOverlay(activity, dimensions);
        break;
      default:
        return res.status(400).json({ error: 'Unknown template' });
    }
    
    // Convert to PNG buffer
    const buffer = canvas.toBuffer('image/png');
    
    console.log(`Generated ${buffer.length} byte overlay for activity ${activityId}`);
    
    // Return image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${activity.name.replace(/[^a-zA-Z0-9]/g, '-')}-overlay.png"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Overlay generation error:', error);
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
    res.status(500).json({ error: 'Failed to generate overlay', details: error.message });
  }
});

function getDimensions(aspectRatio) {
  switch(aspectRatio) {
    case '1:1': return { width: 1080, height: 1080 };
    case '4:5': return { width: 1080, height: 1350 };
    case '9:16': return { width: 1080, height: 1920 };
    default: return { width: 1080, height: 1080 };
  }
}
