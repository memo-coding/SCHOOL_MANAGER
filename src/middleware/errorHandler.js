const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);
  
  const fs = require('fs');
  const path = require('path');
  const logFile = path.join(__dirname, '../../server_error.log');
  const logEntry = `[${new Date().toISOString()}] ${err.name}: ${err.message}\nStack: ${err.stack}\n\n`;
  
  fs.appendFile(logFile, logEntry, (writeErr) => {
    if (writeErr) console.error('Failed to write to log file:', writeErr);
  });

  if (err.name === 'CastError') {
    const message = 'Resource not found';
    return res.status(404).json({
      success: false,
      message,
      errors: [`Invalid ${err.path}: ${err.value}`]
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${field}`;
    return res.status(400).json({
      success: false,
      message,
      errors: [`${field} '${value}' already exists`]
    });
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      errors: ['Please log in again']
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      errors: ['Please log in again']
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    errors: [error.message || 'Internal server error']
  });
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  errorHandler,
  AppError,
  asyncHandler
};