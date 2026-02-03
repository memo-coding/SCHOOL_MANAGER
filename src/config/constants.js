module.exports = {
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    TEACHER: 'teacher',
    STUDENT: 'student'
  },

  ACADEMIC_STATUS: {
    ACTIVE: 'active',
    TRANSFERRED: 'transferred',
    GRADUATED: 'graduated',
    SUSPENDED: 'suspended'
  },

  FEE_STATUS: {
    PAID: 'paid',
    PENDING: 'pending',
    OVERDUE: 'overdue',
    PARTIAL: 'partial',
    CANCELLED: 'cancelled'
  },

  FEE_TYPES: {
    TUITION: 'tuition',
    TRANSPORTATION: 'transportation',
    BOOKS: 'books',
    UNIFORM: 'uniform',
    ACTIVITIES: 'activities',
    OTHER: 'other'
  },

  PAYMENT_METHODS: {
    CASH: 'cash',
    BANK_TRANSFER: 'bank_transfer',
    CREDIT_CARD: 'credit_card',
    CHECK: 'check',
    ONLINE: 'online'
  },

  ABSENCE_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  ABSENCE_REASONS: {
    SICKNESS: 'sickness',
    FAMILY: 'family',
    VACATION: 'vacation',
    OTHER: 'other'
  },

  TEACHER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ON_LEAVE: 'on_leave',
    TERMINATED: 'terminated'
  },

  CLASS_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  },

  JWT_EXPIRE: '7d',

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 1000
  }
};
