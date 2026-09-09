require('dotenv').config();
const dns = require('dns');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Set reliable DNS servers and force IPv4 first to prevent ENETUNREACH / timeout errors on cloud hosting (Render)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (dnsErr) {
  console.warn('DNS server configuration warning:', dnsErr.message);
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startReminderScheduler } = require('./services/reminderScheduler');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myera_attendance';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MyEra Smart Classroom Attendance System API is running smoothly.',
    timestamp: new Date()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start HTTP Server immediately
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MyEra Attendance Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} is already in use by another running instance.`);
    console.log(`💡 Tip: If another terminal is already running MyEra (e.g. npm run live), stop it with Ctrl+C first.`);
  } else {
    console.error('Server error:', err);
  }
});

// Connect to MongoDB Atlas (with fallback to local MongoDB if Atlas IP whitelist is not set)
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Successfully connected to MongoDB database.');
  } catch (err) {
    console.warn('⚠️ Primary MongoDB connection failed:', err.message);
    if (!MONGODB_URI.includes('127.0.0.1')) {
      console.log('🔄 Attempting fallback connection to local MongoDB...');
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/myera_attendance', { serverSelectionTimeoutMS: 3000 });
        console.log('✅ Connected to local MongoDB fallback database.');
      } catch (localErr) {
        console.error('❌ Could not connect to local MongoDB fallback:', localErr.message);
      }
    }
  }

  // Start background class timetable 5-minute reminder scheduler
  startReminderScheduler();
};

connectDB();

module.exports = app;
