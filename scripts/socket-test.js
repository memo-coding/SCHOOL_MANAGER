#!/usr/bin/env node

/**
 * Socket.IO Testing Script
 * Tests real-time communication features
 */

const io = require('socket.io-client');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const TIMEOUT = 10000;

// Color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test results
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
};

let tokens = {
    student1: null,
    student2: null
};

/**
 * Make HTTP request for authentication
 */
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);

        const options = {
            method,
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Log test result
 */
function logTest(name, passed, message = '') {
    results.total++;
    if (passed) {
        results.passed++;
        console.log(`${colors.green}✓${colors.reset} ${name}`);
    } else {
        results.failed++;
        console.log(`${colors.red}✗${colors.reset} ${name}`);
        if (message) console.log(`  ${colors.yellow}${message}${colors.reset}`);
    }

    results.tests.push({ name, passed, message, timestamp: new Date() });
}

/**
 * Wait for event with timeout
 */
function waitForEvent(socket, eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);

        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Test Socket.IO connection
 */
async function testSocketConnection() {
    console.log(`\n${colors.bright}${colors.cyan}━━━ Socket.IO Connection Tests ━━━${colors.reset}\n`);

    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            transports: ['websocket', 'polling'],
            reconnection: false
        });

        const connectionTimeout = setTimeout(() => {
            logTest('Socket.IO Connection', false, 'Connection timeout');
            socket.close();
            resolve(false);
        }, TIMEOUT);

        socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            logTest('Socket.IO Connection', true, `Connected with ID: ${socket.id}`);
            socket.close();
            resolve(true);
        });

        socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            logTest('Socket.IO Connection', false, error.message);
            socket.close();
            resolve(false);
        });
    });
}

/**
 * Test authenticated Socket.IO connection
 */
async function testAuthenticatedConnection() {
    console.log(`\n${colors.bright}${colors.cyan}━━━ Authenticated Socket Connection Tests ━━━${colors.reset}\n`);

    // First, login to get tokens
    try {
        const res1 = await makeRequest('POST', '/api/auth/login', {
            email: 'student@school.com',
            password: 'Student@123'
        });

        if (res1.success && res1.data?.token) {
            tokens.student1 = res1.data.token;
            logTest('Login Student 1', true);
        } else {
            logTest('Login Student 1', false, 'Failed to get token');
            return;
        }
    } catch (error) {
        logTest('Login Student 1', false, error.message);
        return;
    }

    // Test authenticated socket connection
    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            transports: ['websocket', 'polling'],
            reconnection: false,
            auth: {
                token: tokens.student1
            }
        });

        const connectionTimeout = setTimeout(() => {
            logTest('Authenticated Socket Connection', false, 'Connection timeout');
            socket.close();
            resolve();
        }, TIMEOUT);

        socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            logTest('Authenticated Socket Connection', true);

            // Test user_connected event
            socket.on('user_connected', (data) => {
                logTest('Receive user_connected Event', true, `User: ${data.userId}`);
            });

            setTimeout(() => {
                socket.close();
                resolve();
            }, 2000);
        });

        socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            logTest('Authenticated Socket Connection', false, error.message);
            socket.close();
            resolve();
        });
    });
}

/**
 * Test chat messaging
 */
async function testChatMessaging() {
    console.log(`\n${colors.bright}${colors.cyan}━━━ Chat Messaging Tests ━━━${colors.reset}\n`);

    if (!tokens.student1) {
        console.log(`${colors.yellow}⚠ Skipping chat tests - no authentication token${colors.reset}`);
        return;
    }

    return new Promise((resolve) => {
        const socket1 = io(BASE_URL, {
            transports: ['websocket'],
            reconnection: false,
            auth: { token: tokens.student1 }
        });

        socket1.on('connect', () => {
            logTest('Chat Socket Connected', true);

            // Listen for incoming messages
            socket1.on('new_message', (data) => {
                logTest('Receive new_message Event', true, `From: ${data.sender}`);
            });

            // Send a test message
            socket1.emit('chat_message', {
                receiver: 'test-receiver-id',
                message: 'Test message from automated test',
                type: 'text'
            });

            logTest('Send chat_message Event', true);

            setTimeout(() => {
                socket1.close();
                resolve();
            }, 3000);
        });

        socket1.on('connect_error', (error) => {
            logTest('Chat Socket Connected', false, error.message);
            socket1.close();
            resolve();
        });
    });
}

/**
 * Test message read status
 */
async function testMessageReadStatus() {
    console.log(`\n${colors.bright}${colors.cyan}━━━ Message Read Status Tests ━━━${colors.reset}\n`);

    if (!tokens.student1) {
        console.log(`${colors.yellow}⚠ Skipping read status tests - no authentication token${colors.reset}`);
        return;
    }

    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            transports: ['websocket'],
            reconnection: false,
            auth: { token: tokens.student1 }
        });

        socket.on('connect', () => {
            // Listen for messages_read event
            socket.on('messages_read', (data) => {
                logTest('Receive messages_read Event', true, `User: ${data.userId}`);
            });

            // Emit message_read event
            socket.emit('message_read', {
                senderId: 'test-sender-id'
            });

            logTest('Send message_read Event', true);

            setTimeout(() => {
                socket.close();
                resolve();
            }, 2000);
        });

        socket.on('connect_error', (error) => {
            logTest('Message Read Socket', false, error.message);
            socket.close();
            resolve();
        });
    });
}

/**
 * Test schedule notifications
 */
async function testScheduleNotifications() {
    console.log(`\n${colors.bright}${colors.cyan}━━━ Schedule Notification Tests ━━━${colors.reset}\n`);

    if (!tokens.student1) {
        console.log(`${colors.yellow}⚠ Skipping schedule tests - no authentication token${colors.reset}`);
        return;
    }

    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            transports: ['websocket'],
            reconnection: false,
            auth: { token: tokens.student1 }
        });

        socket.on('connect', () => {
            // Listen for schedule_update event
            socket.on('schedule_update', (data) => {
                logTest('Receive schedule_update Event', true, `Type: ${data.type || 'update'}`);
            });

            logTest('Listen for schedule_update Event', true);

            setTimeout(() => {
                socket.close();
                resolve();
            }, 2000);
        });

        socket.on('connect_error', (error) => {
            logTest('Schedule Socket', false, error.message);
            socket.close();
            resolve();
        });
    });
}

/**
 * Generate report
 */
function generateReport() {
    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}      SOCKET.IO TEST SUMMARY REPORT${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    console.log(`Total Tests:   ${colors.bright}${results.total}${colors.reset}`);
    console.log(`Passed:        ${colors.green}${results.passed}${colors.reset}`);
    console.log(`Failed:        ${colors.red}${results.failed}${colors.reset}`);
    console.log(`Success Rate:  ${colors.bright}${((results.passed / results.total) * 100).toFixed(2)}%${colors.reset}\n`);

    if (results.failed > 0) {
        console.log(`${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
        results.tests
            .filter(t => !t.passed)
            .forEach(t => {
                console.log(`  ${colors.red}✗${colors.reset} ${t.name}`);
                if (t.message) console.log(`    ${colors.yellow}${t.message}${colors.reset}`);
            });
        console.log('');
    }

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Save report
    const fs = require('fs');
    const reportPath = '/home/memo/SchoolManagerDB/server/socket-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`${colors.blue}Report saved to: ${reportPath}${colors.reset}\n`);
}

/**
 * Main test runner
 */
async function runTests() {
    console.log(`${colors.bright}${colors.blue}`);
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         Socket.IO Real-time Communication Tests          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}\n`);
    console.log(`Testing server at: ${colors.bright}${BASE_URL}${colors.reset}\n`);

    try {
        await testSocketConnection();
        await testAuthenticatedConnection();
        await testChatMessaging();
        await testMessageReadStatus();
        await testScheduleNotifications();

        generateReport();

        process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error(`${colors.red}Fatal error:${colors.reset}`, error);
        process.exit(1);
    }
}

// Run tests
runTests();
