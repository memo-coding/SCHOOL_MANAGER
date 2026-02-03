const http = require('http');
const path = require('path');

const TOKEN = process.env.TEST_TOKEN || '';

async function testUpload() {
    console.log('--- Testing Chat Upload Safety ---');

    console.log('1. Testing upload without files...');
    const options = {
        hostname: 'localhost',
        port: 5001,
        path: '/api/chat/upload',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Response:', data);
        });
    });

    req.on('error', (error) => {
        console.log('Request Error (Server might be down, which is expected if not started or not local):', error.message);
    });

    req.end();

    // Check configuration
    setTimeout(() => {
        console.log('\n2. Checking multer configuration...');
        try {
            const chatUpload = require('../src/middleware/chatUpload');
            console.log('Multer Limit:', chatUpload.limits.fileSize / (1024 * 1024), 'MB');
            if (chatUpload.limits.fileSize === 20 * 1024 * 1024) {
                console.log('SUCCESS: File size limit is correctly set to 20MB');
            } else {
                console.error('FAIL: File size limit is NOT 20MB');
            }
        } catch (error) {
            console.error('Error checking multer config:', error.message);
        }
    }, 1000);
}

if (require.main === module) {
    testUpload();
}
