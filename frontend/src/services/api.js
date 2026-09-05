import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL ? `${BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT Bearer Token if available in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('myera_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle unauthorized/expired token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/');
      if (!isLoginRequest) {
        localStorage.removeItem('myera_token');
        localStorage.removeItem('myera_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  teacherLogin: (data) => api.post('/auth/teacher-login', data),
  studentLogin: (data) => api.post('/auth/student-login', data),
  registerTeacher: (data) => api.post('/auth/register-teacher', data),
  registerStudent: (data) => api.post('/auth/register-student', data),
};

export const teacherAPI = {
  addTimetable: (data) => api.post('/teacher/timetable', data),
  getTimetable: (teacherId) => api.get(`/teacher/timetable/${teacherId}`),
  startSession: (data) => api.post('/teacher/start-session', data),
  extendSession: (data) => api.post('/teacher/extend-session', data),
  endSession: (data) => api.post('/teacher/end-session', data),
  getSessions: (teacherId) => api.get(`/teacher/sessions/${teacherId}`),
  getSessionDetails: (sessionId) => api.get(`/teacher/session/${sessionId}`),
  getReport: (teacherId) => api.get(`/teacher/report/${teacherId}`),
  getDownloadUrl: (id) => `${BASE_URL}/api/teacher/download/${id}`,
  downloadExcel: (id) => api.get(`/teacher/download/${id}`, { responseType: 'blob' }),
  downloadExcelBySubject: (teacherId, subject) => api.get(`/teacher/download/${teacherId}`, { params: { subject }, responseType: 'blob' }),
  deleteSession: (sessionId) => api.delete(`/teacher/session/${sessionId}`),
};

export const studentAPI = {
  markAttendance: (data) => api.post('/student/mark-attendance', data),
  getAttendanceStrip: (studentId) => api.get(`/student/strip/${studentId}`),
  getAttendanceHistory: (studentId) => api.get(`/student/history/${studentId}`),
};

export default api;
