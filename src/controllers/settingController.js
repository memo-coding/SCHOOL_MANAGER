const { Setting } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get setting by key
 * @route   GET /api/dashboard/settings/:key
 * @access  Private
 */
const getSetting = asyncHandler(async (req, res) => {
    const { key } = req.params;
    let setting = await Setting.findOne({ key });

    // Provide default value if not found
    if (!setting) {
        if (key === 'weekend_days') {
            setting = { key: 'weekend_days', value: [0, 6] }; // Default Sun/Sat
        } else if (key === 'week_start') {
            setting = { key: 'week_start', value: 0 }; // Default Sun
        }
    }

    res.status(200).json({
        success: true,
        data: setting
    });
});

/**
 * @desc    Update or create setting
 * @route   POST /api/dashboard/settings
 * @access  Private/Admin
 */
const updateSetting = asyncHandler(async (req, res) => {
    const { key, value, description } = req.body;

    if (!key || value === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Key and value are required'
        });
    }

    // Only allow admins to update settings (role check should be handled by middleware, but adding a check here too if needed)
    // For now, we assume the route is protected by 'protect' and 'authorize' middleware

    let setting = await Setting.findOne({ key });

    if (setting) {
        setting.value = value;
        if (description !== undefined) setting.description = description;
        await setting.save();
    } else {
        setting = await Setting.create({ key, value, description });
    }

    res.status(200).json({
        success: true,
        data: setting
    });
});

module.exports = {
    getSetting,
    updateSetting
};
