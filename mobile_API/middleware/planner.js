const jwt = require('jsonwebtoken');
const config = require('config');

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token'); //req.header('x-auth-token');
  // Check if not token
  if (!token) {
    return res.status(401).json({
      request: 'FAIL',
      message: 'No token, authorization denied'
    });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.get('jwtSecret'));
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      request: 'FAIL',
      message: 'Token is not valid'
    });
  }
};
