// api/health.js
export default function handler(req, res) {
  res.status(200).json({
    status:  'ok',
    service: 'ZAPLE API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
}
