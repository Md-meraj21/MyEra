import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, BookOpen, Award, TrendingUp } from 'lucide-react';

/**
 * Helper to compute color and metadata from attendance percentage
 */
export const getAttendanceColorInfo = (percentage) => {
  const pct = Number(percentage) || 0;
  if (pct >= 75) {
    return {
      colorHex: '#22c55e',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      gradient: 'from-emerald-500 to-green-600',
      status: 'Regular',
      icon: CheckCircle2,
      message: 'Great job! You have healthy attendance.'
    };
  } else if (pct >= 50) {
    return {
      colorHex: '#eab308',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      gradient: 'from-amber-500 to-yellow-600',
      status: 'Needs Improvement',
      icon: AlertTriangle,
      message: 'Warning: Keep attending to maintain 75%+'
    };
  } else {
    return {
      colorHex: '#ef4444',
      barColor: 'bg-rose-500',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      gradient: 'from-rose-500 to-red-600',
      status: 'Irregular',
      icon: XCircle,
      message: 'Critical: High risk of attendance shortage'
    };
  }
};

const AttendanceStrip = ({ overall, subjectStrips = [] }) => {
  const overallPct = overall ? overall.percentage : 0;
  const overallMeta = getAttendanceColorInfo(overallPct);
  const StatusIcon = overallMeta.icon;

  return (
    <div className="space-y-6">
      {/* Overall Attendance Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-slate-100 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Overall Attendance Progress</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">{overallMeta.message}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${overallMeta.badgeBg}`}
            >
              <StatusIcon className="w-4 h-4" />
              {overallMeta.status}
            </span>
            <div className="text-right">
              <span className={`text-3xl font-extrabold ${overallMeta.textColor}`}>
                {overallPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${overallMeta.gradient}`}
              style={{ width: `${Math.min(Math.max(overallPct, 3), 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs font-medium text-slate-500 pt-1">
            <span>0% (Irregular)</span>
            <span className="text-amber-600 font-semibold">50% Benchmark</span>
            <span className="text-emerald-600 font-semibold">75% Target</span>
            <span>100%</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100 text-center">
          <div className="bg-slate-50/70 p-3 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Total Sessions</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{overall?.totalSessions || 0}</p>
          </div>
          <div className="bg-emerald-50/70 p-3 rounded-xl">
            <p className="text-xs text-emerald-700 font-medium">Present Classes</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">{overall?.presentSessions || 0}</p>
          </div>
          <div className="bg-rose-50/70 p-3 rounded-xl">
            <p className="text-xs text-rose-700 font-medium">Absent Classes</p>
            <p className="text-lg font-bold text-rose-700 mt-0.5">{overall?.absentSessions || 0}</p>
          </div>
        </div>
      </div>

      {/* Subject-Wise Attendance Strips */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">Subject-wise Attendance</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {subjectStrips.length} Subjects Enrolled
          </span>
        </div>

        {subjectStrips.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No subject attendance records found yet.
          </div>
        ) : (
          <div className="space-y-4">
            {subjectStrips.map((item, idx) => {
              const meta = getAttendanceColorInfo(item.percentage);
              const SubIcon = meta.icon;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {item.subject.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{item.subject}</h4>
                        <p className="text-xs text-slate-500">
                          {item.presentClasses} of {item.totalClasses} classes attended
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${meta.badgeBg}`}>
                        <SubIcon className="w-3.5 h-3.5" />
                        {meta.status}
                      </span>
                      <span className={`text-base font-extrabold ${meta.textColor} w-12 text-right`}>
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Strip */}
                  <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${meta.gradient}`}
                      style={{ width: `${Math.min(Math.max(item.percentage, 2), 100)}%` }}
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
