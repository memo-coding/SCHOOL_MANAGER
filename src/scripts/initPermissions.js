require('dotenv').config();
const connectDB = require('../config/database');
const { Permission } = require('../models');

const initPermissions = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('Initializing permissions...');
        await Permission.initializePermissions();

        console.log('✅ Permissions initialized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing permissions:', error.message);
        process.exit(1);
    }
};

initPermissions();
