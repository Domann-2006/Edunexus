import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../lib/firebase-admin.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

// Helper to find user by email
const findUserByEmail = async (email) => {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

router.post('/login', async (req, res) => {
  const { email, password, loginType } = req.body;

  try {
    console.log(`Login attempt for: ${email}, type: ${loginType}`);
    const user = await findUserByEmail(email);
    if (!user) {
      console.warn(`Login failed: User not found for email ${email}`);
      return res.status(401).json({ message: 'Account not found. Please check your email address.' });
    }

    // Role mismatch check
    if (loginType === 'teacher' && user.role !== 'TEACHER') {
      console.warn(`Login failed: Role mismatch. User ${email} (role: ${user.role}) tried to login as teacher.`);
      return res.status(401).json({ message: 'This is not a Teacher account. Please use the Admin login portal.' });
    }

    if (loginType === 'admin' && !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user.role)) {
      console.warn(`Login failed: Role mismatch. User ${email} (role: ${user.role}) tried to login as admin.`);
      return res.status(401).json({ message: 'This account does not have Admin privileges. Please use the Teacher login portal.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.warn(`Login failed: Password mismatch for email ${email}`);
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    console.log(`Login successful for: ${email}, role: ${user.role}`);
    
    // Log Activity
    try {
      await db.collection('activity-logs').add({
        userId: user.id,
        userName: user.name || user.username || user.email.split('@')[0],
        role: user.role,
        action: 'LOGIN',
        details: `${user.role === 'TEACHER' ? 'Teacher' : user.role === 'SCHOOL_ADMIN' ? 'School Admin' : 'Super Admin'} logged in successfully.`,
        schoolId: user.schoolId || 'SUPER',
        createdAt: new Date().toISOString()
      });
    } catch (logErr) {
      console.error('Failed to write login activity log:', logErr);
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        name: user.name || user.username || user.email.split('@')[0], 
        email: user.email, 
        role: user.role, 
        schoolId: user.schoolId 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Generate Firebase Custom Token for real-time frontend access
    let firebaseToken = null;
    try {
      const { auth: adminAuth } = await import('../lib/firebase-admin.js');
      console.log(`[FIREBASE_CUSTOM_TOKEN] Generating custom token for user ID (Firestore doc ID): ${user.id}`);
      firebaseToken = await adminAuth.createCustomToken(user.id);
    } catch (fbErr) {
      console.error('Failed to generate Firebase token:', fbErr);
    }

    let schoolName = null;
    if (user.schoolId && user.schoolId !== 'SUPER') {
      const schoolDoc = await db.collection('schools').doc(user.schoolId).get();
      if (schoolDoc.exists) {
        schoolName = schoolDoc.data().name;
      }
    }

    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, // Always secure for cross-site cookies
      sameSite: 'none', // Required for cross-site cookies
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({
      token,
      firebaseToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        schoolName: schoolName
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

// FIX: Bug 4 - /me route is fully present and generates fresh Firebase Custom Token protected by authenticate middleware
router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ message: 'User not found' });
    
    const userData = userDoc.data();
    let schoolName = null;
    let schoolLogo = null;

    if (userData.schoolId && userData.schoolId !== 'SUPER') {
      const schoolDoc = await db.collection('schools').doc(userData.schoolId).get();
      if (schoolDoc.exists) {
        const sData = schoolDoc.data();
        schoolName = sData.name;
        schoolLogo = sData.logoUrl;
      }
    }

    // Generate fresh Firebase Custom Token on every session check/refresh
    let firebaseToken = null;
    try {
      const { auth: adminAuth } = await import('../lib/firebase-admin.js');
      console.log(`[FIREBASE_CUSTOM_TOKEN_ME] Generating custom token during session check for user ID (Firestore doc ID): ${userDoc.id}`);
      firebaseToken = await adminAuth.createCustomToken(userDoc.id);
    } catch (fbErr) {
      console.error('Failed to generate Firebase token during session check:', fbErr);
    }

    res.json({ 
      firebaseToken,
      user: {
        id: userDoc.id,
        ...userData,
        schoolName,
        schoolLogo // Include school logo for potential UI use
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update current user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    const finalUpdate = { ...updateData, updatedAt: new Date().toISOString() };

    // Remove immutable/dangerous fields
    delete finalUpdate.role;
    delete finalUpdate.schoolId;
    delete finalUpdate.id;
    delete finalUpdate.email; // Email usually immutable or requires special flow

    if (password) {
      finalUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    await db.collection('users').doc(req.user.id).update(finalUpdate);

    // If teacher, sync with teachers collection
    if (req.user.role === 'TEACHER') {
      const teacherSnap = await db.collection('teachers').where('userId', '==', req.user.id).limit(1).get();
      if (!teacherSnap.empty) {
        await db.collection('teachers').doc(teacherSnap.docs[0].id).update({
          name: finalUpdate.name || req.user.name,
          avatarUrl: finalUpdate.avatarUrl || req.user.avatarUrl,
          phone: finalUpdate.phone || null,
          address: finalUpdate.address || null
        });
      }
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check if the initial Super Admin setup has been completed
router.get('/setup-status', async (req, res) => {
  try {
    const superAdminQuery = await db.collection('users').where('role', '==', 'SUPER_ADMIN').limit(1).get();
    res.json({
      setupCompleted: !superAdminQuery.empty
    });
  } catch (err) {
    console.error('Failed to check setup status:', err);
    res.status(500).json({ message: err.message });
  }
});

// Setup Initial User (Development tool)
router.post('/setup-initial', async (req, res) => {
  const { name, email, password, role, schoolId } = req.body;
  
  try {
    // FIX: Require database validation. Ensure only ONE initial Super Admin can be created publicly.
    const superAdminQuery = await db.collection('users').where('role', '==', 'SUPER_ADMIN').limit(1).get();
    if (!superAdminQuery.empty) {
      return res.status(403).json({ message: 'Setup is locked. A Super Admin already exists.' });
    }

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
