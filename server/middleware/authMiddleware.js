const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'syncscript_default_secret';

/**
 * Express middleware to protect routes.
 * Verifies the JWT token from the Authorization header and attaches the user to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user to request (exclude password)
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

/**
 * Socket.io middleware to authenticate WebSocket connections.
 * Parses the JWT from socket.handshake.auth.token and attaches the user to socket.user.
 */
const socketAuthMiddleware = async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    // Attach user info to the socket instance for downstream use
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = { protect, socketAuthMiddleware };
