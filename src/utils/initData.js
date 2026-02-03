const { User, Permission, Class, Subject, Teacher, Student, ClassSubject, Fee } = require('../models');
const { ROLES } = require('../config/constants');

const initializeData = async () => {
  try {
    console.log('Initializing default data...');

    await Permission.initializePermissions();

    const superAdminExists = await User.findOne({ role: ROLES.SUPER_ADMIN });

    if (!superAdminExists) {
      const superAdmin = await User.create({
        username: 'superadmin',
        email: 'admin@school.com',
        password: 'Admin@123',
        role: ROLES.SUPER_ADMIN,
        personal_info: {
          first_name: 'Super',
          last_name: 'Admin',
          phones: [{ number: '1234567890', type: 'mobile' }],
          gender: 'male'
        }
      });
      console.log('Super Admin created:', superAdmin.email);
    } else {
      console.log('Super Admin already exists');
    }

    // Migration: Fix ClassSubject status
    console.log('Checking for ClassSubjects with missing status...');
    const result = await ClassSubject.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] },
      { $set: { status: 'active' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Fixed status for ${result.modifiedCount} ClassSubjects`);
    }

    console.log('Default data initialization complete');
  } catch (error) {
    console.error('Error initializing data:', error.message);
    throw error;
  }
};

const seedDemoData = async () => {
  try {
    console.log('Seeding demo data...');

    const existingClasses = await Class.countDocuments();
    if (existingClasses > 0) {
      console.log('Demo data already exists, skipping...');
      return;
    }

    const subjects = await Subject.insertMany([
      { subject_name: 'Mathematics', subject_code: 'MATH001', credits: 4, category: 'core' },
      { subject_name: 'English Language', subject_code: 'ENG001', credits: 3, category: 'core' },
      { subject_name: 'Science', subject_code: 'SCI001', credits: 4, category: 'core' },
      { subject_name: 'History', subject_code: 'HIS001', credits: 2, category: 'core' },
      { subject_name: 'Physical Education', subject_code: 'PE001', credits: 1, category: 'extracurricular' },
      { subject_name: 'Art', subject_code: 'ART001', credits: 1, category: 'elective' }
    ]);
    console.log('Subjects created:', subjects.length);

    const classes = await Class.insertMany([
      { class_name: 'Grade 1 - Section A', grade: 1, section: 'A', academic_year: '2024-2025', capacity: 30 },
      { class_name: 'Grade 1 - Section B', grade: 1, section: 'B', academic_year: '2024-2025', capacity: 30 },
      { class_name: 'Grade 2 - Section A', grade: 2, section: 'A', academic_year: '2024-2025', capacity: 30 },
      { class_name: 'Grade 3 - Section A', grade: 3, section: 'A', academic_year: '2024-2025', capacity: 25 },
      { class_name: 'Grade 4 - Section A', grade: 4, section: 'A', academic_year: '2024-2025', capacity: 25 }
    ]);
    console.log('Classes created:', classes.length);

    const teacherUser1 = await User.create({
      username: 'teacher1',
      email: 'teacher1@school.com',
      password: 'Teacher@123',
      role: ROLES.TEACHER,
      personal_info: {
        first_name: 'John',
        last_name: 'Smith',
        phones: [{ number: '1111111111', type: 'mobile' }],
        gender: 'male'
      }
    });

    const teacherUser2 = await User.create({
      username: 'teacher2',
      email: 'teacher2@school.com',
      password: 'Teacher@123',
      role: ROLES.TEACHER,
      personal_info: {
        first_name: 'Sarah',
        last_name: 'Johnson',
        phones: [{ number: '2222222222', type: 'mobile' }],
        gender: 'female'
      }
    });

    const teacher1 = await Teacher.create({
      user_id: teacherUser1._id,
      teacher_code: 'TCH24001',
      subjects: [subjects[0]._id, subjects[2]._id],
      specialization: 'Mathematics and Science'
    });

    const teacher2 = await Teacher.create({
      user_id: teacherUser2._id,
      teacher_code: 'TCH24002',
      subjects: [subjects[1]._id, subjects[3]._id],
      specialization: 'English and History'
    });

    console.log('Teachers created: 2');

    await Class.findByIdAndUpdate(classes[0]._id, { head_teacher: teacher1._id });
    await Class.findByIdAndUpdate(classes[1]._id, { head_teacher: teacher2._id });

    const classSubjects = await ClassSubject.insertMany([
      {
        class_id: classes[0]._id,
        subject_id: subjects[0]._id,
        academic_year: '2024-2025',
        teachers: [{ teacher_id: teacher1._id, is_primary: true, schedule: [{ day: 'monday', start_time: '08:00', end_time: '09:00' }] }]
      },
      {
        class_id: classes[0]._id,
        subject_id: subjects[1]._id,
        academic_year: '2024-2025',
        teachers: [{ teacher_id: teacher2._id, is_primary: true, schedule: [{ day: 'monday', start_time: '09:00', end_time: '10:00' }] }]
      },
      {
        class_id: classes[0]._id,
        subject_id: subjects[2]._id,
        academic_year: '2024-2025',
        teachers: [{ teacher_id: teacher1._id, is_primary: true, schedule: [{ day: 'tuesday', start_time: '08:00', end_time: '09:00' }] }]
      }
    ]);
    console.log('Class subjects created:', classSubjects.length);

    const studentUser1 = await User.create({
      username: 'student1',
      email: 'student1@school.com',
      password: 'Student@123',
      role: ROLES.STUDENT,
      personal_info: {
        first_name: 'Alex',
        last_name: 'Brown',
        phones: [{ number: '3333333333', type: 'mobile' }],
        gender: 'male',
        birth_date: new Date('2018-05-15')
      }
    });

    const studentUser2 = await User.create({
      username: 'student2',
      email: 'student2@school.com',
      password: 'Student@123',
      role: ROLES.STUDENT,
      personal_info: {
        first_name: 'Emma',
        last_name: 'Wilson',
        phones: [{ number: '4444444444', type: 'mobile' }],
        gender: 'female',
        birth_date: new Date('2018-08-20')
      }
    });

    const student1 = await Student.create({
      user_id: studentUser1._id,
      student_code: 'STU24001',
      class_id: classes[0]._id,
      parent_info: {
        father: { name: 'Michael Brown', phone: '5555555555', email: 'michael.brown@email.com', occupation: 'Engineer' },
        mother: { name: 'Lisa Brown', phone: '6666666666', email: 'lisa.brown@email.com', occupation: 'Doctor' }
      }
    });

    const student2 = await Student.create({
      user_id: studentUser2._id,
      student_code: 'STU24002',
      class_id: classes[0]._id,
      parent_info: {
        father: { name: 'James Wilson', phone: '7777777777', email: 'james.wilson@email.com', occupation: 'Lawyer' },
        mother: { name: 'Mary Wilson', phone: '8888888888', email: 'mary.wilson@email.com', occupation: 'Teacher' }
      }
    });

    console.log('Students created: 2');

    await classes[0].updateStudentCount();

    const superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN });

    await Fee.insertMany([
      {
        student_id: student1._id,
        academic_year: '2024-2025',
        term: 'first',
        fee_type: 'tuition',
        amount: 5000,
        due_date: new Date('2024-09-15'),
        created_by: superAdmin._id
      },
      {
        student_id: student1._id,
        academic_year: '2024-2025',
        term: 'first',
        fee_type: 'books',
        amount: 500,
        due_date: new Date('2024-09-01'),
        paid_amount: 500,
        status: 'paid',
        payment_date: new Date('2024-08-25'),
        payment_method: 'bank_transfer',
        created_by: superAdmin._id
      },
      {
        student_id: student2._id,
        academic_year: '2024-2025',
        term: 'first',
        fee_type: 'tuition',
        amount: 5000,
        due_date: new Date('2024-09-15'),
        paid_amount: 2500,
        status: 'partial',
        created_by: superAdmin._id
      }
    ]);
    console.log('Fees created: 3');

    console.log('Demo data seeding complete!');
    console.log('\n=== Demo Accounts ===');
    console.log('Super Admin: admin@school.com / Admin@123');
    console.log('Teacher 1: teacher1@school.com / Teacher@123');
    console.log('Teacher 2: teacher2@school.com / Teacher@123');
    console.log('Student 1: student1@school.com / Student@123');
    console.log('Student 2: student2@school.com / Student@123');
    console.log('=====================\n');

  } catch (error) {
    console.error('Error seeding demo data:', error.message);
  }
};

module.exports = { initializeData, seedDemoData };
