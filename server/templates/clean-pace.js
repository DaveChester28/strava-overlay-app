const { createCanvas } = require('canvas');

function generateCleanPaceOverlay(activity, options = {}) {
  const { width = 1080, height = 1080 } = options;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Calculate pace
  const paceSeconds = (activity.moving_time / (activity.distance / 1000));
  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceSecs = Math.round(paceSeconds % 60);
  const paceText = `${paceMinutes}:${paceSecs.toString().padStart(2, '0')}`;
  
  // Activity name
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(activity.name, width/2, 200);
  
  // Main pace
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 120px Arial';
  ctx.fillText(paceText, width/2, 400);
  
  // Pace label
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('PER KM', width/2, 450);
  
  // Stats
  const distance = (activity.distance / 1000).toFixed(1);
  const timeMinutes = Math.floor(activity.moving_time / 60);
  const elevation = Math.round(activity.total_elevation_gain);
  
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'left';
  
  // Distance
  ctx.fillText(`${distance} km`, 150, 650);
  ctx.fillStyle = '#64748b';
  ctx.font = '24px Arial';
  ctx.fillText('DISTANCE', 150, 680);
  
  // Time
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`${timeMinutes} min`, 400, 650);
  ctx.fillStyle = '#64748b';
  ctx.font = '24px Arial';
  ctx.fillText('TIME', 400, 680);
  
  // Elevation
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(`${elevation} m`, 650, 650);
  ctx.fillStyle = '#64748b';
  ctx.font = '24px Arial';
  ctx.fillText('ELEVATION', 650, 680);
  
  // Date
  const date = new Date(activity.start_date_local);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(date.toLocaleDateString(), width/2, 800);
  
  // Powered by Strava
  ctx.fillStyle = '#64748b';
  ctx.font = '20px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('Powered by Strava', width - 50, height - 50);
  
  return canvas;
}

module.exports = { generateCleanPaceOverlay };
