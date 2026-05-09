import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Bell, ShieldCheck, ChevronRight, FileText, 
  Calendar as CalIcon, Zap, Settings, Clock, Loader2, Sparkles, X
} from 'lucide-react';
import { fetchGoogleClassroomAssignments } from '../utils/classroomAPI';
import { analyzeAssignmentWithAI } from '../utils/geminiAPI';

export default function Dashboard({ courses = [], coursework = [], setCoursework, userProfile = {}, setActiveTab, providerToken }) {
  
  const [classroomTasks, setClassroomTasks] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // AI 연동 상태 관리
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResultModal, setAiResultModal] = useState(false);
  const [analyzedData, setAnalyzedData] = useState(null);

  useEffect(() => {
    const getGoogleTasks = async () => {
      if (!providerToken) return;
      setIsSyncing(true);
      const tasks = await fetchGoogleClassroomAssignments(providerToken);
      setClassroomTasks(tasks);
      setIsSyncing(false);
    };
    getGoogleTasks();
  }, [providerToken]);

  const latestGoogleTask = classroomTasks.length > 0 ? classroomTasks[0] : null;
  const hasNewClassroomTask = !!latestGoogleTask;

  // 🚀 1. 마감 임박 과제 추출 로직 수정 (개인 일정 제외, 과제만 추출)
  const imminentTask = [...coursework]
    .filter(a => 
      !a.is_completed && 
      a.course_id && // 과목이 연결된 것만
      (a.category === 'assignment' || !a.category) // 과제 카테고리만
    )
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  // 과목명 찾기 헬퍼
  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : '연결된 과목 없음';
  };

  const calculateDDay = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  // 🚀 2. 날짜 형식 변환 (mm/dd(요일) hh:mm)
  const formatImminentDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const week = ['일', '월', '화', '수', '목', '금', '토'];
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const day = week[d.getDay()];
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd}(${day}) ${hh}:${min}`;
  };

  const quickActions = [
    { label: '과제 확인', id: 'coursework', icon: <FileText className="text-blue-500" /> },
    { label: '일정 확인', id: 'calendar', icon: <CalIcon className="text-indigo-500" /> },
    { label: 'LMS 동기화', id: 'coursework', icon: <Zap className="text-emerald-500" /> },
    { label: '설정 관리', id: 'profile', icon: <Settings className="text-orange-400" /> }
  ];

  const handleAiSplit = async () => {
    if (!latestGoogleTask) return;
    setIsAnalyzing(true);
    const result = await analyzeAssignmentWithAI(latestGoogleTask);
    setIsAnalyzing(false);
    if (result) {
      setAnalyzedData(result);
      setAiResultModal(true);
    } else {
      alert("AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleSaveAiTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: analyzedData.title,
        description: analyzedData.description,
        due_date: new Date(analyzedData.dueDate).toISOString(),
        sub_tasks: analyzedData.subTasks,
        category: 'assignment',
        user_id: user.id,
        course_id: null 
      };
      const res = await supabase.from('assignments').insert([payload]).select();
      if (!res.error && setCoursework) {
        setCoursework([...coursework, res.data[0]]);
        setAiResultModal(false);
        setActiveTab('coursework');
      }
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 md:pb-20 text-left px-1">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">
            안녕하세요, {userProfile.nickname || '연구자'}님!
          </h1>
          <p className="text-gray-500 font-medium text-xs md:text-sm">오늘 완료해야 할 과제와 연구 일정이 있습니다.</p>
        </div>
        <div className={`border px-3 py-2 md:py-2.5 rounded-xl flex items-center space-x-1.5 shrink-0 transition-colors ${providerToken ? 'bg-[#f0f4ff] border-blue-50' : 'bg-gray-50 border-gray-100'}`}>
          <ShieldCheck size={16} className={providerToken ? "text-blue-600" : "text-gray-400"} />
          <span className={`text-[10px] font-black uppercase tracking-tight ${providerToken ? "text-blue-600" : "text-gray-400"}`}>
            {providerToken ? 'Google Sync Active' : 'Google Sync Offline'}
          </span>
        </div>
      </div>

      {/* 구글 클래스룸 자동 감지 배너 */}
      <div className="bg-[#f0f7ff] border border-blue-100 rounded-[20px] md:rounded-[24px] p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3 w-full">
          <div className="relative bg-[#4a89ff] p-3 rounded-xl text-white shadow-md shrink-0">
            {isSyncing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Bell size={20} className={hasNewClassroomTask ? "animate-pulse" : ""} />
            )}
            {hasNewClassroomTask && !isSyncing && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-blue-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1">
              Google Classroom {isAnalyzing && <Loader2 size={10} className="animate-spin inline"/>}
            </p>
            {isAnalyzing ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate animate-pulse">Gemini AI가 과제를 분석하고 있습니다...</p>
            ) : isSyncing ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate">클래스룸 데이터를 동기화 중입니다...</p>
            ) : !providerToken ? (
              <p className="font-bold text-gray-500 text-xs md:text-sm truncate">설정에서 구글 계정 연동이 필요합니다.</p>
            ) : latestGoogleTask ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate">
                새로운 과제: <span className="text-blue-700">{latestGoogleTask.title}</span> 
              </p>
            ) : (
              <p className="font-bold text-gray-600 text-xs md:text-sm truncate">새로 등록된 클래스룸 과제가 없습니다.</p>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleAiSplit}
          disabled={!hasNewClassroomTask || isAnalyzing}
          className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-black text-xs md:text-sm whitespace-nowrap shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5
            ${hasNewClassroomTask && !isAnalyzing ? 'bg-[#3b82f6] text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
          `}
        >
          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {hasNewClassroomTask ? 'AI로 일정 쪼개기' : '내역 확인'}
        </button>
      </div>

      {/* 🚀 3. 마감 임박 과제 메인 카드 (수정됨) */}
      <div className="bg-[#111827] rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-xl relative overflow-hidden text-white group">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h3 className="text-base md:text-lg font-bold flex items-center italic">
            <span className="bg-red-500 p-1 md:p-1.5 rounded-full mr-2 border-2 border-white/20 animate-pulse">!</span>
            마감 임박 과제
          </h3>
          <button onClick={() => setActiveTab('coursework')} className="text-white/40 text-[10px] md:text-xs font-bold flex items-center hover:text-white transition-colors">
            전체보기 <ChevronRight size={14} className="ml-0.5" />
          </button>
        </div>

        {imminentTask ? (
          <div onClick={() => setActiveTab('coursework')} className="bg-white/5 border border-white/10 rounded-[20px] md:rounded-[24px] p-5 md:p-6 w-full lg:max-w-md backdrop-blur-md cursor-pointer hover:bg-white/10 transition-all border-l-4 border-l-red-500">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-red-500 text-white px-2.5 py-1 rounded-md text-[10px] md:text-[11px] font-black uppercase tracking-tighter">
                  {calculateDDay(imminentTask.due_date)}
                </span>
                <span className="text-red-400 text-[11px] md:text-xs font-black">
                  {formatImminentDate(imminentTask.due_date)} 마감
                </span>
              </div>
            </div>
            
            {/* 🚀 과목명 표시 (크게 강조) */}
            <h4 className="text-xl md:text-2xl font-black text-indigo-300 mb-2 leading-tight">
              {getCourseName(imminentTask.course_id)}
            </h4>
            
            {/* 과제 제목 */}
            <p className="text-sm md:text-base font-bold text-white/80 truncate">
              {imminentTask.title}
            </p>
          </div>
        ) : (
          <div className="py-8 md:py-10 text-center">
            <p className="text-white/30 font-bold text-xs md:text-sm italic">현재 마감 임박한 과제가 없습니다. 여유를 즐기세요!</p>
          </div>
        )}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 md:w-48 md:h-48 bg-indigo-500/10 rounded-full blur-2xl md:blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
      </div>

      {/* 4. 퀵 액션 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {quickActions.map((action, i) => (
          <div key={i} onClick={() => setActiveTab(action.id)} className="bg-white border border-gray-100 rounded-[20px] md:rounded-[24px] p-5 md:p-6 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group">
            <div className="bg-gray-50 p-3 md:p-4 rounded-[18px] mb-3 group-hover:scale-110 transition-transform duration-300">
              {React.cloneElement(action.icon, { size: 24 })}
            </div>
            <span className="text-xs md:text-sm font-black text-gray-700">{action.label}</span>
          </div>
        ))}
      </div>

      {/* AI 분석 결과 확인 및 저장 모달 */}
      {aiResultModal && analyzedData && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="bg-indigo-50 p-6 flex justify-between items-start border-b border-indigo-100 shrink-0">
              <div>
                <span className="flex items-center gap-1.5 text-indigo-600 font-black text-xs uppercase tracking-wider mb-1"><Sparkles size={14}/> AI 분석 완료</span>
                <h3 className="text-lg font-black text-gray-900 leading-tight">{analyzedData.title}</h3>
              </div>
              <button onClick={() => setAiResultModal(false)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full shadow-sm"><X size={18} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 block mb-1">AI 요약 설명</span>
                <p className="text-sm font-bold text-gray-700 leading-relaxed">{analyzedData.description}</p>
              </div>
              
              <div>
                <span className="text-[11px] font-black text-gray-500 block mb-3 flex items-center gap-1"><Clock size={12}/> 자동 생성된 세부 일정</span>
                <div className="space-y-2">
                  {analyzedData.subTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-3 bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                      <span className="bg-indigo-100 text-indigo-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                      <p className="text-xs font-bold text-gray-800 leading-tight pt-0.5">{task}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-white shrink-0">
              <button 
                onClick={handleSaveAiTask}
                className="w-full bg-[#4b44e6] text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2"
              >
                <FileText size={18} /> 이 일정으로 내 과제함에 등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}