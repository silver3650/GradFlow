import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Bell, ShieldCheck, ChevronRight, FileText, 
  Calendar as CalIcon, Settings, Clock, Loader2, Sparkles, X,
  GraduationCap, Trash2
} from 'lucide-react';
import { fetchGoogleClassroomAssignments } from '../utils/classroomAPI';
import { analyzeAssignmentWithAI } from '../utils/geminiAPI';

export default function Dashboard({ courses = [], coursework = [], setCoursework, userProfile = {}, setActiveTab, providerToken }) {
  
  const [classroomTasks, setClassroomTasks] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResultModal, setAiResultModal] = useState(false);
  
  // 🚀 AI 결과를 담아 사용자가 수정할 수 있도록 관리하는 상태 (Form)
  const [aiAssignForm, setAiAssignForm] = useState({
    title: '', due_date: '', category: 'assignment',
    description: '', sub_tasks: ['']
  });

  const handleClassroomSync = async (isAutoSync = false) => {
    if (!providerToken) {
      if (!isAutoSync) {
        alert("구글 연동이 필요합니다. 설정 메뉴에서 구글 계정으로 다시 로그인해 주세요.");
        setActiveTab('profile');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const tasks = await fetchGoogleClassroomAssignments(providerToken);
      setClassroomTasks(tasks);
      
      const newTasks = tasks.filter(task => !coursework.some(cw => cw.title === task.title));
      
      if (newTasks.length > 0) {
        const latestNewTask = newTasks[0]; 
        alert(`🔔 구글 클래스룸에 새로운 과제가 감지되었습니다!\n\n[ ${latestNewTask.title} ]\nAI가 일정을 분석하여 과제함에 추가할 수 있도록 준비합니다.`);
        
        setIsAnalyzing(true);
        const result = await analyzeAssignmentWithAI(latestNewTask);
        setIsAnalyzing(false);
        
        if (result) {
          // 🚀 분석 결과를 폼 상태에 매핑하여 모달 오픈
          setAiAssignForm({
            title: result.title || latestNewTask.title,
            due_date: result.due_date ? new Date(new Date(result.due_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
            category: result.category || 'assignment',
            description: result.description || '',
            sub_tasks: result.sub_tasks || ['']
          });
          setAiResultModal(true); 
        }
      } else {
        if (!isAutoSync) {
          alert("현재 동기화할 새로운 클래스룸 과제가 없습니다.");
          setTimeout(() => setActiveTab('coursework'), 500);
        }
      }
    } catch (error) {
      console.error("Sync Error:", error);
      if (!isAutoSync) alert("동기화 중 오류가 발생했습니다. 권한 설정을 확인해 주세요.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (providerToken && coursework) {
      handleClassroomSync(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerToken]); 

  const latestGoogleTask = classroomTasks.length > 0 ? classroomTasks[0] : null;
  const isLatestTaskAlreadyAdded = latestGoogleTask && coursework.some(cw => cw.title === latestGoogleTask.title);
  const hasNewClassroomTask = latestGoogleTask && !isLatestTaskAlreadyAdded;

  const imminentTask = [...coursework]
    .filter(a => !a.is_completed && a.course_id && (a.category === 'assignment' || !a.category))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : '연결된 과목 없음';
  };

  const calculateDDay = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const formatImminentDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const week = ['일', '월', '화', '수', '목', '금', '토'];
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${week[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const quickActions = [
    { label: '과제 확인', onClick: () => setActiveTab('coursework'), icon: <FileText className="text-blue-500" /> },
    { label: '일정 확인', onClick: () => setActiveTab('calendar'), icon: <CalIcon className="text-indigo-500" /> },
    { label: '구글 동기화', onClick: () => handleClassroomSync(false), icon: <GraduationCap className={isSyncing ? "text-emerald-500 animate-bounce" : "text-emerald-600"} /> },
    { label: '설정 관리', onClick: () => setActiveTab('profile'), icon: <Settings className="text-orange-400" /> }
  ];

  const handleAiSplit = async () => {
    if (!latestGoogleTask || isLatestTaskAlreadyAdded) return;
    setIsAnalyzing(true);
    const result = await analyzeAssignmentWithAI(latestGoogleTask);
    setIsAnalyzing(false);
    if (result) {
      setAiAssignForm({
        title: result.title || latestGoogleTask.title,
        due_date: result.due_date ? new Date(new Date(result.due_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        category: result.category || 'assignment',
        description: result.description || '',
        sub_tasks: result.sub_tasks || ['']
      });
      setAiResultModal(true);
    }
  };

  // 🚀 임시 테스트용: 가상의 구글 클래스룸 과제 데이터를 AI에 전송
  const handleTestAI = async () => {
    const dummyTask = {
      title: "데이터베이스 설계 최종 프로젝트",
      description: "이번 주 금요일 자정까지 RDBMS를 활용한 쇼핑몰 데이터베이스 ERD를 설계하고 정규화(최소 3NF) 과정을 거쳐 보고서로 제출하세요. 휴강일과 겹치므로 기한을 엄수해 주세요.",
      dueDate: "2026-08-28T23:59:00"
    };

    setIsAnalyzing(true);
    const result = await analyzeAssignmentWithAI(dummyTask);
    setIsAnalyzing(false);

    if (result) {
      setAiAssignForm({
        title: result.title || dummyTask.title,
        due_date: result.due_date ? new Date(new Date(result.due_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
        category: result.category || 'assignment',
        description: result.description || '',
        sub_tasks: result.sub_tasks || ['']
      });
      setAiResultModal(true);
    }
  };

  // 🚀 폼 제출(사용자 검토 후 저장)
  const handleSaveAiTask = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: aiAssignForm.title,
        description: aiAssignForm.description,
        due_date: new Date(aiAssignForm.due_date).toISOString(),
        sub_tasks: aiAssignForm.sub_tasks.filter(t => t && t.trim() !== ''),
        category: aiAssignForm.category,
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
              <GraduationCap size={20} className={hasNewClassroomTask ? "animate-pulse" : ""} />
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
              Google Classroom {isSyncing && <Loader2 size={10} className="animate-spin inline"/>}
            </p>
            {isAnalyzing ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate animate-pulse">Gemini AI가 신규 과제를 분석하고 있습니다...</p>
            ) : isSyncing ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate">클래스룸 데이터를 동기화 중입니다...</p>
            ) : !providerToken ? (
              <p className="font-bold text-gray-500 text-xs md:text-sm truncate">설정에서 구글 계정 연동이 필요합니다.</p>
            ) : hasNewClassroomTask ? (
              <p className="font-bold text-gray-800 text-xs md:text-sm truncate">
                미등록 신규 과제: <span className="text-blue-700">{latestGoogleTask.title}</span> 
              </p>
            ) : latestGoogleTask ? (
              <p className="font-bold text-gray-500 text-xs md:text-sm truncate">모든 과제가 이미 등록되어 있습니다.</p>
            ) : (
              <p className="font-bold text-gray-600 text-xs md:text-sm truncate">새로 등록된 클래스룸 과제가 없습니다.</p>
            )}
          </div>
        </div>
        
        {/* 🚀 테스트용 버튼이 포함된 영역 */}
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleAiSplit}
            disabled={!hasNewClassroomTask || isAnalyzing}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-black text-xs md:text-sm whitespace-nowrap shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5
              ${hasNewClassroomTask && !isAnalyzing ? 'bg-[#3b82f6] text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {hasNewClassroomTask ? 'AI로 쪼개기' : '완료됨'}
          </button>

          <button 
            onClick={handleTestAI}
            disabled={isAnalyzing}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-xs md:text-sm whitespace-nowrap shadow-sm transition-all active:scale-95 bg-purple-500 text-white hover:bg-purple-600 flex items-center justify-center"
          >
            🧪 AI 테스트
          </button>
        </div>
      </div>

      {/* 마감 임박 과제 메인 카드 */}
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
                <span className="text-red-400 text-sm md:text-base font-black">
                  {formatImminentDate(imminentTask.due_date)} 마감
                </span>
              </div>
            </div>
            <h4 className="text-xl md:text-2xl font-black text-indigo-300 mb-2 leading-tight">
              {getCourseName(imminentTask.course_id)}
            </h4>
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

      {/* 퀵 액션 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {quickActions.map((action, i) => (
          <div key={i} onClick={action.onClick} className="bg-white border border-gray-100 rounded-[20px] md:rounded-[24px] p-5 md:p-6 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group">
            <div className="bg-gray-50 p-3 md:p-4 rounded-[18px] mb-3 group-hover:scale-110 transition-transform duration-300">
              {React.cloneElement(action.icon, { size: 24 })}
            </div>
            <span className="text-xs md:text-sm font-black text-gray-700 text-center leading-tight">{action.label}</span>
          </div>
        ))}
      </div>

      {/* AI 분석 결과 모달 (사용자가 확인하고 수정할 수 있는 입력 폼) */}
      {aiResultModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4">
          <form onSubmit={handleSaveAiTask} className="bg-white w-full max-w-[480px] rounded-[32px] p-8 space-y-6 animate-in zoom-in-95 duration-200 text-left flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center shrink-0">
              <h2 className="text-xl font-black text-gray-800">과제 및 일정 상세</h2>
              <button type="button" onClick={() => setAiResultModal(false)}><X size={24} className="text-gray-300"/></button>
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400">마감/일정 일시</label>
                  <input type="datetime-local" required className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={aiAssignForm.due_date} onChange={e => setAiAssignForm({...aiAssignForm, due_date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400">분류</label>
                  <select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={aiAssignForm.category || 'assignment'} onChange={e => setAiAssignForm({...aiAssignForm, category: e.target.value})}>
                    <option value="assignment">과제</option>
                    <option value="exam">시험</option>
                    <option value="schedule">일반 일정</option>
                    <option value="cancellation">🚨 휴강</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400">제목</label>
                <input required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none" value={aiAssignForm.title} onChange={e => setAiAssignForm({...aiAssignForm, title: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400">과제(일정) 내용</label>
                <textarea className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none min-h-[100px] resize-none" value={aiAssignForm.description} onChange={e => setAiAssignForm({...aiAssignForm, description: e.target.value})} placeholder="세부 내용을 기록하세요." />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> AI 세부 일정</label>
                {aiAssignForm.sub_tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none" value={task} onChange={(e) => { const nt = [...aiAssignForm.sub_tasks]; nt[idx] = e.target.value; setAiAssignForm({...aiAssignForm, sub_tasks: nt}); }} />
                    <button type="button" onClick={() => setAiAssignForm({...aiAssignForm, sub_tasks: aiAssignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300"><Trash2 size={18}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAiAssignForm({...aiAssignForm, sub_tasks: [...aiAssignForm.sub_tasks, '']})} className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2 shrink-0">
              <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}