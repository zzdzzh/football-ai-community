export class AppError extends Error {
  constructor(statusCode, error, message) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.isOperational = true;
  }
}

export function errorMiddleware(err, req, res, _next) {
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const errorCode = err.error || (statusCode >= 500 ? 'internal_error' : 'bad_request');
  const message = err.isOperational ? err.message : '服务器内部错误';

  if (!err.isOperational) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'unhandled_error',
      requestId: req.requestId,
      message: err.message,
    }));
  }

  res.status(statusCode).json({
    error: errorCode,
    message,
    traceId: req.requestId,
  });
}
