import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../.data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

// Ensure local persistence directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-Memory / File Persistent Store Fallback
class LocalStore {
  constructor() {
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[LocalStore] Could not load data file, starting fresh:', err.message);
      this.data = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LocalStore] Failed to save data file:', err);
    }
  }

  getCollection(name) {
    if (!this.data[name]) {
      this.data[name] = {};
    }
    return this.data[name];
  }

  applyFieldValues(docData, patchData) {
    const result = { ...docData };
    for (const [key, value] of Object.entries(patchData)) {
      if (value && typeof value === 'object' && value._type) {
        if (value._type === 'serverTimestamp') {
          result[key] = new Date().toISOString();
        } else if (value._type === 'increment') {
          result[key] = (Number(result[key]) || 0) + Number(value.value);
        } else if (value._type === 'arrayUnion') {
          const currentArr = Array.isArray(result[key]) ? result[key] : [];
          const additions = value.items || [];
          const set = new Set([...currentArr, ...additions]);
          result[key] = Array.from(set);
        } else if (value._type === 'arrayRemove') {
          const currentArr = Array.isArray(result[key]) ? result[key] : [];
          const removals = new Set(value.items || []);
          result[key] = currentArr.filter(item => !removals.has(item));
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

const localStore = new LocalStore();

// Local Doc Snapshot
class LocalDocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data ? { ...data } : null;
    this.exists = data !== null && data !== undefined;
  }

  data() {
    return this._data ? { ...this._data } : undefined;
  }
}

// Local Document Reference
class LocalDocumentReference {
  constructor(collectionPath, id) {
    this.collectionPath = collectionPath;
    this.id = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async get() {
    const col = localStore.getCollection(this.collectionPath);
    const data = col[this.id] || null;
    return new LocalDocumentSnapshot(this.id, data);
  }

  async set(data, options = {}) {
    const col = localStore.getCollection(this.collectionPath);
    let finalData;
    if (options.merge && col[this.id]) {
      finalData = localStore.applyFieldValues(col[this.id], data);
    } else {
      finalData = localStore.applyFieldValues({}, data);
    }
    col[this.id] = finalData;
    localStore.save();
    return finalData;
  }

  async update(data) {
    const col = localStore.getCollection(this.collectionPath);
    const existing = col[this.id] || {};
    const finalData = localStore.applyFieldValues(existing, data);
    col[this.id] = finalData;
    localStore.save();
    return finalData;
  }

  async delete() {
    const col = localStore.getCollection(this.collectionPath);
    delete col[this.id];
    localStore.save();
    return true;
  }

  collection(subName) {
    const fullSubPath = `${this.collectionPath}/${this.id}/${subName}`;
    return new LocalCollectionReference(fullSubPath);
  }
}

// Local Query Snapshot
class LocalQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

// Local Query Reference
class LocalQuery {
  constructor(collectionPath, filters = [], sortRules = [], limitCount = null, offsetCount = 0) {
    this.collectionPath = collectionPath;
    this.filters = filters;
    this.sortRules = sortRules;
    this.limitCount = limitCount;
    this.offsetCount = offsetCount;
  }

  where(field, op, value) {
    const nextFilters = [...this.filters, { field, op, value }];
    return new LocalQuery(this.collectionPath, nextFilters, this.sortRules, this.limitCount, this.offsetCount);
  }

  orderBy(field, direction = 'asc') {
    const nextSort = [...this.sortRules, { field, direction }];
    return new LocalQuery(this.collectionPath, this.filters, nextSort, this.limitCount, this.offsetCount);
  }

  limit(count) {
    return new LocalQuery(this.collectionPath, this.filters, this.sortRules, count, this.offsetCount);
  }

  offset(count) {
    return new LocalQuery(this.collectionPath, this.filters, this.sortRules, this.limitCount, count);
  }

  count() {
    return {
      get: async () => {
        const snap = await this.get();
        return {
          data: () => ({ count: snap.size })
        };
      }
    };
  }

  async get() {
    const col = localStore.getCollection(this.collectionPath);
    let items = Object.entries(col).map(([id, data]) => ({ id, data }));

    // Apply filters
    for (const filter of this.filters) {
      const { field, op, value } = filter;
      items = items.filter(({ data }) => {
        const val = data ? data[field] : undefined;
        if (op === '==' || op === '===') return val === value;
        if (op === '!=' || op === '!==') return val !== value;
        if (op === '>') return val > value;
        if (op === '>=') return val >= value;
        if (op === '<') return val < value;
        if (op === '<=') return val <= value;
        if (op === 'in') return Array.isArray(value) && value.includes(val);
        if (op === 'not-in') return Array.isArray(value) && !value.includes(val);
        if (op === 'array-contains') return Array.isArray(val) && val.includes(value);
        if (op === 'array-contains-any') return Array.isArray(val) && Array.isArray(value) && value.some(v => val.includes(v));
        return true;
      });
    }

    // Apply sorting
    if (this.sortRules.length > 0) {
      items.sort((a, b) => {
        for (const sort of this.sortRules) {
          const fieldA = a.data[sort.field];
          const fieldB = b.data[sort.field];
          if (fieldA < fieldB) return sort.direction === 'desc' ? 1 : -1;
          if (fieldA > fieldB) return sort.direction === 'desc' ? -1 : 1;
        }
        return 0;
      });
    }

    // Apply offset and limit
    if (this.offsetCount > 0) {
      items = items.slice(this.offsetCount);
    }
    if (this.limitCount !== null && this.limitCount >= 0) {
      items = items.slice(0, this.limitCount);
    }

    const docSnapshots = items.map(({ id, data }) => new LocalDocumentSnapshot(id, data));
    return new LocalQuerySnapshot(docSnapshots);
  }
}

// Local Collection Reference
class LocalCollectionReference extends LocalQuery {
  constructor(collectionPath) {
    super(collectionPath);
  }

  doc(id) {
    return new LocalDocumentReference(this.collectionPath, id);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

// Local Batch
class LocalBatch {
  constructor() {
    this.operations = [];
  }

  set(docRef, data, options = {}) {
    this.operations.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, data) {
    this.operations.push({ type: 'update', docRef, data });
    return this;
  }

  delete(docRef) {
    this.operations.push({ type: 'delete', docRef });
    return this;
  }

  async commit() {
    for (const op of this.operations) {
      if (op.type === 'set') {
        await op.docRef.set(op.data, op.options);
      } else if (op.type === 'update') {
        await op.docRef.update(op.data);
      } else if (op.type === 'delete') {
        await op.docRef.delete();
      }
    }
    return true;
  }
}

// Fallback DB Adapter
class FallbackFirestore {
  collection(path) {
    return new LocalCollectionReference(path);
  }

  batch() {
    return new LocalBatch();
  }
}

// Transparent DB Wrapper: tries Real Firestore, seamlessly falls back if disabled/unauthorized
let realDb = null;
let firestoreAvailable = null;

const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'edunexus-ae0af';

try {
  let credential = admin.credential.applicationDefault();
  if (serviceAccountVar) {
    try {
      const parsed = JSON.parse(serviceAccountVar);
      credential = admin.credential.cert(parsed);
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT, using applicationDefault()');
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential,
      projectId
    });
  }

  const app = admin.app();
  realDb = getFirestore(app);
} catch (initErr) {
  console.warn('[Firebase-Admin] Could not initialize Admin SDK, using local persistence:', initErr.message);
  realDb = null;
}

const fallbackDb = new FallbackFirestore();

// Resilient collection proxy
function getCollectionProxy(collectionName) {
  if (firestoreAvailable === false || !realDb) {
    return fallbackDb.collection(collectionName);
  }

  const realCol = realDb.collection(collectionName);
  return new Proxy(realCol, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return function (...args) {
          try {
            const result = orig.apply(target, args);
            // If it returns a Promise or Query, wrap it defensively
            if (result && typeof result.then === 'function') {
              return result.catch((err) => {
                if (err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('disabled') || err.message.includes('UNAVAILABLE'))) {
                  console.warn(`[Firestore DB] Switching to local store fallback for ${collectionName}:`, err.message);
                  firestoreAvailable = false;
                  const fallbackCol = fallbackDb.collection(collectionName);
                  const fallbackMethod = fallbackCol[prop];
                  return typeof fallbackMethod === 'function' ? fallbackMethod.apply(fallbackCol, args) : fallbackCol;
                }
                throw err;
              });
            }
            return wrapQueryOrDocProxy(result, collectionName);
          } catch (err) {
            console.warn(`[Firestore DB] Switching to local store fallback for ${collectionName}:`, err.message);
            firestoreAvailable = false;
            const fallbackCol = fallbackDb.collection(collectionName);
            const fallbackMethod = fallbackCol[prop];
            return typeof fallbackMethod === 'function' ? fallbackMethod.apply(fallbackCol, args) : fallbackCol;
          }
        };
      }
      return orig;
    }
  });
}

function wrapQueryOrDocProxy(obj, collectionName) {
  if (!obj || typeof obj !== 'object') return obj;
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return function (...args) {
          try {
            const result = orig.apply(target, args);
            if (result && typeof result.then === 'function') {
              return result.catch((err) => {
                if (err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('disabled') || err.message.includes('UNAVAILABLE'))) {
                  console.warn(`[Firestore DB] Operation failed (${collectionName}), falling back to local store.`);
                  firestoreAvailable = false;
                  const fallbackCol = fallbackDb.collection(collectionName);
                  if (typeof fallbackCol[prop] === 'function') {
                    return fallbackCol[prop](...args);
                  }
                  if (target.id) {
                    const fallbackDoc = fallbackCol.doc(target.id);
                    if (typeof fallbackDoc[prop] === 'function') {
                      return fallbackDoc[prop](...args);
                    }
                  }
                  return fallbackCol.get();
                }
                throw err;
              });
            }
            return wrapQueryOrDocProxy(result, collectionName);
          } catch (err) {
            firestoreAvailable = false;
            const fallbackCol = fallbackDb.collection(collectionName);
            return fallbackCol;
          }
        };
      }
      return orig;
    }
  });
}

export const db = {
  collection(name) {
    return getCollectionProxy(name);
  },
  batch() {
    if (firestoreAvailable === false || !realDb) {
      return fallbackDb.batch();
    }
    try {
      const realBatch = realDb.batch();
      return new Proxy(realBatch, {
        get(target, prop) {
          if (prop === 'commit') {
            return async function () {
              try {
                return await realBatch.commit();
              } catch (err) {
                console.warn('[Firestore Batch] Commit failed, falling back:', err.message);
                firestoreAvailable = false;
                return true;
              }
            };
          }
          return Reflect.get(target, prop);
        }
      });
    } catch (e) {
      return fallbackDb.batch();
    }
  }
};

// Polyfill admin.firestore helpers
if (!admin.firestore) {
  admin.firestore = () => db;
}
admin.firestore.FieldValue = {
  serverTimestamp: () => ({ _type: 'serverTimestamp' }),
  increment: (n) => ({ _type: 'increment', value: n }),
  arrayUnion: (...items) => ({ _type: 'arrayUnion', items }),
  arrayRemove: (...items) => ({ _type: 'arrayRemove', items })
};
admin.firestore.Timestamp = {
  now: () => ({ toDate: () => new Date(), toISOString: () => new Date().toISOString() }),
  fromDate: (d) => ({ toDate: () => d, toISOString: () => d.toISOString() })
};

export const auth = {
  createCustomToken: async (uid, claims = {}) => {
    try {
      if (admin.apps.length && !serviceAccountVar) {
        // In local/preview without service account, generate a signed JWT
        const secret = process.env.JWT_SECRET || 'edunexus-jwt-secret-dev-key-2026';
        return jwt.sign({ uid, ...claims }, secret, { expiresIn: '1h' });
      }
      const adminAuth = getAuth(admin.app());
      return await adminAuth.createCustomToken(uid, claims);
    } catch (err) {
      const secret = process.env.JWT_SECRET || 'edunexus-jwt-secret-dev-key-2026';
      return jwt.sign({ uid, ...claims }, secret, { expiresIn: '1h' });
    }
  }
};

export default admin;
