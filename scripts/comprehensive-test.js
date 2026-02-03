#!/usr/bin/env node

/**
 * Comprehensive Server Testing Script
 * Tests all API endpoints and generates detailed report
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const TIMEOUT = 10000;

// Test results storage
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  startTime: new Date(),
  endTime: null
};

// Authentication tokens
let tokens = {
  superAdmin: null,
  admin: null,
  teacher: null,
  student: null
};

// Test data IDs
let testData = {
  studentId: null,
  teacherId: null,
  classId: null,
  subjectId: null,
  classSubjectId: null,
  feeId: null,
  absenceId: null,
  scheduleId: null,
  courseId: null,
  examId: null,
  materialId: null
};

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: TIMEOUT
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Log test result
 */
function logTest(name, passed, message = '', response = null) {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } else {
    results.failed++;
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (message) console.log(`  ${colors.yellow}${message}${colors.reset}`);
  }

  results.tests.push({
    name,
    passed,
    message,
    response: response ? {
      statusCode: response.statusCode,
      body: typeof response.body === 'object' ? JSON.stringify(response.body).substring(0, 200) : response.body
    } : null,
    timestamp: new Date()
  });
}

/**
 * Test section header
 */
function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}━━━ ${title} ━━━${colors.reset}\n`);
}

/**
 * Phase 1: Infrastructure Tests
 */
async function testInfrastructure() {
  logSection('Phase 1: Infrastructure Tests');

  try {
    const res = await makeRequest('GET', '/');
    logTest(
      'Server Root Endpoint',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Server Root Endpoint', false, error.message);
  }

  try {
    const res = await makeRequest('GET', '/api/health');
    logTest(
      'Health Check Endpoint',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Health Check Endpoint', false, error.message);
  }
}

/**
 * Phase 2: Authentication Tests
 */
async function testAuthentication() {
  logSection('Phase 2: Authentication Tests');

  // Test login with different roles
  const credentials = [
    { email: 'admin@school.com', password: 'Admin@123', role: 'superAdmin' },
    { email: 'teacher1@school.com', password: 'Teacher@123', role: 'teacher' },
    { email: 'student1@school.com', password: 'Student@123', role: 'student' }
  ];

  for (const cred of credentials) {
    try {
      const res = await makeRequest('POST', '/api/auth/login', {
        email: cred.email,
        password: cred.password
      });

      const passed = res.statusCode === 200 && res.body.success && res.body.data?.token;
      if (passed) {
        tokens[cred.role] = res.body.data.token;
      }

      logTest(
        `Login as ${cred.role}`,
        passed,
        !passed ? `Status: ${res.statusCode}, Message: ${res.body.message || 'Unknown error'}` : '',
        res
      );
    } catch (error) {
      logTest(`Login as ${cred.role}`, false, error.message);
    }
  }

  // Test get current user
  if (tokens.superAdmin) {
    try {
      const res = await makeRequest('GET', '/api/auth/me', null, tokens.superAdmin);
      logTest(
        'Get Current User (Super Admin)',
        res.statusCode === 200 && res.body.success,
        res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
        res
      );
    } catch (error) {
      logTest('Get Current User (Super Admin)', false, error.message);
    }
  }

  // Test registration
  try {
    const randomEmail = `test${Date.now()}@school.com`;
    const res = await makeRequest('POST', '/api/auth/register', {
      name: 'Test User',
      email: randomEmail,
      password: 'Test@123',
      role: 'student'
    });

    logTest(
      'User Registration',
      res.statusCode === 201 && res.body.success,
      res.statusCode !== 201 ? `Status: ${res.statusCode}, Message: ${res.body.message || 'Unknown'}` : '',
      res
    );
  } catch (error) {
    logTest('User Registration', false, error.message);
  }
}

/**
 * Phase 3: Students Management Tests
 */
async function testStudents() {
  logSection('Phase 3: Students Management Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping students tests - no super admin token${colors.reset}`);
    return;
  }

  // Get students list
  try {
    const res = await makeRequest('GET', '/api/students?page=1&limit=10', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.students?.length > 0) {
      testData.studentId = res.body.data.students[0]._id;
    }

    logTest(
      'Get Students List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.students?.length || 0} students`,
      res
    );
  } catch (error) {
    logTest('Get Students List', false, error.message);
  }

  // Get student details
  if (testData.studentId) {
    try {
      const res = await makeRequest('GET', `/api/students/${testData.studentId}`, null, tokens.superAdmin);
      logTest(
        'Get Student Details',
        res.statusCode === 200 && res.body.success,
        res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
        res
      );
    } catch (error) {
      logTest('Get Student Details', false, error.message);
    }

    // Get student extended details
    try {
      const res = await makeRequest('GET', `/api/students/${testData.studentId}/details`, null, tokens.superAdmin);
      logTest(
        'Get Student Extended Details',
        res.statusCode === 200 && res.body.success,
        res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
        res
      );
    } catch (error) {
      logTest('Get Student Extended Details', false, error.message);
    }
  }
}

/**
 * Phase 4: Teachers Management Tests
 */
async function testTeachers() {
  logSection('Phase 4: Teachers Management Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping teachers tests - no super admin token${colors.reset}`);
    return;
  }

  // Get teachers list
  try {
    const res = await makeRequest('GET', '/api/teachers', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.length > 0) {
      testData.teacherId = res.body.data[0]._id;
    }

    logTest(
      'Get Teachers List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} teachers`,
      res
    );
  } catch (error) {
    logTest('Get Teachers List', false, error.message);
  }

  // Get teacher details
  if (testData.teacherId) {
    try {
      const res = await makeRequest('GET', `/api/teachers/${testData.teacherId}`, null, tokens.superAdmin);
      logTest(
        'Get Teacher Details',
        res.statusCode === 200 && res.body.success,
        res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
        res
      );
    } catch (error) {
      logTest('Get Teacher Details', false, error.message);
    }
  }
}

/**
 * Phase 5: Classes Tests
 */
async function testClasses() {
  logSection('Phase 5: Classes Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping classes tests - no super admin token${colors.reset}`);
    return;
  }

  // Get classes list
  try {
    const res = await makeRequest('GET', '/api/classes', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.length > 0) {
      testData.classId = res.body.data[0]._id;
    }

    logTest(
      'Get Classes List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} classes`,
      res
    );
  } catch (error) {
    logTest('Get Classes List', false, error.message);
  }
}

/**
 * Phase 6: Subjects Tests
 */
async function testSubjects() {
  logSection('Phase 6: Subjects Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping subjects tests - no super admin token${colors.reset}`);
    return;
  }

  // Get subjects list
  try {
    const res = await makeRequest('GET', '/api/subjects', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.length > 0) {
      testData.subjectId = res.body.data[0]._id;
    }

    logTest(
      'Get Subjects List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} subjects`,
      res
    );
  } catch (error) {
    logTest('Get Subjects List', false, error.message);
  }
}

/**
 * Phase 7: Schedules Tests
 */
async function testSchedules() {
  logSection('Phase 7: Schedules Tests');

  if (!tokens.student) {
    console.log(`${colors.yellow}⚠ Skipping schedules tests - no student token${colors.reset}`);
    return;
  }

  // Get my schedule (as student)
  try {
    const res = await makeRequest('GET', '/api/schedules/my-schedule', null, tokens.student);
    logTest(
      'Get My Schedule (Student)',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Get My Schedule (Student)', false, error.message);
  }

  // Get all schedules (as admin)
  if (tokens.superAdmin) {
    try {
      const res = await makeRequest('GET', '/api/schedules', null, tokens.superAdmin);
      const passed = res.statusCode === 200 && res.body.success;

      if (passed && res.body.data?.length > 0) {
        testData.scheduleId = res.body.data[0]._id;
      }

      logTest(
        'Get All Schedules (Admin)',
        passed,
        !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} schedules`,
        res
      );
    } catch (error) {
      logTest('Get All Schedules (Admin)', false, error.message);
    }
  }
}

/**
 * Phase 8: Fees Tests
 */
async function testFees() {
  logSection('Phase 8: Fees Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping fees tests - no super admin token${colors.reset}`);
    return;
  }

  // Get fees list
  try {
    const res = await makeRequest('GET', '/api/fees', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.fees?.length > 0) {
      testData.feeId = res.body.data.fees[0]._id;
    }

    logTest(
      'Get Fees List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.fees?.length || 0} fees`,
      res
    );
  } catch (error) {
    logTest('Get Fees List', false, error.message);
  }
}

/**
 * Phase 9: Absences Tests
 */
async function testAbsences() {
  logSection('Phase 9: Absences Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping absences tests - no super admin token${colors.reset}`);
    return;
  }

  // Get absences list
  try {
    const res = await makeRequest('GET', '/api/absences', null, tokens.superAdmin);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.absences?.length > 0) {
      testData.absenceId = res.body.data.absences[0]._id;
    }

    logTest(
      'Get Absences List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.absences?.length || 0} absences`,
      res
    );
  } catch (error) {
    logTest('Get Absences List', false, error.message);
  }
}

/**
 * Phase 10: Courses Tests
 */
async function testCourses() {
  logSection('Phase 10: Courses Tests');

  if (!tokens.teacher) {
    console.log(`${colors.yellow}⚠ Skipping courses tests - no teacher token${colors.reset}`);
    return;
  }

  // Get courses list
  try {
    const res = await makeRequest('GET', '/api/courses', null, tokens.teacher);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.length > 0) {
      testData.courseId = res.body.data[0]._id;
    }

    logTest(
      'Get Courses List',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} courses`,
      res
    );
  } catch (error) {
    logTest('Get Courses List', false, error.message);
  }
}

/**
 * Phase 11: Exams Tests
 */
async function testExams() {
  logSection('Phase 11: Exams Tests');

  if (!tokens.student) {
    console.log(`${colors.yellow}⚠ Skipping exams tests - no student token${colors.reset}`);
    return;
  }

  // Get independent exams
  try {
    const res = await makeRequest('GET', '/api/exams/independent', null, tokens.student);
    const passed = res.statusCode === 200 && res.body.success;

    if (passed && res.body.data?.length > 0) {
      testData.examId = res.body.data[0]._id;
    }

    logTest(
      'Get Independent Exams',
      passed,
      !passed ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} exams`,
      res
    );
  } catch (error) {
    logTest('Get Independent Exams', false, error.message);
  }

  // Get exams by course
  if (testData.courseId) {
    try {
      const res = await makeRequest('GET', `/api/exams/course/${testData.courseId}`, null, tokens.student);
      logTest(
        'Get Exams by Course',
        res.statusCode === 200 && res.body.success,
        res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
        res
      );
    } catch (error) {
      logTest('Get Exams by Course', false, error.message);
    }
  }
}

/**
 * Phase 12: Chat Tests
 */
async function testChat() {
  logSection('Phase 12: Chat Tests');

  if (!tokens.student) {
    console.log(`${colors.yellow}⚠ Skipping chat tests - no student token${colors.reset}`);
    return;
  }

  // Get contacts
  try {
    const res = await makeRequest('GET', '/api/chat/contacts', null, tokens.student);
    logTest(
      'Get Chat Contacts',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} contacts`,
      res
    );
  } catch (error) {
    logTest('Get Chat Contacts', false, error.message);
  }
}

/**
 * Phase 13: Notifications Tests
 */
async function testNotifications() {
  logSection('Phase 13: Notifications Tests');

  if (!tokens.student) {
    console.log(`${colors.yellow}⚠ Skipping notifications tests - no student token${colors.reset}`);
    return;
  }

  // Get notifications
  try {
    const res = await makeRequest('GET', '/api/notifications', null, tokens.student);
    logTest(
      'Get Notifications',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : `Found ${res.body.data?.length || 0} notifications`,
      res
    );
  } catch (error) {
    logTest('Get Notifications', false, error.message);
  }
}

/**
 * Phase 14: Dashboard Tests
 */
async function testDashboard() {
  logSection('Phase 14: Dashboard Tests');

  if (!tokens.superAdmin) {
    console.log(`${colors.yellow}⚠ Skipping dashboard tests - no super admin token${colors.reset}`);
    return;
  }

  // Get dashboard stats
  try {
    const res = await makeRequest('GET', '/api/dashboard/stats', null, tokens.superAdmin);
    logTest(
      'Get Dashboard Stats',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Get Dashboard Stats', false, error.message);
  }

  // Get attendance stats
  try {
    const res = await makeRequest('GET', '/api/dashboard/attendance-stats', null, tokens.superAdmin);
    logTest(
      'Get Attendance Stats',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Get Attendance Stats', false, error.message);
  }

  // Get system activities
  try {
    const res = await makeRequest('GET', '/api/dashboard/activities', null, tokens.superAdmin);
    logTest(
      'Get System Activities',
      res.statusCode === 200 && res.body.success,
      res.statusCode !== 200 ? `Status: ${res.statusCode}` : '',
      res
    );
  } catch (error) {
    logTest('Get System Activities', false, error.message);
  }
}

/**
 * Generate final report
 */
function generateReport() {
  results.endTime = new Date();
  const duration = (results.endTime - results.startTime) / 1000;

  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}           TEST SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  console.log(`Total Tests:   ${colors.bright}${results.total}${colors.reset}`);
  console.log(`Passed:        ${colors.green}${results.passed}${colors.reset}`);
  console.log(`Failed:        ${colors.red}${results.failed}${colors.reset}`);
  console.log(`Success Rate:  ${colors.bright}${((results.passed / results.total) * 100).toFixed(2)}%${colors.reset}`);
  console.log(`Duration:      ${colors.bright}${duration.toFixed(2)}s${colors.reset}\n`);

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

  // Save detailed report to file
  const reportPath = '/home/memo/SchoolManagerDB/server/test-report.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`${colors.blue}Detailed report saved to: ${reportPath}${colors.reset}\n`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.bright}${colors.blue}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     School Management System - Comprehensive Tests        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  console.log(`Testing server at: ${colors.bright}${BASE_URL}${colors.reset}\n`);

  try {
    await testInfrastructure();
    await testAuthentication();
    await testStudents();
    await testTeachers();
    await testClasses();
    await testSubjects();
    await testSchedules();
    await testFees();
    await testAbsences();
    await testCourses();
    await testExams();
    await testChat();
    await testNotifications();
    await testDashboard();

    generateReport();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`${colors.red}Fatal error during testing:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run tests
runTests();
