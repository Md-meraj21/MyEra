import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  BookOpen, 
  Award, 
  CalendarClock,
  ChevronRight
} from 'lucide-react';

/**
 * Helper to compute color and metadata from attendance percentage
 */
export const getAttendanceColorInfo = (percentage, totalClasses = 1) => {
  const pct = Number(percentage) || 0;

  if (totalClasses === 0) {
    return {
      colorHex: '#0284c7',
      barColor: 'bg-sky-500',
      textColor: 'text-sky-700',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
      gradient: 'from-sky-400 to-blue-500',
      status: 'Upcoming',
      icon: CalendarClock,
      message: 'No sessions recorded yet for this subject.'
    };
  }

  if (pct >= 75) {
    return {
      colorHex: '#16a34a',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      gradient: 'from-emerald-500 to-green-600',
      status: 'Regular (75%+)',
      icon: CheckCircle2,
      message: 'Great job! You have healthy attendance.'
    };
  } else if (pct >= 50) {
    return {
      colorHex: '#d97706',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      gradient: 'from-amber-400 to-yellow-500',
      status: 'Warning (50-74%)',
      icon: AlertTriangle,
      message: 'Warning: Attend upcoming classes to maintain 75%+'
    };
  } else {
    return {
      colorHex: '#dc2626',
      barColor: 'bg-rose-500',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      gradient: 'from-rose-500 to-red-600',
      status: 'Critical (<50%)',
      icon: XCircle,
      message: 'Critical: Risk of attendance shortage'
    };
  }
};

const AttendanceStrip = ({ overall, subjectStrips = [], onSelectSubject }) => {
  const overallPct = overall ? overall.percentage : 0;
  const overallMeta = getAttendanceColorInfo(overallPct, overall?.totalSessions || 0);
  const StatusIcon = overallMeta.icon;

  return (
    <div className="space-y-5">
      {/* Overall Attendance Summary Card */}
      <div className="card-human rounded-3xl p-5 sm:p-7 relative overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-100/70 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Overall Attendance
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{overallMeta.message}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${overallMeta.badgeBg}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {overallMeta.status}
            </span>
            <span className={`text-2xl sm:text-3xl font-black ${overallMeta.textColor}`}>
              {overallPct}%
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3.5 bg-blue-100/60 rounded-full overflow-hidden p-0.5 border border-blue-200/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${overallMeta.gradient}`}
              style={{ width: `${Math.min(Math.max(overallPct, overall?.totalSessions > 0 ? 3 : 0), 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 pt-0.5">
            <span>0%</span>
            <span className="text-amber-600">50% Benchmark</span>
            <span className="text-emerald-600">75% Target</span>
            <span>100%</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-blue-50 text-center">
          <div className="bg-blue-50/60 p-2.5 sm:p-3 rounded-2xl border border-blue-100/60">
            <p className="text-[11px] text-slate-500 font-medium">Total Classes</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
              {overall?.totalSessions || 0}
            </p>
          </div>
          <div className="bg-emerald-50/70 p-2.5 sm:p-3 rounded-2xl border border-emerald-100/60">
            <p className="text-[11px] text-emerald-700 font-medium">Present</p>
            <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">
              {overall?.presentSessions || 0}
            </p>
          </div>
          <div className="bg-rose-50/70 p-2.5 sm:p-3 rounded-2xl border border-rose-100/60">
            <p className="text-[11px] text-rose-700 font-medium">Absent</p>
            <p className="text-base sm:text-lg font-bold text-rose-700 mt-0.5">
              {overall?.absentSessions || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Subject-Wise Attendance Portfolio */}
      <div className="card-human rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Enrolled Subjects ({subjectStrips.length})
            </h3>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
            All Subjects
          </span>
        </div>

        {subjectStrips.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No subjects registered yet.
          </div>
        ) : (
          <div className="space-y-3">
            {subjectStrips.map((item, idx) => {
              const meta = getAttendanceColorInfo(item.percentage, item.totalClasses);
              const SubIcon = meta.icon;

              return (
                <div
                  key={idx}
                  onClick={() => onSelectSubject && onSelectSubject(item.subject)}
                  className="p-3.5 sm:p-4 rounded-2xl border border-blue-100/80 bg-blue-50/30 hover:bg-blue-50/70 transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm shadow-blue-500/20">
                        {item.subject.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {item.subject}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {item.totalClasses > 0
                            ? `${item.presentClasses} of ${item.totalClasses} classes attended`
                            : 'No sessions conducted yet'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${meta.badgeBg}`}>
                        <SubIcon className="w-3 h-3" />
                        <span>{item.percentage}%</span>
                      </span>
                      {onSelectSubject && (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Progress Strip */}
                  <div className="w-full h-2 bg-blue-100/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${meta.gradient}`}
                      style={{
                        width: `${item.totalClasses > 0 ? Math.min(Math.max(item.percentage, 2), 100) : 0}%`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceStrip;
