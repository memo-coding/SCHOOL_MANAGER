const mongoose = require('mongoose');
const User = require('../src/models/User');
const { getContactsForUser } = require('../src/controllers/chatController');
require('dotenv').config();

async function testPerformance() {
    console.log('--- Testing Chat Performance ---');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find a random student to test with
        const student = await User.findOne({ role: 'student', is_active: true });
        if (!student) {
            console.log('No active student found for testing');
            process.exit(0);
        }

        console.log(`Testing performance for user: ${student.username} (${student._id})`);

        const start = Date.now();
        const contacts = await getContactsForUser(student);
        const end = Date.now();

        console.log(`Fetched ${contacts.length} contacts in ${end - start}ms`);

        if (contacts.length > 0) {
            console.log('Sample contact structure:', JSON.stringify(contacts[0], null, 2).substring(0, 300) + '...');
        }

        console.log('SUCCESS: Performance test completed');
        process.exit(0);
    } catch (error) {
        console.error('Performance test failed:', error);
        process.exit(1);
    }
}

testPerformance();
