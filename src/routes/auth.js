import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../lib/firebase-admin.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'edunexus_super_secret_key';

// Helper to find user by email
const findUserByEmail = async (email) => {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Setup Initial User (Development tool)
router.post('/setup-initial', async (req, res) => {
  const { name, email, password, role, schoolId } = req.body;
  
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const userRef = await db.collection('users').add({
      name,
      email,
      passwordHash,
      role: role || 'SUPER_ADMIN',
      schoolId: schoolId || 'SUPER',
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ message: 'Initial user created', id: userRef.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
