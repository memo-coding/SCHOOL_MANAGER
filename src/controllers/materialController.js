const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Material = require('../models/Material');

// @desc    Upload general material
// @route   POST /api/materials
// @access  Teacher/Admin
const uploadMaterial = asyncHandler(async (req, res) => {
    const { title, type, url, description, grade, class_id, subject_id, allow_download } = req.body;

    let filePath = req.file ? `/uploads/materials/${req.file.filename}` : null;
    let finalUrl = url;

    if (type !== 'link' && filePath) {
        finalUrl = filePath;
    }

    if (!finalUrl && type !== 'link') {
        throw new AppError('File or URL is required', 400);
    }

    const material = await Material.create({
        title,
        type,
        url: finalUrl,
        file_path: filePath,
        description,
        grade: Number(grade),
        class_id: class_id && class_id !== 'none' ? class_id : null,
        subject_id: subject_id && subject_id !== 'none' ? subject_id : null,
        uploaded_by: req.user._id,
        allow_download: allow_download === 'true' || allow_download === true
    });

    res.status(201).json({
        success: true,
        data: material
    });
});

// @desc    Get all general materials
// @route   GET /api/materials
// @access  Private
const getMaterials = asyncHandler(async (req, res) => {
    let filter = {};

    // For students, only show materials matching their grade/class
    if (req.user.role === 'student') {
        const student = await require('../models/Student').findOne({ user_id: req.user._id }).populate('class_id');
        if (!student || !student.class_id) {
            // Return empty array if student profile or class not found
            console.log('[DEBUG-MATERIAL] Student profile or class not found for user:', req.user._id);
            return res.status(200).json({ success: true, data: [] });
        }

        filter = {
            $or: [
                { class_id: student.class_id._id },
                { grade: student.class_id.grade }
            ]
        };
    }

    const materials = await Material.find(filter)
        .sort('-createdAt')
        .populate('uploaded_by', 'personal_info email role')
        .populate('class_id', 'class_name grade')
        .populate('subject_id', 'subject_name subject_code');

    res.status(200).json({
        success: true,
        data: materials
    });
});

// @desc    Delete material
// @route   DELETE /api/materials/:id
// @access  Owner/Admin
const deleteMaterial = asyncHandler(async (req, res) => {
    const material = await Material.findById(req.params.id);

    if (!material) {
        throw new AppError('Material not found', 404);
    }

    // Authorization
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && material.uploaded_by.toString() !== req.user._id.toString()) {
        throw new AppError('Unauthorized', 403);
    }

    await material.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Material deleted successfully'
    });
});

module.exports = {
    uploadMaterial,
    getMaterials,
    deleteMaterial
};
