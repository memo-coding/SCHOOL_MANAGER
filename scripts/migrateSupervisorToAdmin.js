const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

async function migrateSupervisorToAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Find all supervisor users
        const supervisorUsers = await User.find({ role: 'supervisor' });
        console.log(`Found ${supervisorUsers.length} supervisor users`);

        if (supervisorUsers.length === 0) {
            console.log('No supervisor users to migrate');
            await mongoose.disconnect();
            return;
        }

        // Update all supervisor users to admin
        const result = await User.updateMany(
            { role: 'supervisor' },
            { $set: { role: 'admin' } }
        );

        console.log(`Successfully migrated ${result.modifiedCount} supervisor users to admin role`);

        // Verify migration
        const remainingSupervisors = await User.countDocuments({ role: 'supervisor' });
        if (remainingSupervisors === 0) {
            console.log('✓ Migration verified: No supervisor users remaining');
        } else {
            console.warn(`⚠ Warning: ${remainingSupervisors} supervisor users still exist`);
        }

        await mongoose.disconnect();
        console.log('Migration complete - Database disconnected');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateSupervisorToAdmin();
