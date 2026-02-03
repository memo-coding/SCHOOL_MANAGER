const mongoose = require('mongoose');
require('dotenv').config();
const { ClassSubject } = require('../src/models');

async function fixClassSubjectsStatus() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully\n');

        console.log('Finding ClassSubjects with missing or invalid status...');

        // Find documents where status is missing or not 'active'
        // Note: The schema default is 'active', but existing docs might not have it.
        // Also checking for 'inactive' just in case we want to bulk activate everything (optional based on requirement, but assuming we want to fix missing ones mainly)
        // The issue description implies they show in management but not student view. Management doesn't filter. Student view filters for 'active'.
        // So any document NOT 'active' is the target.

        const filter = {
            $or: [
                { status: { $exists: false } },
                { status: null },
                { status: '' }
                // We probably shouldn't blindly flip 'inactive' to 'active' if they were intentionally inactive,
                // but given the "No subjects enrolled" complaint for what looks like active classes, it's likely they just have NO status.
            ]
        };

        const count = await ClassSubject.countDocuments(filter);
        console.log(`Found ${count} ClassSubjects to update.`);

        if (count > 0) {
            const result = await ClassSubject.updateMany(filter, {
                $set: { status: 'active' }
            });
            console.log(`Successfully updated ${result.modifiedCount} documents.`);
        } else {
            console.log('No documents needed updating.');
        }

        // Double check counts
        const activeCount = await ClassSubject.countDocuments({ status: 'active' });
        const totalCount = await ClassSubject.countDocuments({});
        console.log(`\nFinal Status:`);
        console.log(`Total ClassSubjects: ${totalCount}`);
        console.log(`Active ClassSubjects: ${activeCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nConnection closed');
    }
}

fixClassSubjectsStatus();
