const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const ClassSubject = require('./models/ClassSubject');
const Message = require('./models/Message');
const { ROLES } = require('./config/constants');
const { getContactsForUser, checkChatPermission } = require('./controllers/chatController');

let ioInstance;

// OPTIMIZATION: Simple in-memory cache for user data
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedUser = async (userId) => {
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    const user = await User.findById(userId).lean();
    if (user) {
        userCache.set(userId, { data: user, timestamp: Date.now() });
    }
    return user;
};

const initializeSocket = (server) => {
    ioInstance = socketIO(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    const io = ioInstance;

    // OPTIMIZED: Authentication Middleware with lean()
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // OPTIMIZED: Use cached user lookup
            const user = await getCachedUser(decoded.id);

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = user;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user._id.toString();
        console.log(`User connected: ${socket.user.username} (${socket.user.role}) - ID: ${userId}`);

        // Join user-specific room
        socket.join(`user_${userId}`);

        // OPTIMIZED: Join rooms based on role with single aggregation
        const joinRooms = async () => {
            try {
                if (socket.user.role === ROLES.STUDENT) {
                    const student = await Student.findOne({ user_id: socket.user._id })
                        .select('class_id grade')
                        .lean();
                    if (student) {
                        if (student.class_id) socket.join(`class_${student.class_id.toString()}`);
                        if (student.grade) socket.join(`grade_${student.grade}`);
                    }
                } else if (socket.user.role === ROLES.TEACHER) {
                    // OPTIMIZED: Single query with distinct class IDs
                    const teacher = await Teacher.findOne({ user_id: socket.user._id }).select('_id').lean();
                    if (teacher) {
                        const classIds = await ClassSubject.distinct('class_id', {
                            'teachers.teacher_id': teacher._id
                        });
                        classIds.forEach(classId => {
                            if (classId) socket.join(`class_${classId.toString()}`);
                        });
                    }
                }
            } catch (err) {
                console.error(`Error joining rooms for user ${userId}:`, err);
            }
        };

        joinRooms();

        // Broadcast online status
        socket.broadcast.emit('user_online', { userId: socket.user._id });

        // Handle fetching contacts
        socket.on('get_contacts', async (callback) => {
            try {
                if (typeof callback !== 'function') return;
                const contacts = await getContactsForUser(socket.user);
                callback({ success: true, data: contacts });
            } catch (err) {
                console.error(`Error fetching contacts for user ${userId}:`, err);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Failed to fetch contacts' });
                }
            }
        });

        // Handle sending private messages
        socket.on('send_message', async (data, callback) => {
            try {
                const { recipientId, content, attachments } = data;

                if (!recipientId || (!content && (!attachments || attachments.length === 0))) {
                    if (typeof callback === 'function') {
                        return callback({ success: false, error: 'Recipient and content/attachments are required' });
                    }
                    return;
                }

                // Verify permission
                const canChat = await checkChatPermission(socket.user, recipientId);
                if (!canChat) {
                    if (typeof callback === 'function') {
                        return callback({ success: false, error: 'You are not allowed to chat with this user' });
                    }
                    return;
                }

                const message = await Message.create({
                    sender: socket.user._id,
                    recipient: recipientId,
                    content,
                    attachments: attachments || []
                });

                const messageData = {
                    message: message,
                    sender: {
                        _id: socket.user._id,
                        username: socket.user.username,
                        role: socket.user.role,
                        personal_info: socket.user.personal_info
                    }
                };

                // Emit to recipient
                io.to(`user_${recipientId}`).emit('new_message', messageData);

                // Emit to sender's other sessions
                socket.to(`user_${userId}`).emit('new_message', messageData);

                if (typeof callback === 'function') {
                    callback({ success: true, data: message });
                }

            } catch (err) {
                console.error(`Error sending message from ${userId}:`, err);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Failed to send message' });
                }
            }
        });

        // Typing indicators
        socket.on('typing', (data) => {
            const { recipientId } = data;
            if (recipientId) {
                socket.to(`user_${recipientId}`).emit('user_typing', { userId: socket.user._id });
            }
        });

        socket.on('stop_typing', (data) => {
            const { recipientId } = data;
            if (recipientId) {
                socket.to(`user_${recipientId}`).emit('user_stop_typing', { userId: socket.user._id });
            }
        });

        // OPTIMIZED: Mark messages as read with bulk update
        socket.on('mark_read', async (data) => {
            try {
                const { messageId, senderId } = data;
                if (messageId) {
                    await Message.findByIdAndUpdate(messageId, { read: true });
                } else if (senderId) {
                    await Message.updateMany(
                        { sender: senderId, recipient: socket.user._id, read: false },
                        { read: true }
                    );
                }
            } catch (error) {
                console.error(`Error marking read for user ${userId}:`, error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
            socket.broadcast.emit('user_offline', { userId: socket.user._id });
        });
    });
};

module.exports = {
    initializeSocket,
    getIO: () => ioInstance
};
