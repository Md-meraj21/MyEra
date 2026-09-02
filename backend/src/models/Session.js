const mongoose = require('mongoose');

const sessionStudentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    default: 'present'
  }
});

const sessionSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Teacher ID is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Session code is required'],
    minlength: 4,
    maxlength: 4,
    index: true
  },
  teacherLocation: {
    lat: {
      type: Number,
      required: [true, 'Teacher latitude is required']
    },
    lng: {
      type: Number,
      required: [true, 'Teacher longitude is required']
    }
  },
  durationMinutes: {
    type: Number,
    default: 5
  },
  radius: {
    type: Number,
    default: 200 // Default 200 meters tolerance for reliable multi-device GPS / laptop Wi-Fi
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // Default 5 minutes
  },
  status: {
    type: String,
    enum: ['active', 'expired'],
    default: 'active',
    index: true
  },
  students: [sessionStudentSchema]
}, {
  timestamps: true
});

// Compound indexes for ultra-fast multi-teacher and multi-student lookups
sessionSchema.index({ code: 1, status: 1 });
sessionSchema.index({ teacherId: 1, status: 1 });
sessionSchema.index({ class: 1, section: 1, status: 1 });

// Method to verify whether the session has expired
sessionSchema.methods.isExpired = function () {
  return this.status === 'expired' || Date.now() > new Date(this.expiresAt).getTime();
};

module.exports = mongoose.model('Session', sessionSchema);
