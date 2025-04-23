require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Untuk inline script jika diperlukan
            "cdn.tailwindcss.com", // CDN Tailwind CSS
            "localhost:3000" // Domain Anda
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Untuk inline style
            "cdn.tailwindcss.com", // CDN Tailwind CSS
            "fonts.googleapis.com" // Jika menggunakan Google Fonts
          ],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "fonts.gstatic.com"], // Jika menggunakan Google Fonts
          connectSrc: ["'self'", "localhost:3000"] // Untuk API calls
        }
      },
      crossOriginEmbedderPolicy: false // Untuk memudahkan development
    })
  );
app.use(cors({
  origin: ['http://localhost:3000'], // Restrict to your domain
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    next();
  });
// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// Auth Middleware
const authMiddleware = (req, res, next) => {
    // Skip untuk routes yang tidak perlu auth
    const publicRoutes = ['/login', '/auth', '/public'];
    if (publicRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }
  
    // Cek cookie dengan defensive programming
    if (req.cookies?.authToken === 'authenticated') {
      return next();
    }
  
    res.redirect('/login');
  };
  
  // Login Route
  app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Admin</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="min-h-screen flex items-center justify-center" style="background-image:url('/img/2.avif');">
        <div  class="p-8 rounded-lg w-full max-w-md" style="background-color: rgba(255, 245, 238, 0.85); border: 1px solid #d4a373;">
         <h1 class="text-2xl font-bold mb-6" style="color: #6b4f4f; font-family: 'Hiragino Mincho Pro', serif; text-align: center;">Welcome</h1>
        <div id="errorMessage" class="hidden bg-red-50 border border-red-100 rounded-md p-3">
      <div class="flex items-center text-red-600">
        <i class="fas fa-exclamation-circle mr-2 text-sm"></i>
        <p class="text-sm font-medium">Invalid username or password</p>
      </div>
    </div>
        <form id="loginForm" class="space-y-6">
          <div>
            <label for="username" class="block text-sm/6 font-medium text-gray-900">Username</label>
            <div class="mt-2">
              <input type="text" name="username" id="username" required class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6">
            </div>
          </div>
      
          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-sm/6 font-medium text-gray-900">Password</label>
            </div>
            <div class="mt-2">
              <input type="password" name="password" id="password" required class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6">
            </div>
          </div>
      
          <div>
            <button type="submit" class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Sign in</button>
          </div>
        </form>
        </div>
          <script>
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('errorMessage');
    const loginForm = document.getElementById('loginForm');
    
    try {
      const response = await fetch('/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        window.location.href = '/view';
      } else {
        // Tampilkan pesan error
        errorEl.classList.remove('hidden');
        // Bersihkan form
        loginForm.reset();
        // Sembunyikan pesan error setelah 3 detik
        setTimeout(() => errorEl.classList.add('hidden'), 3000);
      }
    } catch (err) {
      // Tampilkan pesan error
      errorEl.classList.remove('hidden');
      // Bersihkan form
      loginForm.reset();
      // Sembunyikan pesan error setelah 3 detik
      setTimeout(() => errorEl.classList.add('hidden'), 3000);
    }
  });
</script>
        </body>
        </html>
      `);
  });
  
  // Auth Endpoint
  app.post('/auth', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      res.cookie('authToken', 'authenticated', { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000
      });
      return res.json({ success: true });
    }
    
    res.status(401).json({ error: 'Invalid credentials' });
  });
  
  // Logout Endpoint
  app.get('/logout', (req, res) => {
    res.clearCookie('authToken');
    res.redirect('/login');
  });
  
  // Protected Route
  app.get('/view', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
  });
// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Message Schema
const messageSchema = new mongoose.Schema({
  message: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000
  },
  createdAt: { type: Date, default: Date.now },
  tokenUsed: { type: String, required: true, unique: true } // Track used tokens
});

const Message = mongoose.model('Message', messageSchema);

// Track used tokens in memory (for production, use Redis)
const usedTokens = new Set();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret-key-here';
const JWT_EXPIRES_IN = '2m';

// Generate one-time token with additional fingerprint
app.get('/api/token', (req, res) => {
  const userFingerprint = req.ip + req.headers['user-agent']; // Basic fingerprint
  const payload = { 
    timestamp: Date.now(),
    fingerprint: userFingerprint
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});
async function sendTelegramNotification() {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram bot token or chat ID not configured');
        return;
      }
  
      const message = 'Ada pesan masuk dari anonym-messeeji';
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
      await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      });
  
      console.log('Telegram notification sent');
    } catch (error) {
      console.error('Error sending Telegram notification:', error.message);
    }
  }
  
// Submit message with enhanced validation
app.post('/api/messages', [
    body('encodedData').isString(),
    body('token').isJWT()
  ], async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    const { encodedData, token } = req.body;
    const userFingerprint = req.ip + req.headers['user-agent'];
  
    try {
      // Verify token first
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Check if token was already used
      if (usedTokens.has(token)) {
        return res.status(401).json({ error: 'Token already used' });
      }
      
      // Verify fingerprint matches
      if (decoded.fingerprint !== userFingerprint) {
        return res.status(401).json({ error: 'Invalid request source' });
      }
      
      // Check token age
      const tokenAge = Date.now() - decoded.timestamp;
      if (tokenAge > 120000) {
        return res.status(401).json({ error: 'Token expired' });
      }
  
      // Decode and validate data
      const decodedData = JSON.parse(Buffer.from(encodedData, 'base64').toString());
      
      // Validate checksum
      const expectedChecksum = crypto
        .createHash('sha1')
        .update(decodedData.message + token)
        .digest('hex');
      
      if (decodedData.checksum !== expectedChecksum) {
        return res.status(400).json({ error: 'Data tampering detected' });
      }
  
      // HTML escape before saving
      const escapeHtml = (text) => {
        return text.replace(/[&<>"'`]/g, c => `&#${c.charCodeAt(0)};`);
      };
  
      // Create and save message
      const newMessage = new Message({ 
        message: escapeHtml(decodedData.message.substring(0, 1000)),
        tokenUsed: token 
      });
      
      await newMessage.save();
      await sendTelegramNotification();
      
      // Mark token as used
      usedTokens.add(token);
      
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error processing message:', error);
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid or expired token' });
      } else if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
      } else if (error.code === 11000) {
        res.status(401).json({ error: 'Token already used' });
      } else {
        res.status(400).json({ error: 'Invalid data format' });
      }
    }
  });
// Get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Delete message endpoint
app.delete('/api/messages/:id', [
    body('token').isJWT()
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    const { token } = req.body;
    const { id } = req.params;
    const userFingerprint = req.ip + req.headers['user-agent'];
  
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify fingerprint matches
      if (decoded.fingerprint !== userFingerprint) {
        return res.status(401).json({ error: 'Invalid request source' });
      }
      
      // Delete message
      const result = await Message.findByIdAndDelete(id);
      
      if (!result) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid or expired token' });
      } else if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
      } else {
        res.status(500).json({ error: 'Server error' });
      }
    }
  });
// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});