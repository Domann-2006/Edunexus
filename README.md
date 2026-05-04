# EduNexus - School Management System

A multi-tenant school management system built with React, Node.js (Express), and Firebase.

## Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file based on `.env.example`. Ensure `GEMINI_API_KEY` is set if using AI features.

3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

4. **Initial Setup**:
   Go to the login page and click "First time here?" to create your first Super Admin account.

## Hosting & Deployment

### 1. Build
```bash
npm run build
```
This generates optimized static files in the `dist` folder.

### 2. Server
The `server.ts` file is a unified entry point. In production, it serves the static files and handles API requests.
```bash
npm start
```

### 3. Firebase
- This app uses **Firestore** for data and **Firebase Auth** for user management.
- Ensure you have deployed `firestore.rules` to your Firebase project.
- Service account credentials should be configured in `firebase-applet-config.json` or via environment variables if modifying `src/lib/firebase-admin.ts`.

## Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion, Lucide Icons, Recharts.
- **Backend**: Node.js, Express, JWT, Bcrypt.
- **Database**: Google Cloud Firestore.
