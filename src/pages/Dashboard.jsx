import React from 'react';
import { 
  Bell, ShieldCheck, ChevronRight, FileText, 
  Calendar as CalIcon, Zap, Settings, Clock, GraduationCap 
} from 'lucide-react';

export default function Dashboard({ courses = [], coursework = [], userProfile = {}, setActiveTab }) {
  
  // 🚀 순수 과제 필터링 (개인 일정 및 휴강 제외)
  const activeAssignments = coursework.filter(a => 
    !a.is_completed && 
    (a.category === 'assignment' || !a.category) && 
    a.course_id
  );

  const activeAssignmentCount = activeAssignments.length;

  // 마감 임박 과제 (과제만 대상)
  const imminentTask = [...activeAssignments]
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  const calculateDDay = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const quickActions = [
    { label: '과제 확인', id: 'coursework', icon: <FileText className="text-blue-500" /> },
    { label: '일정 확인', id: 'calendar', icon: <CalIcon className="text-indigo-500" /> },
    { label: 'LMS 동기화', id: 'coursework', icon: <Zap className="text-amber-500" /> },
    { label: '내 정보', id: 'profile', icon: <Settings className="text-gray-500" /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex justify-between items-end px-1">
        <div>
          <h1 className="text-sm font-black text-[#6366f1] mb-1 uppercase tracking-widest">Dashboard</h1>
          <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">오늘의 학습 요약</p>
        </div>
      </div>

      <div className="bg-[#1a1f2c] rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden group shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-black mb-2">안녕하세요, {userProfile.full_name || '사용자'}님!</h2>
          <p className="text-indigo-200/80 font-bold mb-8">현재 진행 중인 과제는 총 <span className="text-white underline underline-offset-4">{activeAssignmentCount}건</span>입니다.</p>
          <button 
            onClick={() => setActiveTab('coursework')}
            className="bg-[#6366f1] hover:bg-[#5457eb] text-white px-6 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            과제 리스트 바로가기 <ChevronRight size={18} />
          </button>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <GraduationCap size={180} />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-red-500 animate-bounce" /> 마감 임박 알림
          </h3>
        </div>

        {imminentTask ? (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-slate-50/50 p-6 md:p-8 rounded-[24px] border border-gray-50">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                <Clock size={28} className="text-[#6366f1]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Urgent</span>
                  <span className="text-xs font-bold text-gray-400">
                    {courses.find(c => c.id === imminentTask.course_id)?.name || '과목 미지정'}
                  </span>
                </div>
                <h4 className="text-xl font-black text-gray-900 tracking-tight">{imminentTask.title}</h4>
              </div>
            </div>
            <div className="text-2xl font-black text-red-500">{calculateDDay(imminentTask.due_date)}</div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-gray-300 font-bold italic">현재 마감 임박한 과제가 없습니다. 여유를 즐기세요!</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {quickActions.map((action, i) => (
          <div 
            key={i} 
            onClick={() => setActiveTab(action.id)}
            className="bg-white border border-gray-100 rounded-[28px] p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {React.cloneElement(action.icon, { size: 28 })}
            </div>
            <span className="text-sm font-black text-gray-700">{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}