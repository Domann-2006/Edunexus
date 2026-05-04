import express from 'express';
import { db } from '../lib/firebase-admin.ts';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// Generic CRUD helper
const createCRUD = (collectionName: string, roles: string[]) => {
  const crudRouter = express.Router();

  // Create
  crudRouter.post('/', authenticate, authorize(roles), async (req: AuthRequest, res) => {
    try {
      const data = {
        ...req.body,
        schoolId: req.user?.schoolId,
        createdAt: new Date().toISOString() // Or server timestamp
      };
      
      // If Super Admin, they can specify schoolId in body
      if (req.user?.role === 'SUPER_ADMIN' && req.body.schoolId) {
        data.schoolId = req.body.schoolId;
      }

      const ref = await db.collection(collectionName).add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Read (List)
  crudRouter.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
      let query: any = db.collection(collectionName);
      
      // Multi-tenancy filter
      if (req.user?.role !== 'SUPER_ADMIN') {
        query = query.where('schoolId', '==', req.user?.schoolId);
      } else if (req.query.schoolId) {
        query = query.where('schoolId', '==', req.query.schoolId);
      }

      const snapshot = await query.get();
      const docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Read (Single)
  crudRouter.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      const doc = await db.collection(collectionName).doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      
      const data = doc.data();
      if (req.user?.role !== 'SUPER_ADMIN' && data?.schoolId !== req.user?.schoolId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      res.json({ id: doc.id, ...data });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update
  crudRouter.put('/:id', authenticate, authorize(roles), async (req: AuthRequest, res) => {
    try {
      const docRef = db.collection(collectionName).doc(req.params.id);
      const doc = await docRef.get();
      
      if (!doc.exists) return res.status(404).json({ message: 'Not found' });
      const existingData = doc.data();
      
      if (req.user?.role !== 'SUPER_ADMIN' && existingData?.schoolId !== req.user?.schoolId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await docRef.update({
        ...req.body,
        updatedAt: new Date().toISOString()
      });
      res.json({ message: 'Updated successfully' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete
  crudRouter.delete('/:id', authenticate, authorize(roles), async (req: AuthRequest, res) => {
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return crudRouter;
};

// Mount CRUD routes
router.use('/schools', createCRUD('schools', ['SUPER_ADMIN']));
router.use('/students', createCRUD('students', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/teachers', createCRUD('teachers', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/classes', createCRUD('classes', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/subjects', createCRUD('subjects', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));

// Dashboard Stats
router.get('/dashboard-stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const schoolId = req.user?.schoolId;
    const isSuper = req.user?.role === 'SUPER_ADMIN';

    const getCount = async (coll: string) => {
      let q: any = db.collection(coll);
      if (!isSuper) q = q.where('schoolId', '==', schoolId);
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
      (stats as any).schools = await getCount('schools');
    }

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
