const mongoose = require('mongoose');

const connectDB = async () => {
  // Try to connect to MongoDB Atlas first
  const mongoURI = process.env.MONGODB_URI;
  const localMongoURI = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/schoolmanager';

  try {
    if (!mongoURI) {
      console.warn('MONGODB_URI is not defined, using local MongoDB');
      return await connectToMongoDB(localMongoURI, 'Local');
    }

    console.log('Attempting to connect to MongoDB Atlas...');
    return await connectToMongoDB(mongoURI, 'Atlas');

  } catch (error) {
    console.error('Error connecting to MongoDB Atlas:', error.message);
    console.log('Falling back to local MongoDB...');

    try {
      return await connectToMongoDB(localMongoURI, 'Local');
    } catch (localError) {
      console.error('Error connecting to local MongoDB:', localError.message);
      console.error('\nPlease ensure MongoDB is installed and running locally:');
      console.error('  - Install: https://www.mongodb.com/docs/manual/installation/');
      console.error('  - Start: sudo systemctl start mongod (Linux)');
      process.exit(1);
    }
  }
};

const connectToMongoDB = async (uri, label) => {
  const conn = await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  console.log(`MongoDB ${label} Connected: ${conn.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error(`MongoDB ${label} connection error:`, err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log(`MongoDB ${label} disconnected`);
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });

  return conn;
};

module.exports = connectDB;
