const mongoose = require('mongoose');
require('dotenv').config();

const { Student, ClassSubject } = require('../src/models');

async function showStudentSubjects() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get all students
    const students = await Student.find()
      .populate('user_id', 'username email personal_info')
      .populate('class_id', 'class_name grade section academic_year')
      .limit(5);

    if (students.length === 0) {
      console.log('❌ No students found in the database.');
      await mongoose.connection.close();
      return;
    }

    // Display subjects for each student
    for (const student of students) {
      console.log('═'.repeat(80));
      console.log(`📚 STUDENT: ${student.user_id?.personal_info?.full_name || 'N/A'}`);
      console.log(`   Code: ${student.student_code}`);
      console.log(`   Email: ${student.user_id?.email || 'N/A'}`);
      console.log(`   Class: ${student.class_id?.class_name || 'N/A'} (Grade ${student.class_id?.grade || 'N/A'}, Section ${student.class_id?.section || 'N/A'})`);
      console.log('─'.repeat(80));

      // Get subjects for this student's class
      const classSubjects = await ClassSubject.find({
        class_id: student.class_id._id,
        status: 'active'
      })
        .populate('subject_id', 'subject_name subject_code credits category')
        .populate('teachers.teacher_id', 'teacher_code');

      if (classSubjects.length === 0) {
        console.log('   ⚠️  No subjects assigned to this class yet.\n');
        continue;
      }

      console.log(`   📖 SUBJECTS (${classSubjects.length} total):\n`);

      classSubjects.forEach((cs, index) => {
        const subject = cs.subject_id;
        const primaryTeacher = cs.teachers.find(t => t.is_primary);
        const teacherCode = primaryTeacher?.teacher_id?.teacher_code || 'Not assigned';

        console.log(`   ${index + 1}. ${subject.subject_name} (${subject.subject_code})`);
        console.log(`      Category: ${subject.category.toUpperCase()} | Credits: ${subject.credits}`);
        console.log(`      Teacher: ${teacherCode}`);
        
        if (cs.teachers.length > 0 && cs.teachers[0].schedule.length > 0) {
          const schedule = cs.teachers[0].schedule[0];
          console.log(`      Schedule: ${schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)}, ${schedule.start_time} - ${schedule.end_time}${schedule.room ? ` (Room: ${schedule.room})` : ''}`);
        }
        console.log('');
      });
    }

    console.log('═'.repeat(80));
    console.log('✓ Query completed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run the script
showStudentSubjects();
