@echo off
start cmd /k "cd backend && npm install firebase-admin express cors bcryptjs jsonwebtoken && npm install multer && npm start"
timeout /t 3
start cmd /k "cd frontend && npm install && npm run dev"
