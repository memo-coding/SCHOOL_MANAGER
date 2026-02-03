#!/usr/bin/env node

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const email = 'admin@school.com';
const password = 'Admin@123';

async function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        body: body ? JSON.parse(body) : {}
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runTest() {
    console.log('--- Testing Optimized getSubjectsWithStudents ---');

    // 1. Login
    const loginRes = await makeRequest('POST', '/api/auth/login', { email, password });
    if (loginRes.statusCode !== 200 || !loginRes.body.success) {
        console.error('Login failed:', loginRes.body);
        process.exit(1);
    }
    const token = loginRes.body.data.token;
    console.log('Login successful');

    // 2. Test getSubjectsWithStudents
    const startTime = Date.now();
    const res = await makeRequest('GET', '/api/subjects/with-students', null, token);
    const duration = Date.now() - startTime;

    if (res.statusCode === 200 && res.body.success) {
        console.log('SUCCESS: getSubjectsWithStudents returned successfully');
        console.log(`Duration: ${duration}ms`);
        console.log(`Subjects count: ${res.body.data.subjects.length}`);

        if (res.body.data.subjects.length > 0) {
            const firstSubject = res.body.data.subjects[0];
            console.log('Sample Subject:', {
                name: firstSubject.subject_name,
                classCount: firstSubject.classes.length,
                studentCount: firstSubject.students.length,
                totalStudentsField: firstSubject.total_students
            });

            if (firstSubject.students.length > 0) {
                console.log('Sample Student Name:', firstSubject.students[0].name);
            }
        }
    } else {
        console.error('FAILED: getSubjectsWithStudents failed');
        console.error('Status:', res.statusCode);
        console.error('Body:', JSON.stringify(res.body, null, 2));
        process.exit(1);
    }
}

runTest();
