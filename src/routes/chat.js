const express = require('express');
const router = express.Router();
const { getChatHistory, getContacts } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');

router.use(protect);

router.get('/contacts', getContacts);
router.get('/history/:userId', getChatHistory);

router.post('/upload', chatUpload.array('files', 5), (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files were uploaded'
            });
        }

        const files = req.files.map(file => ({
            url: `/uploads/chat/${file.filename}`,
            name: file.originalname,
            file_type: file.mimetype,
            size: file.size
        }));

        res.status(200).json({
            success: true,
            data: files
        });
    } catch (error) {
        console.error('Chat upload route error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing uploaded files',
            errors: [error.message]
        });
    }
});

module.exports = router;
