const mongoose = require('mongoose');

const resourcePermissionSchema = new mongoose.Schema({
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false }
}, { _id: false });

const permissionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'teacher', 'student'],
    required: [true, 'Role is required'],
    unique: true
  },
  permissions: {
    users: resourcePermissionSchema,
    students: resourcePermissionSchema,
    teachers: resourcePermissionSchema,
    classes: resourcePermissionSchema,
    subjects: resourcePermissionSchema,
    class_subjects: resourcePermissionSchema,
    absences: resourcePermissionSchema,
    fees: resourcePermissionSchema,
    permissions: resourcePermissionSchema,
    reports: resourcePermissionSchema
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

permissionSchema.statics.getDefaultPermissions = function () {
  return [
    {
      role: 'super_admin',
      description: 'Full system access',
      permissions: {
        users: { create: true, read: true, update: true, delete: true },
        students: { create: true, read: true, update: true, delete: true },
        teachers: { create: true, read: true, update: true, delete: true },
        classes: { create: true, read: true, update: true, delete: true },
        subjects: { create: true, read: true, update: true, delete: true },
        class_subjects: { create: true, read: true, update: true, delete: true },
        absences: { create: true, read: true, update: true, delete: true },
        fees: { create: true, read: true, update: true, delete: true },
        permissions: { create: true, read: true, update: true, delete: true },
        reports: { create: true, read: true, update: true, delete: true }
      }
    },
    {
      role: 'admin',
      description: 'Content management without delete',
      permissions: {
        users: { create: true, read: true, update: true, delete: false },
        students: { create: true, read: true, update: true, delete: false },
        teachers: { create: true, read: true, update: true, delete: false },
        classes: { create: true, read: true, update: true, delete: false },
        subjects: { create: true, read: true, update: true, delete: false },
        class_subjects: { create: true, read: true, update: true, delete: false },
        absences: { create: true, read: true, update: true, delete: false },
        fees: { create: true, read: true, update: true, delete: false },
        permissions: { create: false, read: true, update: false, delete: false },
        reports: { create: true, read: true, update: false, delete: false }
      }
    },
    {
      role: 'teacher',
      description: 'Attendance recording and reports',
      permissions: {
        users: { create: false, read: true, update: false, delete: false },
        students: { create: false, read: true, update: false, delete: false },
        teachers: { create: false, read: true, update: false, delete: false },
        classes: { create: false, read: true, update: false, delete: false },
        subjects: { create: false, read: true, update: false, delete: false },
        class_subjects: { create: false, read: true, update: false, delete: false },
        absences: { create: true, read: true, update: true, delete: false },
        fees: { create: false, read: true, update: false, delete: false },
        permissions: { create: false, read: false, update: false, delete: false },
        reports: { create: false, read: true, update: false, delete: false }
      }
    },
    {
      role: 'student',
      description: 'View own data only',
      permissions: {
        users: { create: false, read: false, update: false, delete: false },
        students: { create: false, read: true, update: false, delete: false },
        teachers: { create: false, read: true, update: false, delete: false },
        classes: { create: false, read: true, update: false, delete: false },
        subjects: { create: false, read: true, update: false, delete: false },
        class_subjects: { create: false, read: true, update: false, delete: false },
        absences: { create: false, read: false, update: false, delete: false },
        fees: { create: false, read: false, update: false, delete: false },
        permissions: { create: false, read: false, update: false, delete: false },
        reports: { create: false, read: false, update: false, delete: false }
      }
    }
  ];
};

permissionSchema.statics.initializePermissions = async function () {
  const defaultPermissions = this.getDefaultPermissions();

  for (const perm of defaultPermissions) {
    await this.findOneAndUpdate(
      { role: perm.role },
      perm,
      { upsert: true, new: true }
    );
  }

  console.log('Default permissions initialized');
};

module.exports = mongoose.model('Permission', permissionSchema);
