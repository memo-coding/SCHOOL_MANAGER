const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/chat');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter based on material upload permissions
const fileFilter = (req, file, cb) => {
    const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|mp4|webm|mkv|mp3/;
    const allowedMimeTypes = /image|pdf|msword|officedocument|text\/plain|video|audio/;

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname || mimetype) {
        return cb(null, true);
    } else {
        console.warn(`Blocked file upload: ${file.originalname} (${file.mimetype})`);
        cb(new Error('File type not allowed! Only images, videos, audio, and documents (PDF, Doc, Excel, PPT, TXT) are supported.'), false);
    }
};

const chatUpload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // Reduced to 20MB for stability
    fileFilter: fileFilter
});

module.exports = chatUpload;
