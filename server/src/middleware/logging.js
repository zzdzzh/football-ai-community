export function loggingMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const userId = req.user?.id ?? null;
    const logEntry = {
      level: 'info',
      type: 'http_request',
      requestId: req.requestId,
      userId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };
    console.log(JSON.stringify(logEntry));
  });

  next();
}
