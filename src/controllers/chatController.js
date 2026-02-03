const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Message = require('../models/Message');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const ClassSubject = require('../models/ClassSubject');
const { ROLES } = require('../config/constants');

// @desc    Get chat history with a specific user
// @route   GET /api/chat/history/:userId
// @access  Private
const getChatHistory = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify permission to chat with this user
    const canChat = await checkChatPermission(req.user, userId);
    if (!canChat) {
        return res.status(403).json({
            success: false,
            message: 'You are not allowed to chat with this user'
        });
    }

    // OPTIMIZED: Use lean() for faster query
    const messages = await Message.find({
        $or: [
            { sender: currentUserId, recipient: userId },
            { sender: userId, recipient: currentUserId }
        ]
    })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('sender', 'username personal_info role')
        .populate('recipient', 'username personal_info role')
        .lean();

    res.status(200).json({
        success: true,
        data: messages
    });
});

// @desc    Get contacts list (same logic as socket but via REST)
// @route   GET /api/chat/contacts
// @access  Private
const getContacts = asyncHandler(async (req, res) => {
    const contacts = await getContactsForUser(req.user);
    res.status(200).json({
        success: true,
        data: contacts
    });
});

// OPTIMIZED: Helper - Get allowed contacts based on RBAC with reduced queries
const getContactsForUser = async (currentUser) => {
    const { role, _id } = currentUser;
    const projection = 'username role personal_info';

    let contacts = [];
    let contactIds = [];

    // 1. Fetch relevant contacts based on role - OPTIMIZED with Promise.all where possible
    if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
        contacts = await User.find({ is_active: true, _id: { $ne: _id } })
            .select(projection)
            .lean();
        contactIds = contacts.map(c => c._id);
    }
    else if (role === ROLES.TEACHER) {
        // OPTIMIZED: Parallel fetch for admins and teacher record
        const [admins, teacherRecord] = await Promise.all([
            User.find({ role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] }, is_active: true })
                .select(projection)
                .lean(),
            Teacher.findOne({ user_id: _id }).select('_id').lean()
        ]);

        let studentUsers = [];
        if (teacherRecord) {
            // OPTIMIZED: Single aggregation instead of multiple queries
            studentUsers = await Student.aggregate([
                {
                    $lookup: {
                        from: 'classsubjects',
                        let: { classId: '$class_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$class_id', '$$classId'] },
                                            { $in: [teacherRecord._id, '$teachers.teacher_id'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'teacherMatch'
                    }
                },
                { $match: { 'teacherMatch.0': { $exists: true } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: '$user._id',
                        username: '$user.username',
                        role: '$user.role',
                        personal_info: '$user.personal_info'
                    }
                }
            ]);
        }

        // Deduplicate using Map
        const contactMap = new Map();
        [...admins, ...studentUsers].forEach(c => {
            if (c._id) contactMap.set(c._id.toString(), c);
        });
        contacts = Array.from(contactMap.values());
        contactIds = contacts.map(c => c._id);
    }
    else if (role === ROLES.STUDENT) {
        // OPTIMIZED: Parallel fetch for admins and student record
        const [admins, studentRecord] = await Promise.all([
            User.find({ role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] }, is_active: true })
                .select(projection)
                .lean(),
            Student.findOne({ user_id: _id }).select('class_id').lean()
        ]);

        let teacherUsers = [];
        if (studentRecord && studentRecord.class_id) {
            // OPTIMIZED: Single aggregation instead of multiple queries
            teacherUsers = await Teacher.aggregate([
                {
                    $lookup: {
                        from: 'classsubjects',
                        let: { teacherId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$class_id', studentRecord.class_id] },
                                            { $in: ['$$teacherId', '$teachers.teacher_id'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'classMatch'
                    }
                },
                { $match: { 'classMatch.0': { $exists: true } } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: '$user._id',
                        username: '$user.username',
                        role: '$user.role',
                        personal_info: '$user.personal_info'
                    }
                }
            ]);
        }

        // Deduplicate
        const contactMap = new Map();
        [...admins, ...teacherUsers].forEach(c => {
            if (c._id) contactMap.set(c._id.toString(), c);
        });
        contacts = Array.from(contactMap.values());
        contactIds = contacts.map(c => c._id);
    }
    else {
        contacts = await User.find({
            role: { $in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
            is_active: true,
            _id: { $ne: _id }
        }).select(projection).lean();
        contactIds = contacts.map(c => c._id);
    }

    if (contacts.length === 0) return [];

    // 2. OPTIMIZED: Message stats aggregation (already optimized)
    const stats = await Message.aggregate([
        {
            $match: {
                $or: [
                    { sender: _id, recipient: { $in: contactIds } },
                    { sender: { $in: contactIds }, recipient: _id }
                ]
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: {
                    $cond: [{ $eq: ["$sender", _id] }, "$recipient", "$sender"]
                },
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ["$recipient", _id] }, { $eq: ["$read", false] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const statsMap = new Map(stats.map(s => [s._id.toString(), s]));

    // 3. Merge data
    const contactsWithDetails = contacts.map(contact => {
        const contactId = contact._id.toString();
        const stat = statsMap.get(contactId);

        return {
            ...contact,
            lastMessage: stat ? stat.lastMessage : null,
            lastMessageTime: stat ? stat.lastMessage.createdAt : new Date(0),
            unreadCount: stat ? stat.unreadCount : 0
        };
    });

    // 4. Sort by last message time
    return contactsWithDetails.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
};

// OPTIMIZED: Helper - Check if chat is allowed with lean() and Promise.all
const checkChatPermission = async (sender, recipientId) => {
    const recipient = await User.findById(recipientId).select('role').lean();
    if (!recipient) return false;

    // Admins can chat with anyone
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(sender.role)) return true;
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(recipient.role)) return true;

    // Teacher-Student relations
    if (sender.role === ROLES.TEACHER && recipient.role === ROLES.STUDENT) {
        return checkTeacherStudentRelation(sender._id, recipientId);
    }
    if (sender.role === ROLES.STUDENT && recipient.role === ROLES.TEACHER) {
        return checkTeacherStudentRelation(recipientId, sender._id);
    }

    return false;
};

// OPTIMIZED: Check teacher-student relation with Promise.all
const checkTeacherStudentRelation = async (teacherUserId, studentUserId) => {
    // OPTIMIZED: Parallel fetch both records
    const [teacherRecord, studentRecord] = await Promise.all([
        Teacher.findOne({ user_id: teacherUserId }).select('_id').lean(),
        Student.findOne({ user_id: studentUserId }).select('class_id').lean()
    ]);

    if (!teacherRecord || !studentRecord) return false;

    // Check if teacher teaches in student's class
    const relation = await ClassSubject.findOne({
        'teachers.teacher_id': teacherRecord._id,
        'class_id': studentRecord.class_id
    }).select('_id').lean();

    return !!relation;
};

module.exports = {
    getChatHistory,
    getContacts,
    getContactsForUser,
    checkChatPermission
};
