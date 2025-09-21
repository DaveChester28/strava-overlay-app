const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World! Server is running.' });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    strava_client_id: process.env.STRAVA_CLIENT_ID || 'not set',
    strava_ready: !!process.env.STRAVA_CLIENT_ID
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Updated Sun 21 Sep 2025 21:02:54 BST

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
    next_step: 'Exchange this code for access token'
  });
});

// Token exchange endpoint
app.post('/auth/token', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    console.log('Received OAuth code:', code);
    
    // For now, just confirm we received the code
    // Real Strava token exchange will be added next
    res.json({
      success: true,
      message: 'Code received - ready for Strava token exchange',
      code_received: code.substring(0, 8) + '...',
      next: 'Add axios dependency for real Strava API calls'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});
