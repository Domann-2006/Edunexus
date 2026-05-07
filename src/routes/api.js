import express from 'express';
import { db } from '../lib/firebase-admin.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateGrade } from '../lib/grading.js';

const router = express.Router();
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer();

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = req.body.folder || 'edunexus';
    
    // Upload to Cloudinary using a stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `edunexus/${folder}`,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return res.status(500).json({ error: 'Upload failed' });
        }
        res.json({ data: { url: result.secure_url } });
      }
    );

    const stream = Readable.from(req.file.buffer);
    stream.pipe(uploadStream);
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

// SaaS Limits
const PLAN_LIMITS = {
  BASIC: { users: 50, classes: 5 },
  PRO: { users: 500, classes: 20 },
  PREMIUM: { users: 5000, classes: 100 },
};

// Generic CRUD helper
const createCRUD = (collectionName, roles, transform) => {
  const crudRouter = express.Router();

  // Create
  crudRouter.get('/', authenticate, async (req, res) => {
    try {
      let query = db.collection(collectionName);
      if (req.user?.role !== 'SUPER_ADMIN') {
        query = query.where('schoolId', '==', req.user?.schoolId);
      } else if (req.query.schoolId) {
        query = query.where('schoolId', '==', req.query.schoolId);
      }
      const snapshot = await query.get();
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  crudRouter.post('/', authenticate, authorize(roles), async (req, res) => {
    try {
      console.log(`Creating document in ${collectionName}`, req.body);
      
      let data = {
        ...req.body,
        schoolId: req.user?.schoolId || null,
        createdAt: new Date().toISOString()
      };
      
      // Override schoolId if Super Admin specifies one
      if (req.user?.role === 'SUPER_ADMIN' && req.body.schoolId) {
        data.schoolId = req.body.schoolId;
      }

      // Special case: School Creation by Super Admin
      if (collectionName === 'schools' && req.user?.role === 'SUPER_ADMIN') {
        const { adminName, adminEmail, adminPassword, ...schoolData } = req.body;
        
        // Remove admin fields from school document
        const cleanSchoolData = { ...schoolData, createdAt: new Date().toISOString(), active: true };
        const schoolRef = await db.collection('schools').add(cleanSchoolData);
        const schoolId = schoolRef.id;

        // Create the SCHOOL_ADMIN user
        if (adminEmail && adminPassword) {
          const bcrypt = await import('bcryptjs');
          const passwordHash = await bcrypt.default.hash(adminPassword, 10);
          await db.collection('users').add({
            name: adminName || schoolData.name,
            email: adminEmail,
            passwordHash,
            role: 'SCHOOL_ADMIN',
            schoolId: schoolId,
            createdAt: new Date().toISOString()
          });
        }

        return res.status(201).json({ id: schoolId, ...cleanSchoolData });
      }

      if (transform) data = transform(data);

      // Remove undefined values and administrative helper fields
      Object.keys(data).forEach(key => {
        if (data[key] === undefined || ['adminName', 'adminEmail', 'adminPassword'].includes(key)) {
          delete data[key];
        }
      });

      const ref = await db.collection(collectionName).add(data);
      console.log(`Document created with ID: ${ref.id}`);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(`Error creating document in ${collectionName}:`, err);
      res.status(500).json({ message: err.message || 'Error occurred during creation' });
    }
  });

  crudRouter.get('/:id', authenticate, async (req, res) => {
    try {
      const doc = await db.collection(collectionName).doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      const data = doc.data();
      if (req.user?.role !== 'SUPER_ADMIN' && data?.schoolId !== req.user?.schoolId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      res.json({ id: doc.id, ...data });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  crudRouter.put('/:id', authenticate, authorize(roles), async (req, res) => {
    try {
      const docRef = db.collection(collectionName).doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      const existingData = doc.data();
      if (req.user?.role !== 'SUPER_ADMIN' && existingData?.schoolId !== req.user?.schoolId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      let updateData = { ...req.body, updatedAt: new Date().toISOString() };
      if (transform) updateData = transform(updateData);
      await docRef.update(updateData);
      res.json({ message: 'Updated successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  crudRouter.delete('/:id', authenticate, authorize(roles), async (req, res) => {
    try {
      const docRef = db.collection(collectionName).doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      const existingData = doc.data();
      if (req.user?.role !== 'SUPER_ADMIN' && existingData?.schoolId !== req.user?.schoolId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await docRef.delete();
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return crudRouter;
};

// Result transformation (Auto-grade)
const resultTransform = (data) => {
  const ca1 = Number(data.ca1) || 0;
  const ca2 = Number(data.ca2) || 0;
  const exam = Number(data.exam) || 0;
  const total = ca1 + ca2 + exam;
  const { grade, remark } = calculateGrade(total);
  return { ...data, ca1, ca2, exam, total, grade, remark };
};

// Mount CRUD routes
router.use('/schools', createCRUD('schools', ['SUPER_ADMIN']));
router.use('/students', createCRUD('students', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/teachers', createCRUD('teachers', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/classes', createCRUD('classes', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/subjects', createCRUD('subjects', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/results', createCRUD('results', ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'], resultTransform));
router.use('/sessions', createCRUD('sessions', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));

// Dashboard Stats
router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    const isSuper = req.user?.role === 'SUPER_ADMIN';

    const getCount = async (coll) => {
      let q = db.collection(coll);
      const isSuper = req.user?.role === 'SUPER_ADMIN';
      const selectedSchoolId = isSuper ? req.query.schoolId : req.user?.schoolId;

      if (selectedSchoolId) {
        q = q.where('schoolId', '==', selectedSchoolId);
      }
      const snap = await q.get();
      return snap.size;
    };

    const stats = {
      students: await getCount('students'),
      teachers: await getCount('teachers'),
      classes: await getCount('classes'),
      subjects: await getCount('subjects')
    };

    if (isSuper) {
      stats.schools = await getCount('schools');
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
