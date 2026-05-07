import React from 'react';
import { 
  Bell, ShieldCheck, ChevronRight, FileText, 
  Calendar as CalIcon, Zap, Settings, Clock 
} from 'lucide-react';

export default function Dashboard({ courses = [], coursework = [], userProfile = {}, setActiveTab }) {
  
  // 마감 임박 과제 추출 로직
  const imminentTask = [...coursework]
    .filter(a => !a.is_completed)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  // D-Day 계산 함수
  const calculateDDay = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  // 퀵 액션 메뉴 구성 (아이콘과 연결될 탭 ID)
  const quickActions = [
    { label: '과제 확인', id: 'coursework', icon: <FileText className="text-blue-500" /> },
    { label: '일정 확인', id: 'calendar', icon: <CalIcon className="text-indigo-500" /> },
    { label: 'LMS 동기화', id: 'coursework', icon: <Zap className="text-emerald-500" /> },
    { label: '설정 관리', id: 'profile', icon: <Settings className="text-orange-400" /> }
  ];

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-500 pb-24 md:pb-20 text-left">
      
      {/* 1. 환영 인사 및 상태 섹션 */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
            안녕하세요, {userProfile.nickname || '연구자'}님!
          </h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">오늘 완료해야 할 과제와 연구 일정이 있습니다.</p>
        </div>
        <div className="bg-[#f0f4ff] border border-blue-50 px-4 py-2.5 rounded-2xl flex items-center space-x-2 shrink-0">
          <ShieldCheck size={18} className="text-blue-600" />
          <span className="text-blue-600 text-[11px] font-black uppercase tracking-tight">Google Workspace Active</span>
        </div>
      </div>

      {/* 2. 구글 클래스룸 자동 감지 배너 */}
      <div className="bg-[#f0f7ff] border border-blue-100 rounded-[28px] p-6 flex flex-col lg:flex-row items-center justify-between gap-5">
        <div className="flex items-center space-x-5 w-full">
          <div className="bg-[#4a89ff] p-3.5 rounded-2xl text-white shadow-lg shadow-blue-200 shrink-0">
            <Bell size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-0.5">Google Classroom Sync</p>
            <p className="font-bold text-gray-800 text-sm md:text-base truncate">새로운 과제가 등록되었습니다: <span className="text-blue-700">자율주행 자동차 윤리 딜레마</span></p>
          </div>
        </div>
        <button 
          onClick={() => setActiveTab('coursework')}
          className="w-full lg:w-auto bg-[#3b82f6] text-white px-8 py-4 rounded-2xl font-black text-sm whitespace-nowrap shadow-md hover:bg-blue-600 transition-all active:scale-95"
        >
          일정 쪼개고 등록하기
        </button>
      </div>

      {/* 3. 마감 임박 과제 메인 카드[cite: 2] */}
      <div className="bg-[#111827] rounded-[32px] p-8 shadow-2xl relative overflow-hidden text-white group">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-lg md:text-xl font-bold flex items-center italic">
            <span className="bg-red-500 p-1.5 rounded-full mr-3 border-2 border-white/20 animate-pulse">!</span>
            마감 임박 과제
          </h3>
          <button 
            onClick={() => setActiveTab('coursework')}
            className="text-white/40 text-xs font-bold flex items-center hover:text-white transition-colors"
          >
            과제 전체보기 <ChevronRight size={14} className="ml-1" />
          </button>
        </div>

        {imminentTask ? (
          <div 
            onClick={() => setActiveTab('coursework')}
            className="bg-white/5 border border-white/10 rounded-[28px] p-8 max-w-sm backdrop-blur-md cursor-pointer hover:bg-white/10 transition-all border-l-4 border-l-red-500"
          >
            <div className="flex justify-between mb-6">
              <span className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                {calculateDDay(imminentTask.due_date)}
              </span>
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">연구 프로젝트</span>
            </div>
            <h4 className="text-xl md:text-2xl font-black text-white mb-6 leading-tight">{imminentTask.title}</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-white/40 px-1">
                <span>진행 상황</span>
                <span>33%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full w-[33%] rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-white/30 font-bold italic">현재 마감 임박한 과제가 없습니다. 여유를 즐기세요!</p>
          </div>
        )}
        
        {/* 디자인 장식 요소 */}
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
      </div>

      {/* 4. 퀵 액션 그리드[cite: 2] */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {quickActions.map((action, i) => (
          <div 
            key={i} 
            onClick={() => setActiveTab(action.id)}
            className="bg-white border border-gray-100 rounded-[28px] p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group"
          >
            <div className="bg-gray-50 p-4 md:p-5 rounded-[22px] mb-4 group-hover:scale-110 transition-transform duration-300">
              {React.cloneElement(action.icon, { size: 28 })}
            </div>
            <span className="text-sm md:text-base font-black text-gray-700">{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}