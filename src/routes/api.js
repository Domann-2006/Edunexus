import express from 'express';
import { db } from '../lib/firebase-admin.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateGrade } from '../lib/grading.js';
import { LEVEL_CLASSES, DEFAULT_SUBJECTS } from '../lib/curriculum.js';

const router = express.Router();

// Helper to setup curriculum
async function setupSchoolCurriculum(schoolId) {
  try {
    const batch = db.batch();
    
    // Create Default Sessions
    const currentYear = new Date().getFullYear();
    const sessionData = {
      name: `${currentYear}/${currentYear + 1}`,
      isCurrent: true,
      schoolId: schoolId,
      createdAt: new Date().toISOString()
    };
    const sessionRef = db.collection('sessions').doc();
    batch.set(sessionRef, sessionData);

    // Create Classes and Subjects
    for (const level of Object.keys(LEVEL_CLASSES)) {
      // Create Classes and Subjects for this level
      const classNames = LEVEL_CLASSES[level];
      const streamSubjects = DEFAULT_SUBJECTS[level];

      for (const className of classNames) {
        const classRef = db.collection('classes').doc();
        batch.set(classRef, {
          name: className,
          level: level,
          schoolId: schoolId,
          createdAt: new Date().toISOString()
        });

        // Create Subjects for each class in this level
        for (const stream of Object.keys(streamSubjects)) {
          const subjects = streamSubjects[stream];
          for (const subjectName of subjects) {
            const subjectRef = db.collection('subjects').doc();
            batch.set(subjectRef, {
              name: subjectName,
              level: level,
              class: className,
              stream: stream,
              schoolId: schoolId,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }

    await batch.commit();
    console.log(`Curriculum preloaded for school: ${schoolId}`);
  } catch (err) {
    console.error('Failed to preload curriculum:', err);
    // Don't throw, we want the school creation to succeed even if preloading fails
  }
}

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
      
      // Mandatory school filtering
      if (req.user?.role !== 'SUPER_ADMIN') {
        query = query.where('schoolId', '==', req.user?.schoolId);
      } else if (req.query.schoolId) {
        query = query.where('schoolId', '==', req.query.schoolId);
      }

      // Teacher-based filtering for students and classes
      if (req.user?.role === 'TEACHER') {
        const teacherSnap = await db.collection('teachers').where('userId', '==', req.user.id).limit(1).get();
        if (!teacherSnap.empty) {
          const teacherData = teacherSnap.docs[0].data();
          // The admin now inputs names like "Primary 1", which are stored in assignedClassIds
          const assignedClassNames = teacherData.assignedClassIds || [];
          
          if (collectionName === 'students' || collectionName === 'classes' || collectionName === 'results' || collectionName === 'attendance') {
            if (assignedClassNames.length > 0) {
              // 1. Resolve names to IDs for data that uses IDs
              const classesSnap = await db.collection('classes')
                .where('schoolId', '==', req.user.schoolId)
                .where('name', 'in', assignedClassNames.slice(0, 10))
                .get();
              
              const resolvedClassIds = classesSnap.docs.map(d => d.id);
              
              if (collectionName === 'classes') {
                if (resolvedClassIds.length > 0) {
                  query = query.where('__name__', 'in', resolvedClassIds.slice(0, 10));
                } else {
                  // Fallback: search by name if they are names
                  query = query.where('name', 'in', assignedClassNames.slice(0, 10));
                }
              } else {
                if (resolvedClassIds.length > 0) {
                  query = query.where('classId', 'in', resolvedClassIds.slice(0, 10));
                } else {
                  return res.json([]);
                }
              }
            } else {
              return res.json([]);
            }
          }
        }
      }

      // Dynamic filters from query params
      const skipParams = ['schoolId', 'limit', 'offset', 'sort'];
      Object.keys(req.query).forEach(key => {
        if (!skipParams.includes(key) && req.query[key]) {
          query = query.where(key, '==', req.query[key]);
        }
      });

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
      
      // Teacher validation: Can only create in assigned classes
      if (req.user?.role === 'TEACHER' && (collectionName === 'students' || collectionName === 'attendance' || collectionName === 'results')) {
        const teacherSnap = await db.collection('teachers').where('userId', '==', req.user.id).limit(1).get();
        if (teacherSnap.empty) return res.status(403).json({ message: 'Teacher profile not found' });
        
        const teacherData = teacherSnap.docs[0].data();
        const assignedClassIds = teacherData.assignedClassIds || [];
        const targetClassId = req.body.classId;
        
        if (!assignedClassIds.includes(targetClassId)) {
          return res.status(403).json({ message: 'You can only manage data for your assigned classes' });
        }
      }

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

        // Automatically setup Nigerian Curriculum
        await setupSchoolCurriculum(schoolId);

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

      // Log Activity for teachers
      if (req.user?.role === 'TEACHER') {
        await db.collection('activity-logs').add({
          userId: req.user.id,
          userName: req.user.name,
          role: req.user.role,
          action: `CREATE_${collectionName.toUpperCase().slice(0, -1)}`,
          details: `Teacher recorded new ${collectionName.slice(0, -1)}: ${JSON.stringify(req.body).slice(0, 200)}`,
          schoolId: req.user.schoolId,
          createdAt: new Date().toISOString()
        });
      }

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

      // Teacher validation: Can only update if in assigned class
      if (req.user?.role === 'TEACHER' && (collectionName === 'students' || collectionName === 'attendance' || collectionName === 'results')) {
        const teacherSnap = await db.collection('teachers').where('userId', '==', req.user.id).limit(1).get();
        if (teacherSnap.empty) return res.status(403).json({ message: 'Teacher profile not found' });
        
        const teacherData = teacherSnap.docs[0].data();
        const assignedClassIds = teacherData.assignedClassIds || [];
        
        if (!assignedClassIds.includes(existingData.classId)) {
          return res.status(403).json({ message: 'You can only update data for your assigned classes' });
        }
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
router.use('/students', createCRUD('students', ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']));

// Customized Teachers Creation to handle User account and Login Credentials
const teacherRouter = createCRUD('teachers', ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

// Override POST for teachers to create user account
teacherRouter.post('/', authenticate, authorize(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    const { name, email, username, password, assignedClassIds, assignedSubjectIds, ...teacherFields } = req.body;
    const schoolId = req.user?.role === 'SUPER_ADMIN' ? (req.body.schoolId || req.user.schoolId) : req.user.schoolId;

    // Check if user already exists
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password (use provided or auto-generate)
    const bcrypt = await import('bcryptjs');
    const actualPassword = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.default.hash(actualPassword, 10);

    // 1. Create User Document
    const userRef = await db.collection('users').add({
      name,
      email,
      username: username || email.split('@')[0],
      passwordHash,
      role: 'TEACHER',
      schoolId: schoolId,
      createdAt: new Date().toISOString()
    });

    // 2. Create Teacher Document
    const teacherData = {
      ...teacherFields,
      userId: userRef.id,
      name,
      email,
      username: username || email.split('@')[0],
      schoolId,
      assignedClassIds: assignedClassIds || [],
      assignedSubjectIds: assignedSubjectIds || [],
      createdAt: new Date().toISOString()
    };
    
    const teacherRef = await db.collection('teachers').add(teacherData);

    // Log Activity
    await db.collection('activity-logs').add({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'CREATE_TEACHER',
      details: `Created teacher ${name} (${email}). Credentials generated.`,
      schoolId: schoolId,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      id: teacherRef.id,
      ...teacherData,
      credentials: {
        email,
        password: actualPassword
      }
    });
  } catch (err) {
    console.error('Teacher creation failed:', err);
    res.status(500).json({ message: err.message });
  }
});

router.use('/teachers', teacherRouter);
router.use('/classes', createCRUD('classes', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/subjects', createCRUD('subjects', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/results', createCRUD('results', ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'], resultTransform));
router.use('/sessions', createCRUD('sessions', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/attendance', createCRUD('attendance', ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']));
router.use('/activity-logs', createCRUD('activity-logs', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));

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
