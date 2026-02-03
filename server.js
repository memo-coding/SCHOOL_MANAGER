require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./src/config/database');
const routes = require('./src/routes');
const morgan = require('morgan');
const { errorHandler } = require('./src/middleware/errorHandler');
const { initializeData, seedDemoData } = require('./src/utils/initData');

const app = express();
const server = http.createServer(app);
const { initializeSocket } = require('./src/socket');

initializeSocket(server);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const path = require('path');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'School Management System API',
    data: {
      version: '1.0.0',
      documentation: '/api/health',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        students: '/api/students',
        teachers: '/api/teachers',
        classes: '/api/classes',
        subjects: '/api/subjects',
        class_subjects: '/api/class-subjects',
        fees: '/api/fees',
        absences: '/api/absences',
        notifications: '/api/notifications',
        schedules: '/api/schedules'
      }
    }
  });
});

app.use('/api', routes);

app.use((req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    errors: [`Cannot ${req.method} ${req.originalUrl}`]
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    await initializeData();

    if (process.env.SEED_DEMO_DATA === 'true') {
      await seedDemoData();
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

startServer();
