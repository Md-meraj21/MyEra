// start-live.js - Full-Stack Launcher & HTTPS Live Link Tunnel for MyEra
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');

console.log('\n================================================================');
console.log('    🎓 MyEra Smart Classroom Attendance System - Live Mode      ');
console.log('================================================================\n');

// Helper to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(true);
      else resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '0.0.0.0');
  });
}

// Helper to fetch public IP for localtunnel verification
function getPublicIP() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve('Not detected'));
    req.on('timeout', () => {
      req.destroy();
      resolve('Not detected');
    });
  });
}

async function main() {
  let backendProcess = null;
  let frontendProcess = null;

  // 1. Start Backend if not already running
  const backendRunning = await isPortInUse(5000);
  if (backendRunning) {
    console.log('ℹ️  Backend server is already running on http://localhost:5000');
  } else {
    console.log('📦 Starting Backend Server on http://localhost:5000 ...');
    backendProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      shell: true
    });
  }

  // 2. Start Frontend Dev Server
  console.log('⚡ Starting Frontend Vite Server on http://localhost:3000 ...');
  frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true
  });

  // 3. Fetch Public IP
  const publicIP = await getPublicIP();

  // 4. Start HTTPS Live Tunnel
  setTimeout(() => {
    console.log('\n🔒 Initializing secure HTTPS Tunnel for Mobile & Geolocation Access...');

    const ltProcess = spawn('npx', ['--yes', 'localtunnel', '--port', '3000'], {
      shell: true
    });

    ltProcess.stdout.on('data', (data) => {
      const raw = data.toString().trim();
      const match = raw.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
      const url = match ? match[0] : (raw.startsWith('http') ? raw : null);

      if (url) {
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│  🎉 YOUR LIVE HTTPS LINK IS READY!                          │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│  🔗 Live URL:  ${url}`);
        console.log('│                                                             │');
        console.log('│  📱 Open this link on your Mobile Phone / Tablet / Laptop    │');
        console.log('│  📍 HTTPS is active: Location & GPS permissions will work!  │');
        if (publicIP && publicIP !== 'Not detected') {
          console.log(`│  🔑 Localtunnel Password (if prompted): ${publicIP}        │`);
        }
        console.log('└─────────────────────────────────────────────────────────────┘\n');
        console.log('💡 Tip: Keep this terminal window open while using the live link.');
        console.log('Press Ctrl + C to stop all servers and live tunnel.\n');
      }
    });

    ltProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (!msg.includes('DeprecationWarning')) {
        console.log(`[Tunnel Info] ${msg}`);
      }
    });

    ltProcess.on('close', (code) => {
      console.log(`Live tunnel stopped (code ${code}).`);
    });
  }, 4000);

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping all MyEra live services...');
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start live mode:', err);
});
