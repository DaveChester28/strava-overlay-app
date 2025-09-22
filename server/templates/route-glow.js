const { decodePolyline } = require('../polyline-decoder');

function generateRouteGlowOverlay(activity, options = {}) {
  const { width = 1080, height = 1080 } = options;
  
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
    month: 'short'
  });
  
  // Decode route if available
  let routePath = '';
  if (activity.map && activity.map.summary_polyline) {
    const coordinates = decodePolyline(activity.map.summary_polyline);
    if (coordinates.length > 0) {
      routePath = generateRoutePath(coordinates, width, height);
    }
  }
  
  // Truncate activity name
  const displayName = activity.name.length > 35 
    ? activity.name.substring(0, 32) + '...' 
    : activity.name;
  
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0c0a09;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#292524;stop-opacity:1" />
    </linearGradient>
    
    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#06d6a0;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
    
    <filter id="routeGlow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <filter id="cardGlow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#darkBg)"/>
  
  <!-- Route visualization (if available) -->
  ${routePath ? `
    <g opacity="0.3">
      <path d="${routePath}" stroke="url(#routeGradient)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <path d="${routePath}" stroke="url(#routeGradient)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#routeGlow)"/>
  ` : ''}
  
  <!-- Activity Title -->
  <text x="${width/2}" y="120" text-anchor="middle" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700">${displayName}</text>
  
  <!-- Floating Stats Cards -->
  <!-- Pace Card -->
  <g transform="translate(${width/2 - 120}, 180)">
    <rect x="0" y="0" width="240" height="140" rx="20" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" stroke-width="2" filter="url(#cardGlow)"/>
    <text x="120" y="35" text-anchor="middle" fill="#93c5fd" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" letter-spacing="1px">PACE</text>
    <text x="120" y="85" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700">${paceText}</text>
    <text x="120" y="110" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, -apple-system, sans-serif" font-size="14">per km</text>
  </g>
  
  <!-- Distance Badge -->
  <g transform="translate(120, 380)">
    <rect x="0" y="0" width="160" height="80" rx="40" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2"/>
    <text x="80" y="30" text-anchor="middle" fill="#6ee7b7" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500">DISTANCE</text>
    <text x="80" y="55" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">${distance} km</text>
  </g>
  
  <!-- Time Badge -->
  <g transform="translate(${width - 280}, 380)">
    <rect x="0" y="0" width="160" height="80" rx="40" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="2"/>
    <text x="80" y="30" text-anchor="middle" fill="#fbbf24" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500">TIME</text>
    <text x="80" y="55" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">${timeMinutes} min</text>
  </g>
  
  <!-- Elevation Badge -->
  <g transform="translate(${width/2 - 80}, 520)">
    <rect x="0" y="0" width="160" height="80" rx="40" fill="rgba(139, 92, 246, 0.2)" stroke="#8b5cf6" stroke-width="2"/>
    <text x="80" y="30" text-anchor="middle" fill="#c4b5fd" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500">ELEVATION</text>
    <text x="80" y="55" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">${elevation} m</text>
  </g>
  
  <!-- Date stamp -->
  <text x="${width/2}" y="${height - 120}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500">${date}</text>
  
  <!-- Attribution -->
  <text x="${width/2}" y="${height - 60}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="400">Powered by Strava</text>
</svg>`;
}

function generateRoutePath(coordinates, canvasWidth, canvasHeight) {
  if (coordinates.length < 2) return '';
  
  // Find bounding box
  let minLat = coordinates[0][0], maxLat = coordinates[0][0];
  let minLng = coordinates[0][1], maxLng = coordinates[0][1];
  
  coordinates.forEach(([lat, lng]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });
  
  // Calculate scale and offset to fit in canvas with padding
  const padding = 100;
  const mapWidth = canvasWidth - (padding * 2);
  const mapHeight = canvasHeight - (padding * 2);
  
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  
  const scale = Math.min(mapWidth / lngRange, mapHeight / latRange);
  
  // Center the route
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const routeCenterLng = (minLng + maxLng) / 2;
  const routeCenterLat = (minLat + maxLat) / 2;
  
  // Convert coordinates to SVG path
  let pathData = '';
  coordinates.forEach(([lat, lng], index) => {
    const x = centerX + (lng - routeCenterLng) * scale;
    const y = centerY - (lat - routeCenterLat) * scale; // Invert Y for SVG
    
    if (index === 0) {
      pathData += `M ${x} ${y}`;
    } else {
      pathData += ` L ${x} ${y}`;
    }
  });
  
  return pathData;
}

module.exports = { generateRouteGlowOverlay };
