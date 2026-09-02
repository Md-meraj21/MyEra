# MyEra - Smart Classroom Attendance System

**MyEra** is a modern MERN Stack web application for automated, proxy-proof classroom attendance management using dynamic 120-second passcodes and high-precision 30-meter Haversine GPS geofencing.

---

## Key Features

### 1. Teacher Portal
- **Authentication**: JWT-based login and registration with encrypted passwords (bcryptjs).
- **Weekly Timetable**: Add, customize, and manage weekly class schedule across days (Monday–Saturday).
- **One-Click Session Launch**: Click on any lecture slot to start attendance with teacher's real-time GPS coordinates.
- **Dynamic 4-Digit Passcode**: Auto-generated cryptographic code that expires strictly in 2 minutes (120 seconds).
- **Live Attendance Dashboard**: Real-time polling showing who has marked present and who is pending.
- **Excel Spreadsheet (.xlsx) Export**: SheetJS export with Roll No, Name, Timestamp, Status, and calculated summary metrics (Present, Absent, Turnout %).
- **Past Session History**: Comprehensive archive of all past lectures with historical Excel downloads.

### 2. Student Portal
- **Authentication**: Student login and registration with Roll Number, Class, and Section.
- **GPS-Verified Check-in**: Enter the teacher's 4-digit code. The system checks device coordinates via the **Haversine formula** to verify that the student is within a **30-meter radius** of the teacher.
- **Color-Coded Attendance Progress Strips**:
  - **Green ($\ge 75\%$)**: Regular (Healthy attendance status)
  - **Yellow ($50-74\%$)**: Needs Improvement (Warning status)
  - **Red ($< 50\%$)**: Irregular (Critical shortage status)
- **Subject-Wise Breakdown**: Individual progress strips and class count metrics for each enrolled subject.
- **Attendance History Log**: Detailed table of every verified check-in.

---

## Technology Stack

- **Frontend**: React.js 18 (Vite), Tailwind CSS, Lucide Icons, Canvas Confetti, Axios, React Router v6.
- **Backend**: Node.js, Express.js, MongoDB, Mongoose, JSON Web Tokens (JWT), bcryptjs, `haversine-distance`, `xlsx` (SheetJS).

---

## Project Structure

```
MyEra/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── Teacher.js
│   │   │   ├── Student.js
│   │   │   └── Session.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── teacherRoutes.js
│   │   │   └── studentRoutes.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── teacherController.js
│   │   │   └── studentController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── utils/
│   │   │   ├── generateCode.js
│   │   │   └── locationCheck.js
│   │   └── server.js
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TeacherDashboard.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── AttendanceStrip.jsx
│   │   │   └── Timetable.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── TeacherPanel.jsx
│   │   │   └── StudentPanel.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
└── README.md
```

---

## Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
npm start
```
The backend will run on `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:3000`.

---

## API Documentation

### Auth Endpoints
- `POST /api/auth/register-teacher`: Register a new teacher
- `POST /api/auth/teacher-login`: Teacher login
- `POST /api/auth/register-student`: Register a new student
- `POST /api/auth/student-login`: Student login

### Teacher Endpoints
- `POST /api/teacher/timetable`: Add or update weekly timetable
- `GET /api/teacher/timetable/:id`: Get teacher timetable
- `POST /api/teacher/start-session`: Start 120s attendance session with GPS coords
- `GET /api/teacher/sessions/:id`: Get all sessions for a teacher
- `GET /api/teacher/session/:sessionId`: Get live session attendance details
- `GET /api/teacher/report/:id`: Aggregated attendance reports
- `GET /api/teacher/download/:id`: Download formatted Excel (.xlsx) file

### Student Endpoints
- `POST /api/student/mark-attendance`: Check in with 4-digit code + GPS
- `GET /api/student/strip/:id`: Get overall & subject-wise progress strips
- `GET /api/student/history/:id`: Get student attendance history log
