import { Router } from 'express';
import { genSalt, hash, compare } from 'bcryptjs';
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import User from '../models/User.js';
import auth from '../middlewares/auth.js';

const router = Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await user.save();

    const token = sign(
      { userId: user.id, role: user.role },
      'schedulesyncsecret',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = sign(
      { userId: user.id, role: user.role },
      'schedulesyncsecret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
