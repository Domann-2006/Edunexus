import express from 'express';
import bcrypt from 'bcryptjs';
import admin, { db } from '../lib/firebase-admin.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { calculateGrade } from '../lib/grading.js';
import { LEVEL_CLASSES, DEFAULT_SUBJECTS } from '../lib/curriculum.js';

const router = express.Router();

async function createNotification({ recipientId, recipientRole, schoolId, title, message, type, metadata }) {
  try {
    if (!recipientId) return;
    const notificationData = {
      recipientId,
      recipientRole,
      schoolId: schoolId || 'SUPER',
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      ...(metadata ? { metadata } : {})
    };
    await db.collection('notifications').add(notificationData);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// --- BACKEND MEMORY CACHING SYSTEM FOR FIRESTORE READ OPTIMIZATION ---
const teacherProfileCache = new Map(); // userId -> { data, expires }
const schoolCollectionCache = new Map(); // `${schoolId}:${collectionName}` -> { data, expires }
const dashboardStatsCache = new Map(); // `${schoolId}:${isSuper}` -> { data, expires }

export const getCachedTeacherProfile = async (userId) => {
  if (!userId) return null;
  const now = Date.now();
  const cached = teacherProfileCache.get(userId);
  if (cached && cached.expires > now) {
    return cached.data;
  }
  const teacherSnap = await db.collection('teachers').where('userId', '==', userId).limit(1).get();
  if (teacherSnap.empty) {
    teacherProfileCache.set(userId, { data: null, expires: now + 5000 });
    return null;
  }
  const docObj = teacherSnap.docs[0];
  const profile = { id: docObj.id, ...docObj.data() };
  teacherProfileCache.set(userId, { data: profile, expires: now + 30000 }); // Cache for 30s
  return profile;
};

export const clearTeacherProfileCache = (userId) => {
  if (userId) {
    teacherProfileCache.delete(userId);
  } else {
    teacherProfileCache.clear();
  }
};

export const getCachedSchoolCollection = async (schoolId, collectionName) => {
  const key = `${schoolId}:${collectionName}`;
  const now = Date.now();
  const cached = schoolCollectionCache.get(key);
  if (cached && cached.expires > now) {
    return cached.data;
  }
  let query = db.collection(collectionName);
  if (schoolId && schoolId !== 'SUPER') {
    query = query.where('schoolId', '==', schoolId);
  }
  const snapshot = await query.get();
  const data = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));
  schoolCollectionCache.set(key, { data, expires: now + 30000 }); // Cache for 30s
  return data;
};

export const clearSchoolCollectionCache = (schoolId, collectionName) => {
  const key = `${schoolId}:${collectionName}`;
  schoolCollectionCache.delete(key);
  if (!schoolId) {
    for (const k of schoolCollectionCache.keys()) {
      if (k.endsWith(`:${collectionName}`)) {
        schoolCollectionCache.delete(k);
      }
    }
  }
};

export const invalidateAllCaches = (schoolId = null) => {
  teacherProfileCache.clear();
  dashboardStatsCache.clear();
  if (schoolId) {
    for (const key of schoolCollectionCache.keys()) {
      if (key.startsWith(`${schoolId}:`)) {
        schoolCollectionCache.delete(key);
      }
    }
  } else {
    schoolCollectionCache.clear();
  }
};

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
  } catch (err) {
    console.error('Failed to preload curriculum:', err);
    // Don't throw, we want the school creation to succeed even if preloading fails
  }
}

// SaaS Limits
const PLAN_LIMITS = {
  BASIC: { users: 200, classes: 15 },
  PRO: { users: 1000, classes: 50 },
  PREMIUM: { users: 10000, classes: 200 },
  ENTERPRISE: { users: Infinity, classes: Infinity },
};

// Helper to log activities
async function logActivity(req, action, details, customSchoolId = null) {
  try {
    const schoolId = customSchoolId || req.user?.schoolId || 'SUPER';
    const schoolName = req.user?.schoolName || 'System';
    const logData = {
      userId: req.user?.id || 'SYSTEM',
      userName: req.user?.name || 'System',
      role: req.user?.role || 'SYSTEM',
      action,
      details,
      schoolId,
      schoolName,
      status: 'SUCCESS',
      createdAt: new Date().toISOString()
    };
    await db.collection('activity-logs').add(logData);
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

// Generic CRUD helper
const createCRUD = (collectionName, roles, transform, options = {}) => {
  const crudRouter = express.Router();
  const { skipPost = false, skipPut = false, skipDelete = false } = options;

  // Create
  crudRouter.get('/', authenticate, async (req, res) => {
    try {
      let query = db.collection(collectionName);
      
      // Mandatory school filtering
      if (req.user?.role !== 'SUPER_ADMIN') {
        if (collectionName === 'schools') {
          query = query.where('__name__', '==', req.user?.schoolId);
        } else {
          query = query.where('schoolId', '==', req.user?.schoolId);
        }
      } else if (req.query.schoolId) {
        query = query.where('schoolId', '==', req.query.schoolId);
      }

      // Teacher-based filtering for students, classes, subjects, results, and attendance
      if (req.user?.role === 'TEACHER') {
        const teacherProfile = await getCachedTeacherProfile(req.user.id);
        if (teacherProfile) {
          const teacherData = teacherProfile;
          // Clear up confusion: assignedClassIds stores class IDs; assignedSubjectIds stores subject Names.
          const assignedClassIds = teacherData.assignedClassIds || [];
          const assignedSubjectNames = teacherData.assignedSubjectIds || [];
          
          if (['students', 'classes', 'results', 'attendance', 'subjects'].includes(collectionName)) {
            if (assignedClassIds.length > 0) {
              // 1. Resolve Class Names for collections matching metadata names (like subjects)
              const allSchoolClasses = await getCachedSchoolCollection(req.user.schoolId, 'classes');
              const assignedClassNames = allSchoolClasses
                .filter(c => assignedClassIds.includes(c.id))
                .map(c => c.name);

              if (collectionName === 'classes') {
                query = query.where('__name__', 'in', assignedClassIds.slice(0, 30));
              } else if (collectionName === 'subjects') {
                if (assignedClassNames.length > 0) {
                  query = query.where('class', 'in', assignedClassNames.slice(0, 30));
                } else {
                  return res.json([]);
                }
              } else {
                // students, results, attendance query using 'classId' lookup
                query = query.where('classId', 'in', assignedClassIds.slice(0, 30));
              }
            } else {
              return res.json([]);
            }
          }
        } else {
          return res.json([]);
        }
      }

      // Dynamic filters from query params with strict whitelist
      const allowedFilters = {
        students: ['classId', 'status', 'gender'],
        teachers: ['classId', 'roleType'],
        classes: ['level'],
        subjects: ['level', 'class', 'stream'],
        results: ['classId', 'subjectName', 'status', 'sessionId', 'term'],
        attendance: ['classId', 'date', 'sessionId'],
        sessions: ['isCurrent'],
        announcements: ['type'],
        schools: [],
        'activity-logs': ['action', 'role'],
        notifications: [],
      };
      const allowed = allowedFilters[collectionName] || [];
      Object.keys(req.query).forEach(key => {
        if (allowed.includes(key) && req.query[key]) {
          query = query.where(key, '==', req.query[key]);
        }
      });

      // Add default limit to prevent server overload
      const limit = parseInt(req.query.limit) || 100;
      query = query.limit(limit);

      const snapshot = await query.get();
      let docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // If of type subjects or results, filter down to assigned subjects as well for TEACHERs
      if (req.user?.role === 'TEACHER' && (collectionName === 'subjects' || collectionName === 'results')) {
        const teacherProfile = await getCachedTeacherProfile(req.user.id);
        if (teacherProfile) {
          const teacherData = teacherProfile;
          const roleType = teacherData.roleType || 'BOTH';
          const isClassOrBoth = roleType === 'CLASS' || roleType === 'BOTH';
          const isSubjectOrBoth = roleType === 'SUBJECT' || roleType === 'BOTH';
          const classAssignments = teacherData.classAssignments || [];
          const subjectAssignments = teacherData.subjectAssignments || [];
          const assignedSubjectNames = teacherData.assignedSubjectIds || [];

          // Pre-fetch class mappings
          const allSchoolClasses = await getCachedSchoolCollection(req.user.schoolId, 'classes');

          if (collectionName === 'subjects') {
            docs = docs.filter(doc => {
              // 1. If Class Teacher for the class of the subject, allow it
              const isClassTeacherForThis = isClassOrBoth && classAssignments.some(cId => {
                const foundClass = allSchoolClasses.find(c => c.id === cId);
                return foundClass && foundClass.name === doc.class;
              });
              if (isClassTeacherForThis) return true;

              // 2. Adjust for subject assignment matching subject and class names
              if (isSubjectOrBoth) {
                if (subjectAssignments.length > 0) {
                  return subjectAssignments.some(sa => sa.subjectName === doc.name && sa.className === doc.class);
                }
                return assignedSubjectNames.includes(doc.name);
              }
              return false;
            });
          } else if (collectionName === 'results') {
            docs = docs.filter(doc => {
              // Results are exclusively subject-teacher and both roles domain
              if (!isSubjectOrBoth) return false;
              if (subjectAssignments.length > 0) {
                return subjectAssignments.some(sa => sa.classId === doc.classId && sa.subjectName === doc.subjectName);
              }
              return assignedSubjectNames.includes(doc.subjectName);
            });
          }
        }
      }

      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  if (!skipPost) {
    crudRouter.post('/', authenticate, authorize(roles), async (req, res) => {
      try {

        // Only Super Admins can create schools
        if (collectionName === 'schools' && req.user?.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ message: 'Only Super Admins can create schools' });
        }

        if (collectionName === 'classes') {
          const schoolDoc = await db.collection('schools').doc(req.user.schoolId).get();
          const plan = schoolDoc.exists ? (schoolDoc.data().plan || 'BASIC') : 'BASIC';
          const classLimit = PLAN_LIMITS[plan]?.classes || 0;
          const classCountSnap = await db.collection('classes').where('schoolId', '==', req.user.schoolId).count().get();
          const currentClassCount = classCountSnap.data().count;
          if (currentClassCount >= classLimit) {
            return res.status(403).json({ message: 'Class limit reached for your plan. Please upgrade to add more classes.' });
          }
        }
        
        // Teacher validation: Can only create in assigned classes
        if (req.user?.role === 'TEACHER' && (collectionName === 'students' || collectionName === 'attendance' || collectionName === 'results')) {
          const teacherProfile = await getCachedTeacherProfile(req.user.id);
          if (!teacherProfile) return res.status(403).json({ message: 'Teacher profile not found' });
          
          const teacherData = teacherProfile;
          const targetClassId = req.body.classId;

          if (collectionName === 'students') {
            const isClassTeacher = !teacherData.roleType || teacherData.roleType === 'CLASS' || teacherData.roleType === 'BOTH';
            const classAssignments = teacherData.classAssignments || teacherData.assignedClassIds || [];
            if (!isClassTeacher || !classAssignments.includes(targetClassId)) {
              return res.status(403).json({ message: 'Only Class Teachers assigned to this class can manage students.' });
            }
          } else {
            // Attendance / Results
            const assignedClassIds = teacherData.assignedClassIds || [];
            if (!assignedClassIds.includes(targetClassId)) {
              return res.status(403).json({ message: 'You can only manage data for your assigned classes' });
            }
          }
        }

        if (collectionName === 'attendance') {
          const existingAtt = await db.collection('attendance')
            .where('classId', '==', req.body.classId)
            .where('date', '==', req.body.date)
            .where('studentId', '==', req.body.studentId)
            .limit(1)
            .get();
          if (!existingAtt.empty) {
            // Update existing instead of creating duplicate
            await existingAtt.docs[0].ref.update({
              status: req.body.status,
              updatedAt: new Date().toISOString(),
              updatedBy: req.user?.id
            });
            return res.json({ id: existingAtt.docs[0].id, ...existingAtt.docs[0].data(), status: req.body.status });
          }
        }

        let data = {
          ...req.body,
          schoolId: req.user?.schoolId || null,
          addedBy: req.user?.id || 'SYSTEM',
          addedByRole: req.user?.role || 'SYSTEM',
          createdAt: new Date().toISOString()
        };
        
        // Override schoolId if Super Admin specifies one
        if (req.user?.role === 'SUPER_ADMIN' && req.body.schoolId) {
          data.schoolId = req.body.schoolId;
        }

        // Special case: School Creation by Super Admin
        if (collectionName === 'schools' && req.user?.role === 'SUPER_ADMIN') {
          const { adminPassword, ...schoolData } = req.body;
          
          // Create the school document (keeping adminName and adminEmail for metadata)
          const cleanSchoolData = { ...schoolData, createdAt: new Date().toISOString(), active: true };
          const schoolRef = await db.collection('schools').add(cleanSchoolData);
          const schoolId = schoolRef.id;

          const newDoc = schoolRef;
          const dataToSave = cleanSchoolData;

          // Auto-initialize chat documents for new school
          const newSchoolId = newDoc.id;
          const chatBatch = db.batch();

          // Support chat (school <-> super admin)
          chatBatch.set(db.collection('chats').doc(newSchoolId), {
            schoolId: newSchoolId,
            schoolName: dataToSave.name,
            type: 'support',
            lastMessage: '',
            unreadCount: 0,
            unreadCountAdmin: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Group chat
          chatBatch.set(db.collection('chats').doc(`group_${newSchoolId}`), {
            schoolId: newSchoolId,
            name: `${dataToSave.name} Staff`,
            type: 'group',
            isOpen: true,
            memberIds: [],
            memberCount: 0,
            lastMessage: '',
            unreadCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          await chatBatch.commit();

          // Create the SCHOOL_ADMIN user
          if (schoolData.adminEmail && adminPassword) {
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            await db.collection('users').add({
              name: schoolData.adminName || schoolData.name,
              email: schoolData.adminEmail,
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

        // Trigger notifications in fire-and-forget fashion
        if (collectionName === 'students') {
          (async () => {
            try {
              // Get class name for descriptive notification
              let notifClassName = data.className || '';
              let notifClassLevel = data.level || '';
              if (!notifClassName && data.classId) {
                try {
                  const classDoc = await db.collection('classes').doc(data.classId).get();
                  if (classDoc.exists) {
                    notifClassName = classDoc.data().name || '';
                    notifClassLevel = classDoc.data().level || '';
                  }
                } catch (e) {}
              }

              const teachersSnap = await db.collection('users')
                .where('schoolId', '==', data.schoolId)
                .where('role', '==', 'TEACHER')
                .get();
              teachersSnap.forEach(tDoc => {
                createNotification({
                  recipientId: tDoc.id,
                  recipientRole: 'TEACHER',
                  schoolId: data.schoolId,
                  title: 'New Student Enrolled',
                  message: `${data.name || 'A new student'} has been enrolled in ${notifClassName || data.classId || 'a class'}${notifClassLevel ? ` (${notifClassLevel})` : ''}${data.department ? ` as a ${data.department} student` : ''}`,
                  type: 'student'
                });
              });

              const adminsSnap = await db.collection('users')
                .where('schoolId', '==', data.schoolId)
                .where('role', '==', 'SCHOOL_ADMIN')
                .get();
              adminsSnap.forEach(aDoc => {
                createNotification({
                  recipientId: aDoc.id,
                  recipientRole: 'SCHOOL_ADMIN',
                  schoolId: data.schoolId,
                  title: 'New Student Enrolled',
                  message: `${data.name || 'A new student'} has been enrolled in ${notifClassName || data.classId || 'a class'}${notifClassLevel ? ` (${notifClassLevel})` : ''}${data.department ? ` as a ${data.department} student` : ''}`,
                  type: 'student'
                });
              });
            } catch (err) {
              console.error('Failed to trigger student added notification:', err);
            }
          })();
        } else if (collectionName === 'announcements') {
          (async () => {
            try {
              const announcementSchoolId = data.schoolId && data.schoolId !== 'SUPER' ? data.schoolId : null;

              const teachersQuery = announcementSchoolId
                ? db.collection('users').where('schoolId', '==', announcementSchoolId).where('role', '==', 'TEACHER')
                : db.collection('users').where('role', '==', 'TEACHER');

              const adminsQuery = announcementSchoolId
                ? db.collection('users').where('schoolId', '==', announcementSchoolId).where('role', '==', 'SCHOOL_ADMIN')
                : db.collection('users').where('role', '==', 'SCHOOL_ADMIN');

              const teachersSnap = await teachersQuery.get();
              teachersSnap.forEach(tDoc => {
                createNotification({
                  recipientId: tDoc.id,
                  recipientRole: 'TEACHER',
                  schoolId: tDoc.data().schoolId || data.schoolId,
                  title: `📢 ${data.title || 'New Announcement'}`,
                  message: `${data.message || data.body || data.content || 'A new announcement has been posted. Tap to view.'}`,
                  type: 'announcement'
                });
              });

              const adminsSnap = await adminsQuery.get();
              adminsSnap.forEach(aDoc => {
                createNotification({
                  recipientId: aDoc.id,
                  recipientRole: 'SCHOOL_ADMIN',
                  schoolId: aDoc.data().schoolId || data.schoolId,
                  title: `📢 ${data.title || 'New Announcement'}`,
                  message: `${data.message || data.body || data.content || 'A new announcement has been posted. Tap to view.'}`,
                  type: 'announcement'
                });
              });
            } catch (err) {
              console.error('Failed to trigger announcement notification:', err);
            }
          })();
        }

        // Log Activity for all roles
        try {
          const entityName = collectionName.toUpperCase().replace(/S$/, '');
          const roleText = req.user?.role === 'TEACHER' ? 'Teacher' : req.user?.role === 'SCHOOL_ADMIN' ? 'School Admin' : 'Super Admin';
          let displayField = req.body.name || req.body.title || req.body.studentId || '';
          const details = `${roleText} created ${collectionName.replace(/s$/, '')} ${displayField}`.trim();
          await logActivity(req, `CREATE_${entityName}`, details, data.schoolId);
        } catch (logErr) {
          console.error('Error logging creation:', logErr);
        }

        // Invalidate caching scopes
        if (req.user?.schoolId) {
          clearSchoolCollectionCache(req.user.schoolId, collectionName);
          dashboardStatsCache.delete(`${req.user.schoolId}:true`);
          dashboardStatsCache.delete(`${req.user.schoolId}:false`);
        }

        res.status(201).json({ id: ref.id, ...data });
      } catch (err) {
        console.error(`Error creating document in ${collectionName}:`, err);
        res.status(500).json({ message: err.message || 'Error occurred during creation' });
      }
    });
  }

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

  if (!skipPut) {
    crudRouter.put('/:id', authenticate, authorize(roles), async (req, res) => {
      try {
        const docRef = db.collection(collectionName).doc(req.params.id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ message: 'Not found' });
        const existingData = doc.data();
        
        const isOwnSchool = collectionName === 'schools' && req.params.id === req.user?.schoolId;
        
        if (req.user?.role !== 'SUPER_ADMIN' && !isOwnSchool && existingData?.schoolId !== req.user?.schoolId) {
          return res.status(403).json({ message: 'Forbidden' });
        }

        // Teacher validation: Can only update if in assigned class
        if (req.user?.role === 'TEACHER' && (collectionName === 'students' || collectionName === 'attendance' || collectionName === 'results')) {
          const teacherProfile = await getCachedTeacherProfile(req.user.id);
          if (!teacherProfile) return res.status(403).json({ message: 'Teacher profile not found' });
          
          const teacherData = teacherProfile;
          const targetClassId = existingData.classId;

          if (collectionName === 'students') {
            const isClassTeacher = !teacherData.roleType || teacherData.roleType === 'CLASS' || teacherData.roleType === 'BOTH';
            const classAssignments = teacherData.classAssignments || teacherData.assignedClassIds || [];
            if (!isClassTeacher || !classAssignments.includes(targetClassId)) {
              return res.status(403).json({ message: 'Only Class Teachers assigned to this class can update students.' });
            }
          } else {
            // Attendance / Results
            const assignedClassIds = teacherData.assignedClassIds || [];
            if (!assignedClassIds.includes(targetClassId)) {
              return res.status(403).json({ message: 'You can only update data for your assigned classes' });
            }
          }
        }

        let updateData = { 
          ...req.body, 
          updatedAt: new Date().toISOString(),
          updatedBy: req.user?.id,
          updatedByRole: req.user?.role
        };
        if (transform) updateData = transform(updateData);
        
        // Remove undefined values to prevent Firestore crashes
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) delete updateData[key];
        });

        await docRef.update(updateData);
        const updatedDoc = await docRef.get();

        // Log Activity for all roles
        try {
          const entityName = collectionName.toUpperCase().replace(/S$/, '');
          const roleText = req.user?.role === 'TEACHER' ? 'Teacher' : req.user?.role === 'SCHOOL_ADMIN' ? 'School Admin' : 'Super Admin';
          const displayField = req.body.name || req.body.title || req.body.studentId || req.params.id;
          const details = `${roleText} updated ${collectionName.replace(/s$/, '')} ${displayField}`.trim();
          await logActivity(req, `UPDATE_${entityName}`, details, existingData.schoolId);
        } catch (logErr) {
          console.error('Error logging update:', logErr);
        }

        // Invalidate caching scopes
        if (req.user?.schoolId) {
          clearSchoolCollectionCache(req.user.schoolId, collectionName);
          dashboardStatsCache.delete(`${req.user.schoolId}:true`);
          dashboardStatsCache.delete(`${req.user.schoolId}:false`);
        }

        res.json({ message: 'Updated successfully', data: { id: updatedDoc.id, ...updatedDoc.data() } });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
  }

  if (!skipDelete) {
    crudRouter.delete('/:id', authenticate, authorize(roles), async (req, res) => {
      try {
        const docRef = db.collection(collectionName).doc(req.params.id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ message: 'Not found' });
        const existingData = doc.data();

        // Only Super Admins can delete schools
        if (collectionName === 'schools' && req.user?.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ message: 'Only Super Admins can delete schools' });
        }

        if (req.user?.role !== 'SUPER_ADMIN' && existingData?.schoolId !== req.user?.schoolId) {
          return res.status(403).json({ message: 'Forbidden' });
        }

        // Teacher validation output on DELETE: Can only delete in assigned classes
        if (req.user?.role === 'TEACHER' && (collectionName === 'students' || collectionName === 'attendance' || collectionName === 'results')) {
          const teacherProfile = await getCachedTeacherProfile(req.user.id);
          if (!teacherProfile) return res.status(403).json({ message: 'Teacher profile not found' });
          
          const teacherData = teacherProfile;
          const targetClassId = existingData.classId;

          if (collectionName === 'students') {
            const isClassTeacher = !teacherData.roleType || teacherData.roleType === 'CLASS' || teacherData.roleType === 'BOTH';
            const classAssignments = teacherData.classAssignments || teacherData.assignedClassIds || [];
            if (!isClassTeacher || !classAssignments.includes(targetClassId)) {
              return res.status(403).json({ message: 'Only Class Teachers assigned to this class can delete students.' });
            }
          } else {
            // Attendance / Results 
            const assignedClassIds = teacherData.assignedClassIds || [];
            if (!assignedClassIds.includes(targetClassId)) {
              return res.status(403).json({ message: 'You can only delete data for your assigned classes' });
            }
          }
        }

        await docRef.delete();

        // Cascade cleanup when a school is deleted
        if (collectionName === 'schools') {
          const schoolId = req.params.id;
          try {
            const collectionsToClean = ['users', 'students', 'teachers', 'classes', 'subjects', 'results', 'attendance', 'sessions', 'activity-logs', 'notifications'];
            for (const col of collectionsToClean) {
              const snap = await db.collection(col).where('schoolId', '==', schoolId).limit(500).get();
              if (!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
            }
            // Delete chat documents
            const chatIds = [schoolId, `group_${schoolId}`];
            for (const chatId of chatIds) {
              const chatRef = db.collection('chats').doc(chatId);
              const messagesSnap = await chatRef.collection('messages').limit(500).get();
              if (!messagesSnap.empty) {
                const batch = db.batch();
                messagesSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
              await chatRef.delete();
            }
            // Delete DM chats
            const dmSnap = await db.collection('chats').where('schoolId', '==', schoolId).get();
            if (!dmSnap.empty) {
              const batch = db.batch();
              dmSnap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          } catch (cascadeErr) {
            console.error('School cascade deletion error:', cascadeErr);
          }
        }

        // Log Activity for all roles
        try {
          const entityName = collectionName.toUpperCase().replace(/S$/, '');
          const roleText = req.user?.role === 'TEACHER' ? 'Teacher' : req.user?.role === 'SCHOOL_ADMIN' ? 'School Admin' : 'Super Admin';
          const displayField = existingData.name || existingData.title || req.params.id;
          const details = `${roleText} deleted ${collectionName.replace(/s$/, '')} ${displayField}`.trim();
          await logActivity(req, `DELETE_${entityName}`, details, existingData.schoolId);
        } catch (logErr) {
          console.error('Error logging deletion:', logErr);
        }

        // Invalidate caching scopes
        if (req.user?.schoolId) {
          clearSchoolCollectionCache(req.user.schoolId, collectionName);
          dashboardStatsCache.delete(`${req.user.schoolId}:true`);
          dashboardStatsCache.delete(`${req.user.schoolId}:false`);
        }

        res.json({ message: 'Deleted successfully' });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
  }

  return crudRouter;
};

// Result transformation (Auto-grade)
const resultTransform = (data) => {
  const ca1 = Number(data.ca1) || 0;
  const ca2 = Number(data.ca2) || 0;
  const assignment = Number(data.assignment) || 0;
  const test = Number(data.test) || 0;
  const exam = Number(data.exam) || 0;
  const total = ca1 + ca2 + assignment + test + exam;
  const { grade, remark } = calculateGrade(total);
  return { ...data, ca1, ca2, assignment, test, exam, total, grade, remark };
};

// Mount CRUD routes
router.use('/schools', createCRUD('schools', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));
router.use('/students', createCRUD('students', ['SCHOOL_ADMIN', 'TEACHER']));

async function createTeacherChats(schoolId, teacherId, teacherName, adminId, adminName) {
  const db = admin.firestore();

  // Create DM
  const dmId = `dm_${schoolId}_${teacherId}`;
  const dmRef = db.collection('chats').doc(dmId);
  const dmSnap = await dmRef.get();
  if (!dmSnap.exists) {
    await dmRef.set({
      id: dmId,
      type: 'dm',
      schoolId,
      adminId,
      teacherId,
      teacherName,
      adminName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      unreadCountAdmin: 0,
      unreadCountTeacher: 0,
    });
  }

  // Add to group or create group
  const groupId = `group_${schoolId}`;
  const groupRef = db.collection('chats').doc(groupId);
  const groupSnap = await groupRef.get();
  if (groupSnap.exists) {
    await groupRef.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(teacherId),
      memberCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await groupRef.set({
      id: groupId,
      type: 'group',
      schoolId,
      adminId,
      name: `${adminName} — Staff Group`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      isOpen: true,
      memberIds: [adminId, teacherId],
      memberCount: 2,
    });
  }
}

async function removeTeacherChats(schoolId, teacherId) {
  const db = admin.firestore();

  // Delete DM and its messages
  const dmId = `dm_${schoolId}_${teacherId}`;
  const dmRef = db.collection('chats').doc(dmId);
  const messagesSnap = await dmRef.collection('messages').get();
  const batch = db.batch();
  messagesSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(dmRef);
  await batch.commit();

  // Remove from group
  const groupRef = db.collection('chats').doc(`group_${schoolId}`);
  await groupRef.update({
    memberIds: admin.firestore.FieldValue.arrayRemove(teacherId),
    memberCount: admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Customized Teachers Creation to handle User account and Login Credentials
const teacherRouter = createCRUD('teachers', ['SCHOOL_ADMIN'], null, { skipPost: true, skipPut: true, skipDelete: true });

// Override POST for teachers to create user account
teacherRouter.post('/', authenticate, authorize(['SCHOOL_ADMIN']), async (req, res) => {
  try {
    const { name, email, username, password, assignedClassIds, assignedSubjectIds, roleType, classAssignments, subjectAssignments, ...teacherFields } = req.body;
    const schoolId = req.user?.role === 'SUPER_ADMIN' ? (req.body.schoolId || req.user.schoolId) : req.user.schoolId;

    // Check if user already exists
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!userSnapshot.empty) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    const plan = schoolDoc.exists ? (schoolDoc.data().plan || 'BASIC') : 'BASIC';
    const userLimit = PLAN_LIMITS[plan]?.users || 0;
    const userCountSnap = await db.collection('users').where('schoolId', '==', schoolId).count().get();
    const currentUserCount = userCountSnap.data().count;
    if (currentUserCount >= userLimit) {
      return res.status(403).json({ message: 'User limit reached for your plan. Please upgrade to add more users.' });
    }

    // Hash password (use provided or auto-generate)
    const actualPassword = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(actualPassword, 10);

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
      roleType: roleType || 'BOTH',
      classAssignments: classAssignments || [],
      subjectAssignments: subjectAssignments || [],
      createdAt: new Date().toISOString()
    };
    
    const teacherRef = await db.collection('teachers').add(teacherData);

    // Auto-initialize DM chat for new teacher
    {
      const newUser = userRef;
      const schoolId = req.user.schoolId;
      const teacherUserId = newUser.id;
      const firstName = req.body.firstName || name.split(' ')[0] || '';
      const lastName = req.body.lastName || name.split(' ').slice(1).join(' ') || '';
      await db.collection('chats').doc(`dm_${schoolId}_${teacherUserId}`).set({
        schoolId,
        teacherId: teacherUserId,
        teacherName: `${firstName} ${lastName}`,
        type: 'dm',
        lastMessage: '',
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Automatically create chats
    try {
      await createTeacherChats(
        schoolId, 
        teacherRef.id, 
        name, 
        req.user?.id || 'SYSTEM', 
        req.user?.name || 'School Admin'
      );
    } catch (chatErr) {
      console.error('Failed to auto-create teacher chats in Firestore:', chatErr);
    }

    // Log Activity
    await logActivity(req, 'CREATE_TEACHER', `School Admin created teacher ${name} (${email}). Credentials generated.`, schoolId);

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

// Sync Teacher updates with Users collection
teacherRouter.put('/:id', authenticate, authorize(['SCHOOL_ADMIN']), async (req, res) => {
  try {
    const docRef = db.collection('teachers').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'Teacher profile not found' });
    const teacherData = doc.data();

    // Verification
    if (teacherData.schoolId !== req.user?.schoolId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { password, ...updateData } = req.body;
    const finalUpdate = { ...updateData, updatedAt: new Date().toISOString() };

    // Update Teacher Profile
    await docRef.update(finalUpdate);

    // Update User Document
    if (teacherData.userId) {
      const userUpdate = {
        name: finalUpdate.name || teacherData.name,
        email: finalUpdate.email || teacherData.email,
        username: finalUpdate.username || teacherData.username
      };
      
      if (password) {
        userUpdate.passwordHash = await bcrypt.hash(password, 10);
      }

      await db.collection('users').doc(teacherData.userId).update(userUpdate);
    }

    // Invalidate caching scopes
    if (teacherData.userId) {
      clearTeacherProfileCache(teacherData.userId);
    }
    clearSchoolCollectionCache(req.user.schoolId, 'teachers');
    dashboardStatsCache.delete(`${req.user.schoolId}:true`);
    dashboardStatsCache.delete(`${req.user.schoolId}:false`);

    res.json({ message: 'Teacher updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sync Teacher deletions with Users collection
teacherRouter.delete('/:id', authenticate, authorize(['SCHOOL_ADMIN']), async (req, res) => {
  try {
    const docRef = db.collection('teachers').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'Teacher profile not found' });
    const teacherData = doc.data();

    if (teacherData.schoolId !== req.user?.schoolId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Delete Teacher Profile
    await docRef.delete();

    // Delete User Document
    if (teacherData.userId) {
      await db.collection('users').doc(teacherData.userId).delete();
    }

    // Clean up DM chat document
    try {
      const dmChatId = `dm_${req.user.schoolId}_${teacherData.userId}`;
      await db.collection('chats').doc(dmChatId).delete();
    } catch (dmErr) {
      console.error('Failed to delete teacher DM chat:', dmErr);
    }

    // Automatically clean up chats
    try {
      await removeTeacherChats(teacherData.schoolId, req.params.id);
    } catch (chatErr) {
      console.error('Failed to auto-cleanup teacher chats in Firestore:', chatErr);
    }

    // Invalidate caching scopes
    if (teacherData.userId) {
      clearTeacherProfileCache(teacherData.userId);
    }
    clearSchoolCollectionCache(req.user.schoolId, 'teachers');
    dashboardStatsCache.delete(`${req.user.schoolId}:true`);
    dashboardStatsCache.delete(`${req.user.schoolId}:false`);

    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.use('/teachers', teacherRouter);
router.use('/classes', createCRUD('classes', ['SCHOOL_ADMIN']));

// Specialized Bulk Subject Creation
router.post('/subjects/bulk', authenticate, authorize(['SCHOOL_ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { subjects, schoolId, level, class: className, stream } = req.body;
    if (!subjects || !Array.isArray(subjects)) {
      return res.status(400).json({ message: 'Subjects array is required' });
    }

    const targetSchoolId = req.user.role === 'SUPER_ADMIN' ? (schoolId || req.user.schoolId) : req.user.schoolId;

    // 1. Fetch current subjects to prevent duplicates
    const currentSnap = await db.collection('subjects')
      .where('schoolId', '==', targetSchoolId)
      .where('level', '==', level)
      .where('class', '==', className)
      .where('stream', '==', stream || 'GENERAL')
      .get();
    
    const existingNames = new Set(currentSnap.docs.map(doc => doc.data().name.toLowerCase().trim()));
    
    // 2. Filter new subjects
    const newSubjects = subjects.filter(name => !existingNames.has(name.toLowerCase().trim()));
    
    if (newSubjects.length === 0) {
      return res.json({ 
        message: 'No new subjects to add', 
        addedCount: 0, 
        skippedCount: subjects.length 
      });
    }

    // 3. Batch Create
    const batch = db.batch();
    const createdDocs = [];

    newSubjects.forEach(name => {
      const ref = db.collection('subjects').doc();
      const subjectData = {
        name: name.trim(),
        schoolId: targetSchoolId,
        level,
        class: className,
        stream: stream || 'GENERAL',
        createdAt: new Date().toISOString()
      };
      batch.set(ref, subjectData);
      createdDocs.push({ id: ref.id, ...subjectData });
    });

    await batch.commit();

    // Log activity
    await logActivity(req, 'BULK_CREATE_SUBJECTS', `School Admin added ${newSubjects.length} subjects to ${className} (${level})`, targetSchoolId);

    res.status(201).json({
      message: `${newSubjects.length} subjects added successfully`,
      addedCount: newSubjects.length,
      skippedCount: subjects.length - newSubjects.length,
      data: createdDocs
    });
  } catch (err) {
    console.error('Bulk subject creation failed:', err);
    res.status(500).json({ message: err.message });
  }
});

router.use('/subjects', createCRUD('subjects', ['SCHOOL_ADMIN', 'SUPER_ADMIN']));

// Support Tickets
router.use('/tickets', createCRUD('tickets', ['SUPER_ADMIN', 'SCHOOL_ADMIN']));

// Announcement routes...
router.use('/announcements', createCRUD('announcements', ['SUPER_ADMIN']));

// --- Subscription Management ---

// Super Admin: Subscription Analytics
router.get('/subscriptions/stats', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const schoolsSnap = await db.collection('schools').get();
    const schools = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
      totalSchools: schools.length,
      activeSubscriptions: schools.filter(s => s.subscriptionStatus === 'ACTIVE').length,
       expiredSubscriptions: schools.filter(s => s.subscriptionStatus === 'EXPIRED').length,
       totalRevenue: schools.reduce((sum, s) => sum + (Number(s.subscriptionAmount) || 0), 0),
       byPlan: {
          BASIC: schools.filter(s => s.plan === 'BASIC').length,
          PRO: schools.filter(s => s.plan === 'PRO').length,
          PREMIUM: schools.filter(s => s.plan === 'PREMIUM').length,
          ENTERPRISE: schools.filter(s => s.plan === 'ENTERPRISE').length,
       }
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// School Admin: Get my subscription details
router.get('/subscriptions/my', authenticate, authorize(['SCHOOL_ADMIN']), async (req, res) => {
  try {
    const schoolDoc = await db.collection('schools').doc(req.user.schoolId).get();
    if (!schoolDoc.exists) return res.status(404).json({ message: 'School profile not found' });
    
    const data = schoolDoc.data();
    res.json({
      plan: data.plan || 'BASIC',
      status: data.subscriptionStatus || 'PENDING',
      amount: data.subscriptionAmount || 0,
      startDate: data.subscriptionStartDate,
      endDate: data.subscriptionEndDate,
      lastPaymentDate: data.lastPaymentDate
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Chats Migration & Advanced Group Management Controls ---

// 1. POST /v1/chats/migrate
const migrateChatsHandler = async (req, res) => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden - Super Admins only' });
    }

    let schoolsProcessed = 0;
    let dmsCreated = 0;
    let groupsCreated = 0;

    const schoolsSnap = await db.collection('schools').get();
    for (const schoolDoc of schoolsSnap.docs) {
      const schoolId = schoolDoc.id;
      schoolsProcessed++;

      // a. Find the school admin user (role === SCHOOL_ADMIN, schoolId matches)
      const adminSnap = await db.collection('users')
        .where('schoolId', '==', schoolId)
        .where('role', '==', 'SCHOOL_ADMIN')
        .limit(1)
        .get();

      if (adminSnap.empty) {
        continue;
      }

      const adminDoc = adminSnap.docs[0];
      const adminId = adminDoc.id;
      const adminName = adminDoc.data().name || 'School Admin';

      // b. Find all teachers (schoolId matches in teachers collection)
      const teachersSnap = await db.collection('teachers')
        .where('schoolId', '==', schoolId)
        .get();

      const teachers = [];
      teachersSnap.forEach(doc => {
        teachers.push({ id: doc.id, name: doc.data().name });
      });

      const teacherIds = teachers.map(t => t.id);

      // Check if group of school already exists, if not, it will be created
      const groupId = `group_${schoolId}`;
      const groupRef = db.collection('chats').doc(groupId);
      const groupSnap = await groupRef.get();
      if (!groupSnap.exists) {
        groupsCreated++;
      }

      // c. Call createTeacherChats for each teacher (checks existence first to avoid duplicates)
      for (const teacher of teachers) {
        const dmId = `dm_${schoolId}_${teacher.id}`;
        const dmRef = db.collection('chats').doc(dmId);
        const dmSnap = await dmRef.get();
        if (!dmSnap.exists) {
          dmsCreated++;
        }

        await createTeacherChats(schoolId, teacher.id, teacher.name, adminId, adminName);
      }

      // d. Ensure group document has ALL teachers in memberIds (use arrayUnion)
      if (teacherIds.length > 0) {
        const groupRefLatest = db.collection('chats').doc(groupId);
        const groupSnapLatest = await groupRefLatest.get();
        if (groupSnapLatest.exists) {
          const currentMembers = groupSnapLatest.data().memberIds || [];
          const missingMembers = teacherIds.filter(id => !currentMembers.includes(id));
          if (missingMembers.length > 0) {
            await groupRefLatest.update({
              memberIds: admin.firestore.FieldValue.arrayUnion(...missingMembers),
              memberCount: admin.firestore.FieldValue.increment(missingMembers.length),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }

    res.json({ schoolsProcessed, dmsCreated, groupsCreated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.post('/chats/migrate', authenticate, migrateChatsHandler);
router.post('/v1/chats/migrate', authenticate, migrateChatsHandler);


// 2. PATCH /v1/chats/group/:schoolId/toggle-open
const toggleGroupOpenHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (req.user?.role !== 'SCHOOL_ADMIN' || req.user?.schoolId !== schoolId) {
      return res.status(403).json({ message: 'Forbidden - School Admin of this school only' });
    }

    const groupId = `group_${schoolId}`;
    const groupRef = db.collection('chats').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const currentIsOpen = groupSnap.data().isOpen === true;
    const newValue = !currentIsOpen;

    await groupRef.update({
      isOpen: newValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ isOpen: newValue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.patch('/chats/group/:schoolId/toggle-open', authenticate, toggleGroupOpenHandler);
router.patch('/v1/chats/group/:schoolId/toggle-open', authenticate, toggleGroupOpenHandler);


// 3. PATCH /v1/chats/group/:schoolId/remove-member
const removeGroupMemberHandler = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({ message: 'Missing teacherId in request body' });
    }

    if (req.user?.role !== 'SCHOOL_ADMIN' || req.user?.schoolId !== schoolId) {
      return res.status(403).json({ message: 'Forbidden - School Admin of this school only' });
    }

    const groupId = `group_${schoolId}`;
    const groupRef = db.collection('chats').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const groupData = groupSnap.data();
    const currentMembers = groupData.memberIds || [];

    if (currentMembers.includes(teacherId)) {
      await groupRef.update({
        memberIds: admin.firestore.FieldValue.arrayRemove(teacherId),
        memberCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.patch('/chats/group/:schoolId/remove-member', authenticate, removeGroupMemberHandler);
router.patch('/v1/chats/group/:schoolId/remove-member', authenticate, removeGroupMemberHandler);


// --- Fetch My Chats Endpoint ---
const getMyChatsHandler = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (role === 'SUPER_ADMIN') {
      const snap = await db.collection('chats').orderBy('updatedAt', 'desc').limit(100).get();
      const chats = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!doc.id.startsWith('group_') && !doc.id.startsWith('dm_')) {
          chats.push({ id: doc.id, ...data });
        }
      });
      if (chats.length === 0) {
        return res.status(404).json({ message: 'No chats found' });
      }
      return res.json(chats);
    }

    if (role === 'SCHOOL_ADMIN') {
      const schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({ message: 'Missing schoolId for School Admin' });
      }

      const groupPromise = db.collection('chats').doc(`group_${schoolId}`).get();
      const dmsPromise = db.collection('chats')
        .where('type', '==', 'dm')
        .where('schoolId', '==', schoolId)
        .get();
      const supportPromise = db.collection('chats').doc(schoolId).get();

      const [groupSnap, dmsSnap, supportSnap] = await Promise.all([
        groupPromise,
        dmsPromise,
        supportPromise
      ]);

      const group = groupSnap.exists ? { id: groupSnap.id, ...groupSnap.data() } : null;
      const dms = dmsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const support = supportSnap.exists ? { id: supportSnap.id, ...supportSnap.data() } : null;

      if (!group && dms.length === 0 && !support) {
        return res.status(404).json({ message: 'No chats found' });
      }

      return res.json({ group, dms, support });
    }

    if (role === 'TEACHER') {
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      if (!schoolId || !userId) {
        return res.status(400).json({ message: 'Missing schoolId or userId for Teacher' });
      }

      const teacherProfile = await getCachedTeacherProfile(userId);
      const teacherId = teacherProfile?.id || userId;

      const groupPromise = db.collection('chats').doc(`group_${schoolId}`).get();
      const dmPromiseWithUserId = db.collection('chats').doc(`dm_${schoolId}_${userId}`).get();
      const dmPromiseWithTeacherId = teacherProfile?.id 
        ? db.collection('chats').doc(`dm_${schoolId}_${teacherId}`).get() 
        : Promise.resolve(null);

      const [groupSnap, dmSnapUser, dmSnapTeacher] = await Promise.all([
        groupPromise,
        dmPromiseWithUserId,
        dmPromiseWithTeacherId
      ]);

      let group = null;
      if (groupSnap.exists) {
        const groupData = groupSnap.data();
        const memberIds = groupData.memberIds || [];
        if (memberIds.includes(userId) || (teacherId && memberIds.includes(teacherId))) {
          group = { id: groupSnap.id, ...groupData };
        }
      }

      let dm = null;
      if (dmSnapUser && dmSnapUser.exists) {
        dm = { id: dmSnapUser.id, ...dmSnapUser.data() };
      } else if (dmSnapTeacher && dmSnapTeacher.exists) {
        dm = { id: dmSnapTeacher.id, ...dmSnapTeacher.data() };
      }

      if (!group && !dm) {
        return res.status(404).json({ message: 'No chats found' });
      }

      return res.json({ group, dm });
    }

    return res.status(400).json({ message: 'Invalid or unsupported user role' });
  } catch (err) {
    console.error('Error fetching chats:', err);
    return res.status(500).json({ message: err.message });
  }
};

router.get('/chats/my-chats', authenticate, getMyChatsHandler);
router.get('/v1/chats/my-chats', authenticate, getMyChatsHandler);

const backfillSchoolChatsHandler = async (req, res) => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden - Super Admins only' });
    }

    let schoolsChecked = 0;
    let supportChatsCreated = 0;
    let groupChatsCreated = 0;

    const schoolsSnap = await db.collection('schools').get();
    for (const schoolDoc of schoolsSnap.docs) {
      const schoolId = schoolDoc.id;
      const schoolData = schoolDoc.data();
      schoolsChecked++;

      // Check support chat: chats/{schoolId}
      const supportRef = db.collection('chats').doc(schoolId);
      const supportSnap = await supportRef.get();
      if (!supportSnap.exists) {
        await supportRef.set({
          schoolId: schoolId,
          schoolName: schoolData.name || 'Unknown School',
          type: 'support',
          lastMessage: '',
          unreadCount: 0,
          unreadCountAdmin: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        supportChatsCreated++;
      }

      // Check group chat: chats/group_{schoolId}
      const groupRef = db.collection('chats').doc(`group_${schoolId}`);
      const groupSnap = await groupRef.get();
      if (!groupSnap.exists) {
        await groupRef.set({
          schoolId: schoolId,
          name: `${schoolData.name || 'Unknown School'} Staff`,
          type: 'group',
          isOpen: true,
          memberIds: [],
          memberCount: 0,
          lastMessage: '',
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        groupChatsCreated++;
      }
    }

    return res.json({
      message: 'Backfill completed',
      schoolsChecked,
      supportChatsCreated,
      groupChatsCreated,
    });
  } catch (err) {
    console.error('Failed to backfill school chats:', err);
    return res.status(500).json({ message: err.message });
  }
};

router.post('/chats/backfill-school-chats', authenticate, authorize(['SUPER_ADMIN']), backfillSchoolChatsHandler);
router.post('/v1/chats/backfill-school-chats', authenticate, authorize(['SUPER_ADMIN']), backfillSchoolChatsHandler);


// --- Private Messaging System (Super Admin <-> School Admin) ---

// Get list of active conversations
router.get('/chats', authenticate, async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - Admins only' });
    }

    let query = db.collection('chats');
    
    if (req.user.role === 'SUPER_ADMIN') {
      // Super Admin sees all chats
    } else if (req.user.role === 'SCHOOL_ADMIN') {
      // School Admin only sees their chat with Super Admin
      query = query.where('schoolId', '==', req.user.schoolId);
    }

    const snap = await query.orderBy('updatedAt', 'desc').get();
    const chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get messages for a chat
router.get('/chats/:chatId/messages', authenticate, async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - Admins only' });
    }

    const chatId = req.params.chatId;
    if (req.user.role !== 'SUPER_ADMIN' && chatId !== req.user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) return res.status(404).json({ message: 'Chat not found' });
    const chatData = chatDoc.data();
    
    if (req.user.role !== 'SUPER_ADMIN' && chatData.schoolId !== req.user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const messagesSnap = await db.collection('chats').doc(chatId).collection('messages')
      .orderBy('createdAt', 'asc').limit(100).get();
    
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send message
router.post('/chats/:chatId/messages', authenticate, async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - Admins only' });
    }

    const chatId = req.params.chatId;
    if (req.user.role !== 'SUPER_ADMIN' && chatId !== req.user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const chatDoc = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      // Auto-create chat metadata if first message
      let schoolName = 'Support Chat';
      if (chatId !== 'SUPER') {
        const sDoc = await db.collection('schools').doc(chatId).get();
        if (sDoc.exists) {
          schoolName = sDoc.data().name;
        }
      }
      await db.collection('chats').doc(chatId).set({
        schoolId: chatId,
        schoolName: schoolName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0
      });
    }

    const messageData = {
      text: req.body.text || '',
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      createdAt: new Date().toISOString()
    };

    const msgRef = await db.collection('chats').doc(chatId).collection('messages').add(messageData);
    
    // Update chat metadata
    await db.collection('chats').doc(chatId).set({
      lastMessage: req.body.text || '',
      lastSenderId: req.user.id,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Trigger message notifications in fire-and-forget fashion
    (async () => {
      try {
        if (req.user.role === 'SUPER_ADMIN') {
          const schoolAdminsSnap = await db.collection('users')
            .where('schoolId', '==', chatId)
            .where('role', '==', 'SCHOOL_ADMIN')
            .get();
          schoolAdminsSnap.forEach(docObj => {
            createNotification({
              recipientId: docObj.id,
              recipientRole: 'SCHOOL_ADMIN',
              schoolId: chatId,
              title: '💬 Message from EduNexus Support',
              message: 'You have a new message from the EduNexus support team. Tap to read and reply.',
              type: 'message'
            });
          });
        } else if (req.user.role === 'SCHOOL_ADMIN') {
          const superAdminsSnap = await db.collection('users')
            .where('role', '==', 'SUPER_ADMIN')
            .get();
          superAdminsSnap.forEach(docObj => {
            createNotification({
              recipientId: docObj.id,
              recipientRole: 'SUPER_ADMIN',
              schoolId: 'SUPER',
              title: `💬 New Message from ${req.user.schoolName || 'Your School'}`,
              message: `${req.user.name} sent you a message. Tap to read and reply.`,
              type: 'message'
            });
          });
        }
      } catch (err) {
        console.error('Failed to trigger message notifications:', err);
      }
    })();

    res.status(201).json({ id: msgRef.id, ...messageData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Trigger chat notifications
router.post('/chats/:chatId/notify', authenticate, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    if (req.user.role === 'SUPER_ADMIN') {
      const schoolAdminsSnap = await db.collection('users')
        .where('schoolId', '==', chatId)
        .where('role', '==', 'SCHOOL_ADMIN')
        .get();
      schoolAdminsSnap.forEach(docObj => {
        createNotification({
          recipientId: docObj.id,
          recipientRole: 'SCHOOL_ADMIN',
          schoolId: chatId,
          title: '💬 Message from EduNexus Support',
          message: 'You have a new message from the EduNexus support team. Tap to read and reply.',
          type: 'message'
        });
      });
    } else if (req.user.role === 'SCHOOL_ADMIN') {
      const superAdminsSnap = await db.collection('users')
        .where('role', '==', 'SUPER_ADMIN')
        .get();
      superAdminsSnap.forEach(docObj => {
        createNotification({
          recipientId: docObj.id,
          recipientRole: 'SUPER_ADMIN',
          schoolId: 'SUPER',
          title: `💬 New Message from ${req.user.schoolName || 'Your School'}`,
          message: `${req.user.name} sent you a message. Tap to read and reply.`,
          type: 'message'
        });
      });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Log Chat System Activity
router.post('/chats/log-activity', authenticate, async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden - Admins only' });
    }
    const { action, details, schoolId } = req.body;
    await logActivity(req, action, details, schoolId);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Platform Settings (Super Admin only)
router.get('/platform-settings', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const snap = await db.collection('platform-settings').doc('global').get();
    if (!snap.exists) {
      return res.json({
        platformName: 'EduNexus',
        platformLogo: '',
        maintenanceMode: false,
        registrationEnabled: true,
        supportEmail: 'support@edunexus.com'
      });
    }
    res.json(snap.data());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/platform-settings', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const data = {
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    await db.collection('platform-settings').doc('global').set(data, { merge: true });
    res.json({ message: 'Settings updated successfully', data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Customized Results route for Status workflow
const resultsRouter = createCRUD('results', ['SCHOOL_ADMIN', 'TEACHER'], resultTransform, { skipPost: true, skipPut: true });

// POST Results - Only Teachers can create
resultsRouter.post('/', authenticate, authorize(['TEACHER']), async (req, res) => {
  try {
    const data = {
      ...req.body,
      schoolId: req.user.schoolId,
      status: req.body.status || 'DRAFT',
      teacherId: req.user.id,
      teacherName: req.user.name,
      createdAt: new Date().toISOString()
    };

    // Teacher assignment check
    const teacherProfile = await getCachedTeacherProfile(req.user.id);
    if (!teacherProfile) {
      return res.status(403).json({ message: 'Teacher profile not found' });
    }
    const tData = teacherProfile;
    
    // Secure subject check resolving subjectName
    let subjectName = data.subjectName;
    if (!subjectName && data.subjectId) {
      const subDoc = await db.collection('subjects').doc(data.subjectId).get();
      if (subDoc.exists) {
        subjectName = subDoc.data().name;
      }
    }

    const isSubjectTeacher = !tData.roleType || tData.roleType === 'SUBJECT' || tData.roleType === 'BOTH';
    if (!isSubjectTeacher) {
      return res.status(403).json({ message: 'Only Subject Teachers can upload results' });
    }

    const sAssignments = tData.subjectAssignments || [];
    if (sAssignments.length > 0) {
      const match = sAssignments.find(sa => sa.classId === data.classId && sa.subjectName === subjectName);
      if (!match) {
        return res.status(403).json({ message: 'You are not assigned to teach this subject in this class' });
      }
    } else {
      if (!tData.assignedClassIds?.includes(data.classId)) {
        return res.status(403).json({ message: 'Not assigned to this class' });
      }
      if (!tData.assignedSubjectIds?.includes(subjectName)) {
        return res.status(403).json({ message: 'Not assigned to this subject' });
      }
    }

    const transformed = resultTransform(data);
    const ref = await db.collection('results').add(transformed);
    
    await logActivity(req, 'CREATE_RESULT', `Teacher uploaded result for student ${data.studentId} in ${subjectName}`, req.user.schoolId);

    // Trigger result submitted notifications in fire-and-forget fashion
    (async () => {
      try {
        const adminsSnap = await db.collection('users')
          .where('schoolId', '==', req.user.schoolId)
          .where('role', '==', 'SCHOOL_ADMIN')
          .get();
        adminsSnap.forEach(aDoc => {
          createNotification({
            recipientId: aDoc.id,
            recipientRole: 'SCHOOL_ADMIN',
            schoolId: req.user.schoolId,
            title: '📋 Results Submitted for Review',
            message: `${req.user.name || 'A teacher'} has submitted ${req.body.subjectId ? `${req.body.subjectId} results` : 'results'} for ${req.body.classId || 'a class'}. Tap to review.`,
            type: 'result',
            metadata: {
              classId: data.classId,
              sessionId: data.sessionId,
              subjectId: data.subjectId,
              term: data.term,
            }
          });
        });
      } catch (err) {
        console.error('Failed to trigger result submitted notification:', err);
      }
    })();

    res.status(201).json({ id: ref.id, ...transformed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT Results - Teachers edit DRAFT/REJECTED, Admins APPROVE
resultsRouter.put('/:id', authenticate, authorize(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const docRef = db.collection('results').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'Result not found' });
    const existing = doc.data();

    if (existing.schoolId !== req.user.schoolId) return res.status(403).json({ message: 'Forbidden' });

    let updateData = { ...req.body, updatedAt: new Date().toISOString() };

    if (req.user.role === 'TEACHER') {
      const teacherProfile = await getCachedTeacherProfile(req.user.id);
      if (!teacherProfile) {
        return res.status(403).json({ message: 'Teacher profile not found' });
      }
      const tData = teacherProfile;
      const isSubjectTeacher = !tData.roleType || tData.roleType === 'SUBJECT' || tData.roleType === 'BOTH';
      if (!isSubjectTeacher) {
        return res.status(403).json({ message: 'Only Subject Teachers can edit results' });
      }

      const sAssignments = tData.subjectAssignments || [];
      if (sAssignments.length > 0) {
        const match = sAssignments.find(sa => sa.classId === existing.classId && sa.subjectName === existing.subjectName);
        if (!match) {
          return res.status(403).json({ message: 'You are not assigned to teach this subject in this class' });
        }
      } else {
        if (!tData.assignedClassIds?.includes(existing.classId)) {
          return res.status(403).json({ message: 'Not assigned to this class' });
        }
        if (!tData.assignedSubjectIds?.includes(existing.subjectName)) {
          return res.status(403).json({ message: 'Not assigned to this subject' });
        }
      }

      // Cannot edit Approved results
      if (existing.status === 'APPROVED') {
        return res.status(403).json({ message: 'Cannot edit approved results' });
      }
      // Cannot set to Approved
      if (updateData.status === 'APPROVED') {
        delete updateData.status; 
      }
      updateData = resultTransform({ ...existing, ...updateData });
    } else if (req.user.role === 'SCHOOL_ADMIN') {
      // Admins should only touch status and adminRemark
      const adminOnly = {
        status: updateData.status,
        adminRemark: updateData.adminRemark,
        updatedAt: updateData.updatedAt
      };
      updateData = adminOnly;
    }

    await docRef.update(updateData);
    
    await logActivity(req, 'UPDATE_RESULT', `${req.user.role === 'TEACHER' ? 'Teacher' : 'School Admin'} updated result ID: ${req.params.id} (Status: ${updateData.status || existing.status})`, req.user.schoolId);

    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.use('/results', resultsRouter);

router.use('/sessions', createCRUD('sessions', ['SCHOOL_ADMIN']));

router.post('/attendance/bulk-save', authenticate, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided' });
    }

    const schoolId = req.user.schoolId;
    const batch = db.batch();

    records.forEach(record => {
      // Use studentId + classId + date as document ID to prevent duplicates
      const docId = `${record.studentId}_${record.classId}_${record.date}`;
      const ref = db.collection('attendance').doc(docId);
      batch.set(ref, {
        studentId: record.studentId,
        studentName: record.studentName || '',
        classId: record.classId,
        className: record.className || '',
        schoolId: schoolId,
        date: record.date, // always a string like '2026-06-29'
        status: record.status || 'PRESENT',
        recordedBy: req.user.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    res.json({ success: true, count: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's class attendance summary for admin
router.get('/attendance/daily-summary', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const classesSnap = await db.collection('classes')
      .where('schoolId', '==', schoolId).get();

    // Fetch all teachers for this school and map classId → teacher name
    const teachersSnap = await db.collection('teachers')
      .where('schoolId', '==', schoolId)
      .get();

    const classTeacherMap = {};
    teachersSnap.docs.forEach(doc => {
      const t = doc.data();
      // Only class teachers and BOTH role types
      if (t.roleType === 'CLASS' || t.roleType === 'BOTH' || !t.roleType) {
        const assignedClasses = t.assignedClassIds || t.classAssignments || [];
        assignedClasses.forEach(classId => {
          classTeacherMap[classId] = t.name || t.fullName || 'Unknown Teacher';
        });
      }
    });

    const summary = await Promise.all(classesSnap.docs.map(async (classDoc) => {
      const classData = classDoc.data();
      const attendanceSnap = await db.collection('attendance')
        .where('schoolId', '==', schoolId)
        .where('classId', '==', classDoc.id)
        .where('date', '==', date)
        .get();

      const records = attendanceSnap.docs.map(d => d.data());
      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const excused = records.filter(r => r.status === 'EXCUSED').length;
      const total = records.length;

      return {
        classId: classDoc.id,
        className: classData.name,
        teacherName: classTeacherMap[classDoc.id] || classData.teacherName || 'Unassigned',
        total,
        present,
        absent,
        late,
        excused,
        submitted: total > 0,
      };
    }));

    const submitted = summary.filter(s => s.submitted).length;
    const total = summary.length;

    // Sort summary by school level order before returning
    const levelOrder = ['CRECHE', 'KINDERGARTEN', 'NURSERY', 'PRIMARY', 'JSS', 'SSS'];
    const getLevel = (name) => {
      const n = (name || '').toUpperCase();
      if (n.includes('CRECHE')) return 'CRECHE';
      if (n.includes('KINDERGARTEN') || n.includes('KG')) return 'KINDERGARTEN';
      if (n.includes('NURSERY')) return 'NURSERY';
      if (n.includes('PRIMARY')) return 'PRIMARY';
      if (n.includes('JSS') || n.includes('JUNIOR')) return 'JSS';
      if (n.includes('SSS') || n.includes('SENIOR') || n.includes('SS')) return 'SSS';
      return 'ZZZ';
    };

    summary.sort((a, b) => {
      const levelDiff = levelOrder.indexOf(getLevel(a.className)) - levelOrder.indexOf(getLevel(b.className));
      if (levelDiff !== 0) return levelDiff;
      return a.className.localeCompare(b.className);
    });

    res.json({ summary, submitted, total, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance history for a specific class and date (in-memory sort to prevent missing composite index errors)
router.get('/attendance/history', authenticate, async (req, res) => {
  try {
    const { classId, date } = req.query;
    const schoolId = req.user.schoolId;

    let q = db.collection('attendance')
      .where('schoolId', '==', schoolId);

    if (classId) q = q.where('classId', '==', classId);
    if (date) q = q.where('date', '==', date);

    const snap = await q.get();
    let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pre-fetch all students and classes for this school to map names
    const [studentsSnap, classesSnap] = await Promise.all([
      db.collection('students').where('schoolId', '==', schoolId).get(),
      db.collection('classes').where('schoolId', '==', schoolId).get()
    ]);

    const studentMap = {};
    studentsSnap.docs.forEach(doc => {
      const data = doc.data();
      studentMap[doc.id] = {
        name: data.name,
        admissionNumber: data.admissionNumber,
        avatarUrl: data.avatarUrl || ''
      };
    });

    const classMap = {};
    classesSnap.docs.forEach(doc => {
      classMap[doc.id] = doc.data().name;
    });

    // Populate records with names
    records = records.map(r => ({
      ...r,
      studentName: studentMap[r.studentId]?.name || 'Unknown Student',
      avatarUrl: studentMap[r.studentId]?.avatarUrl || '',
      admissionNumber: studentMap[r.studentId]?.admissionNumber || '',
      className: classMap[r.classId] || 'Unknown Class'
    }));

    // Enrich records with student names and avatars if still missing
    const enrichedRecords = await Promise.all(records.map(async (record) => {
      if (record.studentName && record.studentName !== 'Unknown Student') return record;
      // studentName missing, fetch from students collection
      try {
        const studentDoc = await db.collection('students').doc(record.studentId).get();
        if (studentDoc.exists) {
          return { 
            ...record, 
            studentName: studentDoc.data().name || 'Unknown',
            avatarUrl: studentDoc.data().avatarUrl || ''
          };
        }
      } catch (e) {}
      return record;
    }));
    
    // In-memory sort to avoid index requirements in Firestore
    enrichedRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const limitedRecords = enrichedRecords.slice(0, 200);

    res.json({ records: limitedRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance - Teachers POST, Admins/Teachers GET
router.use('/attendance', createCRUD('attendance', ['SCHOOL_ADMIN', 'TEACHER']));
// GET /activity-logs with advanced filters, search, and strict role segregation
router.get('/activity-logs', authenticate, authorize(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req, res) => {
  try {
    let query = db.collection('activity-logs');

    if (req.user.role === 'SUPER_ADMIN') {
      if (req.query.schoolId) {
        query = query.where('schoolId', '==', req.query.schoolId);
      }
    } else if (req.user.role === 'SCHOOL_ADMIN') {
      query = query.where('schoolId', '==', req.user.schoolId);
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Sort by createdAt descending
    query = query.orderBy('createdAt', 'desc').limit(500);

    try {
      const snapshot = await query.get();
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Role-based segregation for Super Admin
      if (req.user.role === 'SUPER_ADMIN') {
        // Super Admin should ONLY see School Admin and Super Admin and System logs.
        // Super Admin should NOT see teacher-level operational logs directly!
        docs = docs.filter(doc => doc.role !== 'TEACHER');
      }

      // Filter by search term if provided
      if (req.query.search) {
        const searchStr = req.query.search.toLowerCase();
        docs = docs.filter(doc => 
          doc.details?.toLowerCase().includes(searchStr) ||
          doc.action?.toLowerCase().includes(searchStr) ||
          doc.userName?.toLowerCase().includes(searchStr) ||
          doc.role?.toLowerCase().includes(searchStr) ||
          doc.schoolName?.toLowerCase().includes(searchStr)
        );
      }

      // Filter by role if provided
      if (req.query.roleFilter) {
        docs = docs.filter(doc => doc.role === req.query.roleFilter);
      }

      // Filter by action if provided
      if (req.query.actionFilter) {
        docs = docs.filter(doc => doc.action === req.query.actionFilter);
      }

      res.json(docs);
    } catch (err) {
      if (err.message && err.message.includes('index')) {
        return res.status(500).json({
          message: 'Activity logs index is being built. Please try again in a few minutes.',
          indexRequired: true
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('Failed to retrieve activity-logs:', err);
    res.status(500).json({ message: err.message });
  }
});

// Enrollment trend stats
router.get('/enrollment-trend', authenticate, async (req, res) => {
  try {
    const schoolId = req.user?.role === 'SUPER_ADMIN' 
      ? req.query.schoolId 
      : req.user?.schoolId;

    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      let q = db.collection('students')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(end));

      if (schoolId) q = q.where('schoolId', '==', schoolId);

      const snap = await q.count().get();
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        value: snap.data().count
      });
    }

    res.json({ trend: months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats
router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    const schoolId = req.user?.role === 'SUPER_ADMIN' ? (req.query.schoolId || 'SUPER') : (req.user?.schoolId || 'NONE');
    const isSuper = req.user?.role === 'SUPER_ADMIN';
    const cacheKey = `${schoolId}:${isSuper}`;
    
    // Check Cache
    const now = Date.now();
    const cached = dashboardStatsCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return res.json(cached.data);
    }

    const getCount = async (coll) => {
      let q = db.collection(coll);
      const selectedSchoolId = isSuper ? req.query.schoolId : req.user?.schoolId;

      if (selectedSchoolId) {
        q = q.where('schoolId', '==', selectedSchoolId);
      }
      
      // Use count() aggregation for performance and cost efficiency
      const snap = await q.count().get();
      return snap.data().count;
    };

    const stats = {
      students: await getCount('students'),
      teachers: await getCount('teachers'),
      classes: await getCount('classes'),
      subjects: await getCount('subjects')
    };

    // For teachers, override student count to only show students in their assigned classes
    if (req.user?.role === 'TEACHER') {
      const teacherDoc = await db.collection('teachers')
        .where('userId', '==', req.user.id)
        .limit(1).get();

      const assignedClassIds = teacherDoc.empty
        ? []
        : (teacherDoc.docs[0].data().classAssignments ||
           teacherDoc.docs[0].data().assignedClassIds || []);

      if (assignedClassIds.length > 0) {
        const studentSnap = await db.collection('students')
          .where('schoolId', '==', req.user.schoolId)
          .where('classId', 'in', assignedClassIds)
          .count().get();
        stats.students = studentSnap.data().count;
      } else {
        stats.students = 0;
      }
    }

    if (isSuper) {
      const schoolsSnap = await db.collection('schools').get();
      const schools = schoolsSnap.docs.map(d => d.data());
      
      stats.schools = schools.length;
      stats.totalTeachers = stats.teachers;
      stats.totalStudents = stats.students;
      stats.activePlans = schools.filter(s => s.status === 'ACTIVE').length;
      
      // Calculate revenue
      stats.totalRevenue = schools.reduce((acc, s) => acc + (Number(s.amountPaid) || 0), 0);
    }

    // Save to Cache (keep for 15 seconds)
    dashboardStatsCache.set(cacheKey, { data: stats, expires: now + 15000 });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notifications routes
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('notifications')
      .where('recipientId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const list = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/notifications/mark-all-read', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('notifications')
      .where('recipientId', '==', req.user.id)
      .where('read', '==', false)
      .get();
    
    if (snapshot.empty) {
      return res.json({ success: true, count: 0 });
    }

    const batch = db.batch();
    snapshot.docs.forEach(docObj => {
      batch.update(docObj.ref, { read: true });
    });
    await batch.commit();

    res.json({ success: true, count: snapshot.size });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const docRef = db.collection('notifications').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    if (docSnap.data().recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    await docRef.update({ read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit results (subject teacher → class teacher, or class teacher → admin)
router.post('/results/submit', authenticate, async (req, res) => {
  try {
    const { classId, subjectId, scores, status } = req.body;
    const batch = db.batch();

    scores.forEach(({ studentId, ca, exam, total, grade }) => {
      const ref = db.collection('results').doc(`${studentId}_${subjectId}_${classId}`);
      batch.set(ref, {
        studentId, subjectId, classId,
        schoolId: req.user.schoolId,
        ca, exam, total, grade,
        status,
        submittedBy: req.user.id,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve results (school admin only)
router.post('/results/approve', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'SCHOOL_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { classId, subjectId } = req.body;
    const snap = await db.collection('results')
      .where('classId', '==', classId)
      .where('subjectId', '==', subjectId)
      .where('schoolId', '==', req.user.schoolId)
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { 
        status: 'APPROVED',
        approvedBy: req.user.id,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-collate scores for class teacher view
router.get('/results/collated', authenticate, async (req, res) => {
  try {
    const { classId } = req.query;
    const schoolId = req.user.schoolId;

    const snap = await db.collection('results')
      .where('classId', '==', classId)
      .where('schoolId', '==', schoolId)
      .where('status', 'in', ['PENDING_ADMIN', 'APPROVED'])
      .get();

    const collated = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (!collated[d.studentId]) {
        collated[d.studentId] = { studentId: d.studentId, subjects: [], totalScore: 0, subjectCount: 0 };
      }
      collated[d.studentId].subjects.push({
        subjectId: d.subjectId,
        ca: d.ca,
        exam: d.exam,
        total: d.total,
        grade: d.grade
      });
      collated[d.studentId].totalScore += d.total || 0;
      collated[d.studentId].subjectCount += 1;
    });

    Object.values(collated).forEach(student => {
      student.average = student.subjectCount > 0 
        ? (student.totalScore / student.subjectCount).toFixed(1) 
        : 0;
    });

    res.json({ collated: Object.values(collated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
