# School Management System Backend

## Overview
A professional school management system backend built with Node.js, Express, and MongoDB. Features multi-role authentication, comprehensive student/teacher/class management, fee tracking, and attendance recording.

## Project Architecture

### Technology Stack
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator

### Folder Structure
```
/
├── server.js                 # Main entry point
├── package.json              # Dependencies
├── src/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   └── constants.js      # Application constants
│   ├── models/               # MongoDB schemas
│   │   ├── User.js
│   │   ├── Student.js
│   │   ├── Teacher.js
│   │   ├── Class.js
│   │   ├── Subject.js
│   │   ├── ClassSubject.js
│   │   ├── Absence.js
│   │   ├── Fee.js
│   │   └── Permission.js
│   ├── controllers/          # Business logic
│   ├── routes/               # API endpoints
│   ├── middleware/           # Auth & validation
│   └── utils/                # Helper functions
```

## Database Schema

### Entity Relationships
- User ↔ Student (one-to-one)
- User ↔ Teacher (one-to-one)
- Class ↔ Student (one-to-many)
- Class ↔ ClassSubject (one-to-many)
- Subject ↔ ClassSubject (one-to-many)
- Student ↔ Absence (one-to-many)
- Student ↔ Fee (one-to-many)

### User Roles
1. **super_admin** - Full system access
2. **admin** - Content management without delete
3. **teacher** - Attendance recording and reports
4. **student** - View own data only

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Students
- `GET /api/students` - List all students
- `GET /api/students/:id` - Get student by ID
- `GET /api/students/:id/details` - Get student with subjects/absences/fees
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Teachers
- `GET /api/teachers` - List all teachers
- `GET /api/teachers/:id` - Get teacher with assigned classes
- `POST /api/teachers` - Create teacher
- `PUT /api/teachers/:id` - Update teacher

### Classes
- `GET /api/classes` - List all classes
- `GET /api/classes/:id` - Get class with students and subjects
- `POST /api/classes` - Create class
- `PUT /api/classes/:id` - Update class

### Subjects
- `GET /api/subjects` - List all subjects
- `GET /api/subjects/:id` - Get subject details
- `POST /api/subjects` - Create subject

### Fees
- `GET /api/fees` - List all fees
- `GET /api/fees/student/:student_id` - Get student fees with summary
- `GET /api/fees/class/:class_id/report` - Class fee report
- `POST /api/fees` - Create fee
- `POST /api/fees/payment` - Record payment

### Absences
- `GET /api/absences` - List all absences
- `GET /api/absences/student/:student_id/report` - Student absence report
- `POST /api/absences` - Record absence
- `PUT /api/absences/:id` - Update/approve absence

## Environment Variables
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `SEED_DEMO_DATA` - Seed demo data on startup (true/false)

## Demo Accounts
When SEED_DEMO_DATA=true, the following accounts are created:
- Super Admin: admin@school.com / Admin@123
- Teacher 1: teacher1@school.com / Teacher@123
- Teacher 2: teacher2@school.com / Teacher@123
- Student 1: student1@school.com / Student@123
- Student 2: student2@school.com / Student@123

## Response Format
All API responses follow this format:
```json
{
  "success": boolean,
  "message": string,
  "data": object/array,
  "errors": array (if any)
}
```

## Recent Changes
- 2024-11-30: Initial project setup with complete database design
- 2024-11-30: Implemented all 9 MongoDB models with relationships and indexes
- 2024-11-30: Added JWT authentication with role-based permissions
- 2024-11-30: Created all CRUD APIs for students, teachers, classes, subjects
- 2024-11-30: Implemented fee management with payment tracking
- 2024-11-30: Added absence recording with approval workflow
