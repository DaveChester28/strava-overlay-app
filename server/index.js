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
