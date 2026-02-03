const { Student, Teacher, Class, User, Absence, Fee } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

const getDashboardStats = asyncHandler(async (req, res) => {
    const statsPromises = [
        Teacher.countDocuments(),
        Class.countDocuments(),
        User.countDocuments(),
        // Consolidate Student context counts
        Student.aggregate([
            {
                $facet: {
                    total: [{ $count: "count" }],
                    active: [{ $match: { academic_status: 'active' } }, { $count: "count" }],
                    paid: [{ $match: { fee_status: 'paid' } }, { $count: "count" }],
                    pending: [{ $match: { fee_status: 'pending' } }, { $count: "count" }],
                    overdue: [{ $match: { fee_status: 'overdue' } }, { $count: "count" }],
                    partial: [{ $match: { fee_status: 'partial' } }, { $count: "count" }]
                }
            },
            {
                $project: {
                    total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
                    active: { $ifNull: [{ $arrayElemAt: ["$active.count", 0] }, 0] },
                    paid: { $ifNull: [{ $arrayElemAt: ["$paid.count", 0] }, 0] },
                    pending: { $ifNull: [{ $arrayElemAt: ["$pending.count", 0] }, 0] },
                    overdue: { $ifNull: [{ $arrayElemAt: ["$overdue.count", 0] }, 0] },
                    partial: { $ifNull: [{ $arrayElemAt: ["$partial.count", 0] }, 0] }
                }
            }
        ]),
        // Financial Health Aggregation
        Fee.aggregate([
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$amount' },
                    collectedAmount: { $sum: '$paid_amount' }
                }
            }
        ]),
        // Class Capacity
        Class.find()
            .select('class_name section capacity current_students')
            .sort({ current_students: -1 })
            .limit(5)
            .lean(),
        // Recent Activities
        Student.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('user_id', 'personal_info.first_name personal_info.last_name')
            .select('student_code createdAt')
            .lean(),
        Absence.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .populate({
                path: 'student_id',
                populate: { path: 'user_id', select: 'personal_info.first_name personal_info.last_name' }
            })
            .select('date status createdAt')
            .lean()
    ];

    const results = await Promise.all(statsPromises);

    const [
        totalTeachers,
        totalClasses,
        totalUsers,
        studentStatsRaw,
        financialStatsRaw,
        classCapacity,
        recentStudents,
        recentAbsences
    ] = results;

    const studentStats = studentStatsRaw[0] || { total: 0, active: 0, paid: 0, pending: 0, overdue: 0, partial: 0 };
    const { total: totalStudents, active: activeStudents, paid: paidCount, pending: pendingCount, overdue: overdueCount, partial: partialCount } = studentStats;

    const financialHealth = {
        paid: 0,
        pending: 0,
        overdue: 0,
        partial: 0,
        totalExpected: 0,
        totalCollected: 0
    };

    financialStatsRaw.forEach(stat => {
        if (financialHealth[stat._id] !== undefined) {
            financialHealth[stat._id] = stat.totalAmount;
        }
        financialHealth.totalExpected += stat.totalAmount;
        financialHealth.totalCollected += stat.collectedAmount;
    });

    const activities = [
        ...recentStudents.map(s => ({
            type: 'new_student',
            title: 'New Student Enrolled',
            description: `${s.user_id?.personal_info?.first_name} ${s.user_id?.personal_info?.last_name} joined`,
            time: s.createdAt,
            id: s._id,
            data: { studentId: s._id }
        })),
        ...recentAbsences.map(a => ({
            type: 'absence_report',
            title: 'New Absence Reported',
            description: `Status: ${a.status}`,
            time: a.createdAt,
            id: a._id,
            data: {
                absenceId: a._id,
                studentId: a.student_id?._id
            }
        }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

    // Optimized Schedule Check
    let hasScheduleUpdate = false;
    if (req.user.role === 'student' || req.user.role === 'teacher') {
        let lastUpdate = null;
        if (req.user.role === 'student') {
            const studentRecord = await Student.findOne({ user_id: req.user._id }).select('class_id').lean();
            if (studentRecord?.class_id) {
                const classRecord = await Class.findById(studentRecord.class_id).select('last_schedule_update').lean();
                lastUpdate = classRecord?.last_schedule_update;
            }
        } else {
            const teacherRecord = await Teacher.findOne({ user_id: req.user._id }).select('_id').lean();
            if (teacherRecord) {
                const ClassSubject = require('../models/ClassSubject');
                const teacherClasses = await ClassSubject.find({ 'teachers.teacher_id': teacherRecord._id }).select('class_id').lean();
                const classIds = teacherClasses.map(c => c.class_id);
                const updatedClass = await Class.findOne({
                    _id: { $in: classIds },
                    last_schedule_update: { $exists: true }
                }).sort({ last_schedule_update: -1 }).select('last_schedule_update').lean();
                lastUpdate = updatedClass?.last_schedule_update;
            }
        }

        if (lastUpdate) {
            hasScheduleUpdate = !req.user.last_schedule_viewed ||
                new Date(lastUpdate) > new Date(req.user.last_schedule_viewed);
        }
    }

    res.status(200).json({
        success: true,
        data: {
            students: { total: totalStudents, active: activeStudents },
            teachers: { total: totalTeachers },
            classes: { total: totalClasses },
            users: { total: totalUsers },
            fees: {
                paid: paidCount,
                pending: pendingCount,
                overdue: overdueCount,
                partial: partialCount
            },
            financialHealth,
            classCapacity,
            recentActivity: activities,
            hasScheduleUpdate
        }
    });
});

const getAttendanceStats = asyncHandler(async (req, res, next) => {
    const { range = 'monthly' } = req.query;
    const now = new Date();
    let stats = [];

    if (range === 'daily') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const aggregation = await Absence.aggregate([
            {
                $match: {
                    date: { $gte: sevenDaysAgo },
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map(aggregation.map(a => [a._id, a.count]));
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            stats.push({
                label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                absences: statsMap.get(dateStr) || 0,
                date: dateStr
            });
        }
    } else if (range === 'monthly') {
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const aggregation = await Absence.aggregate([
            {
                $match: {
                    date: { $gte: twelveMonthsAgo },
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$date" },
                        year: { $year: "$date" }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map(aggregation.map(a => [`${a._id.year}-${a._id.month}`, a.count]));

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = d.getMonth() + 1;
            const year = d.getFullYear();
            stats.push({
                label: d.toLocaleString('en-US', { month: 'short' }),
                absences: statsMap.get(`${year}-${month}`) || 0,
                month,
                year
            });
        }
    } else if (range === 'yearly') {
        const fiveYearsAgo = new Date(now.getFullYear() - 4, 0, 1);

        const aggregation = await Absence.aggregate([
            {
                $match: {
                    date: { $gte: fiveYearsAgo },
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: { $year: "$date" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statsMap = new Map(aggregation.map(a => [a._id, a.count]));
        const currentYear = now.getFullYear();
        for (let i = 4; i >= 0; i--) {
            const year = currentYear - i;
            stats.push({
                label: year.toString(),
                absences: statsMap.get(year) || 0,
                year
            });
        }
    }

    res.status(200).json({
        success: true,
        data: stats
    });
});

const getSystemActivities = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { type, search, startDate, endDate } = req.query;

    console.log(`[getSystemActivities] Filters:`, { type, search, startDate, endDate, page, limit });

    const queryFilter = {};
    if (startDate || endDate) {
        queryFilter.createdAt = {};
        if (startDate && startDate.trim()) {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) {
                queryFilter.createdAt.$gte = start;
            }
        }
        if (endDate && endDate.trim()) {
            const end = new Date(endDate);
            if (!isNaN(end.getTime())) {
                end.setHours(23, 59, 59, 999);
                queryFilter.createdAt.$lte = end;
            }
        }
        if (Object.keys(queryFilter.createdAt).length === 0) {
            delete queryFilter.createdAt;
        }
    }

    let userIds = [];
    let studentIdsFromSearch = [];
    if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        // Find users matching search
        const users = await User.find({
            $or: [
                { 'personal_info.first_name': searchRegex },
                { 'personal_info.last_name': searchRegex },
                { 'username': searchRegex },
                { 'email': searchRegex }
            ]
        }).select('_id');
        userIds = users.map(u => u._id);

        // Find students matching search (by user or code)
        const students = await Student.find({
            $or: [
                { user_id: { $in: userIds } },
                { student_code: searchRegex }
            ]
        }).select('_id');
        studentIdsFromSearch = students.map(s => s._id);

        console.log(`[getSystemActivities] Search yielded ${userIds.length} users and ${studentIdsFromSearch.length} students.`);
    }

    // Increased fetch limit to ensure we have enough candidates to sort and paginate correctly.
    const fetchLimit = Math.max(skip + limit + 100, 200);

    let studentsPromise = Promise.resolve([]);
    if (!type || type === 'new_student') {
        const studentQuery = { ...queryFilter };
        if (search && search.trim()) {
            studentQuery._id = { $in: studentIdsFromSearch };
        }
        studentsPromise = Student.find(studentQuery)
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .populate('user_id', 'personal_info.first_name personal_info.last_name username')
            .select('student_code createdAt user_id')
            .lean();
    }

    let absencesPromise = Promise.resolve([]);
    if (!type || type === 'absence_report') {
        const absenceQuery = { ...queryFilter };
        if (search && search.trim()) {
            absenceQuery.$or = [
                { reported_by: { $in: userIds } },
                { student_id: { $in: studentIdsFromSearch } },
                { status: { $regex: search.trim(), $options: 'i' } },
                { reason: { $regex: search.trim(), $options: 'i' } }
            ];
        }
        absencesPromise = Absence.find(absenceQuery)
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .populate('reported_by', 'personal_info.first_name personal_info.last_name username')
            .populate({
                path: 'student_id',
                populate: { path: 'user_id', select: 'personal_info.first_name personal_info.last_name' }
            })
            .select('date status reason createdAt reported_by student_id')
            .lean();
    }

    const [recentStudents, recentAbsences] = await Promise.all([studentsPromise, absencesPromise]);

    console.log(`[getSystemActivities] Fetched ${recentStudents.length} students and ${recentAbsences.length} absences.`);

    const activities = [
        ...recentStudents.map(s => ({
            id: s._id,
            type: 'new_student',
            action: 'Enrolled',
            target: `${s.user_id?.personal_info?.first_name || ''} ${s.user_id?.personal_info?.last_name || ''}`.trim() || 'Unknown',
            actor: 'System',
            date: s.createdAt,
            details: `Code: ${s.student_code}`
        })),
        ...recentAbsences.map(a => ({
            id: a._id,
            type: 'absence_report',
            action: 'Reported Absence',
            target: `${a.student_id?.user_id?.personal_info?.first_name || ''} ${a.student_id?.user_id?.personal_info?.last_name || ''}`.trim() || 'Unknown',
            actor: a.reported_by ? `${a.reported_by?.personal_info?.first_name || ''} ${a.reported_by?.personal_info?.last_name || ''}`.trim() || a.reported_by.username : 'Unknown',
            date: a.createdAt,
            details: `Reason: ${a.reason}, Status: ${a.status}`
        }))
    ];

    // global Sort
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination slice
    const paginatedActivities = activities.slice(skip, skip + limit);

    console.log(`[getSystemActivities] Returning ${paginatedActivities.length} activities.`);

    res.status(200).json({
        success: true,
        data: {
            activities: paginatedActivities,
            page,
            limit
        }
    });
});

module.exports = {
    getDashboardStats,
    getAttendanceStats,
    getSystemActivities
};
