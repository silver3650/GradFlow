import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { fetchGoogleClassroomAssignments } from '../classroomAPI'; 
import { analyzeAssignmentWithAI } from '../geminiAPI'; 
import { 
  Plus, BookOpen, CalendarDays, 
  X, Edit3, Clock, Hash, Trash2, Sparkles, RefreshCw, CheckCircle2, Calendar
} from 'lucide-react';

export default function Coursework({ courses = [], setCourses, coursework = [], setCoursework, showAlert }) {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCoursework = Array.isArray(coursework) ? coursework : [];

  const [loading, setLoading] = useState(false);
  const [courseStatusFilter, setCourseStatusFilter] = useState('in_progress'); 
  const [assignFilter, setAssignFilter] = useState('incomplete');
  
  const [classroomTasks, setClassroomTasks] = useState([]);
  const [showClassroomPanel, setShowClassroomPanel] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingAssignId, setEditingAssignId] = useState(null);

  const initialCourseForm = { 
    name: '', professor: '', day_of_week: '월요일', 
    start_time: '09:00', end_time: '10:30', 
    status: 'in_progress' 
  };
  
  const initialAssignForm = { 
    title: '', due_date: '', course_id: '', is_completed: false,
    description: '', sub_tasks: [''], category: 'assignment' 
  };
  
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [assignForm, setAssignForm] = useState(initialAssignForm);

  // --- 1. 유틸리티 및 마감 임박순 정렬 ---
  const getDDayValue = (date) => {
    if (!date) return Infinity;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? Infinity : Math.ceil((parsed - new Date().setHours(0,0,0,0)) / 86400000);
  };

  const getDDayLabel = (date) => {
    const diff = getDDayValue(date);
    if (diff === Infinity) return '';
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const formatDeadline = (dateStr) => {
    if (!dateStr) return '마감 미지정';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]}) ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const filteredCourses = useMemo(() => {
    return safeCourses
      .filter(c => (c?.status || 'in_progress') === courseStatusFilter)
      .sort((a, b) => {
        const aTasks = safeCoursework.filter(cw => cw?.course_id === a?.id && !cw?.is_completed && (cw?.category === 'assignment' || !cw?.category));
        const bTasks = safeCoursework.filter(cw => cw?.course_id === b?.id && !cw?.is_completed && (cw?.category === 'assignment' || !cw?.category));
        const aMin = aTasks.length > 0 ? Math.min(...aTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        const bMin = bTasks.length > 0 ? Math.min(...bTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        return aMin - bMin;
      });
  }, [safeCourses, safeCoursework, courseStatusFilter]);

  // --- 2. API 핸들러 ---
  const handleSyncClassroom = async () => {
    setLoading(true);
    const data = await fetchGoogleClassroomAssignments();
    if (data.error) { showAlert("🚨 연동 에러: " + data.error); }
    else { setClassroomTasks(data); setShowClassroomPanel(true); showAlert(`✨ ${data.length}개의 과제를 가져왔습니다.`); }
    setLoading(false);
  };

  const handleAIAnalysis = async (task) => {
    setLoading(true);
    try {
      const aiResult = await analyzeAssignmentWithAI(task.courseName, task.title, task.description);
      setAssignForm({
        title: task.title, due_date: task.dueDate ? task.dueDate.slice(0, 16) : '', 
        course_id: safeCourses.find(c => c.name === task.courseName)?.id || '',
        description: aiResult.summary, sub_tasks: aiResult.sub_tasks, is_completed: false, category: 'assignment'
      });
      setEditingAssignId(null); setShowAssignModal(true);
    } catch (err) { showAlert('🚨 AI 분석 실패'); } finally { setLoading(false); }
  };

  // --- 3. 데이터 저장 ---
  const handleSaveCourse = async (e) => {
    e.preventDefault(); setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...courseForm, user_id: user.id };
    const res = editingCourseId 
      ? await supabase.from('courses').update(payload).eq('id', editingCourseId).select()
      : await supabase.from('courses').insert([payload]).select();
    if (!res.error) { setCourses(editingCourseId ? safeCourses.map(c => c.id === editingCourseId ? res.data[0] : c) : [...safeCourses, res.data[0]]); setShowCourseModal(false); }
    setLoading(false);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault(); setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const isoDueDate = new Date(assignForm.due_date).toISOString();
    const payload = { ...assignForm, due_date: isoDueDate, sub_tasks: assignForm.sub_tasks.filter(t => t && t.trim() !== ''), user_id: user.id };
    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();
    if (!res.error) { setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId ? res.data[0] : a) : [...safeCoursework, res.data[0]]); setShowAssignModal(false); }
    setLoading(false);
  };

  const openEditAssignModal = (a) => {
    const dateObj = new Date(a.due_date);
    const localTime = a.due_date ? new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '';
    setEditingAssignId(a.id); setAssignForm({...a, due_date: localTime, sub_tasks: Array.isArray(a.sub_tasks) && a.sub_tasks.length > 0 ? a.sub_tasks : [''], category: a.category || 'assignment'}); setShowAssignModal(true); 
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left">
      
      {/* 액션 헤더 */}
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">학업 대시보드</h2>
        <button onClick={handleSyncClassroom} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all shrink-0">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 동기화
        </button>
      </div>

      {/* 🚀 AI 분석 결과 패널[cite: 1] */}
      {showClassroomPanel && classroomTasks.length > 0 && (
        <div className="bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-[32px] p-6 animate-in slide-in-from-top duration-500">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-indigo-900 font-black flex items-center gap-2 text-sm">
              <Sparkles size={18} className="text-indigo-500" /> 신규 과제 분석 ({classroomTasks.length})
            </h3>
            <button onClick={() => setShowClassroomPanel(false)} className="text-indigo-400 hover:text-indigo-600"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classroomTasks.map((task, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex justify-between items-center">
                <div className="min-w-0 pr-4">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{task.courseName}</span>
                  <h4 className="font-bold text-gray-800 truncate">{task.title}</h4>
                  <p className="text-[11px] text-gray-400 font-bold mt-1">마감: {formatDeadline(task.dueDate)}</p>
                </div>
                <button onClick={() => handleAIAnalysis(task)} className="shrink-0 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-black hover:bg-indigo-700 shadow-md flex items-center gap-1.5 transition-all">
                  AI 분석 등록
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 및 추가 버튼 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-1 gap-4">
        <div className="flex space-x-2 bg-indigo-50/50 w-fit p-1 rounded-2xl border border-indigo-100">
          {['in_progress', 'completed', 'incomplete'].map(s => (
            <button key={s} onClick={() => setCourseStatusFilter(s)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${courseStatusFilter === s ? 'bg-[#6366f1] text-white shadow-md' : 'text-indigo-400 hover:bg-indigo-100/50'}`}>
              {s === 'in_progress' ? '수업중' : s === 'completed' ? '완료' : '미이수'}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="bg-[#1a1f2c] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg hover:bg-slate-800 transition-colors flex items-center shrink-0">
          <Plus size={16} className="mr-1" /> 과목 추가
        </button>
      </div>

      {/* 🚀 요약 대시보드 (모바일 3열 유지)[cite: 1] */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-4 md:p-8 shadow-sm">
        <h3 className="text-sm md:text-lg font-black text-gray-800 mb-5 flex items-center">
          <CalendarDays size={18} className="text-[#6366f1] mr-2" /> 
          현재 과제 상황 <span className="text-[#6366f1] ml-1">({safeCoursework.filter(c => !c.is_completed && (c.category === 'assignment' || !c.category)).length})</span>
        </h3>
        <div className="grid grid-cols-3 gap-2 md:gap-5">
          {filteredCourses.map(c => {
            const tasks = safeCoursework.filter(a => a.course_id === c.id && !a.is_completed && (a.category === 'assignment' || !a.category)).sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-slate-50/70 p-2 md:p-4 rounded-[16px] md:rounded-[20px] border border-gray-100 flex flex-col cursor-pointer hover:border-indigo-300 transition-all min-w-0">
                <div className="mb-1.5 pb-1 border-b border-indigo-100/60 border-dashed truncate text-center sm:text-left">
                  <span className="font-black text-gray-900 text-[9px] sm:text-[11px] md:text-base leading-tight block truncate">
                    {c.name} <span className="text-[#6366f1] text-[8px] md:text-sm">({tasks.length})</span>
                  </span>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[80px] md:max-h-[100px]">
                  {tasks.map(task => (
                    <div key={task.id} className="bg-white px-1 py-1 rounded-lg flex flex-col items-center shadow-sm">
                      <span className="text-[7px] md:text-[10px] font-bold text-gray-700 truncate w-full text-center mb-0.5 leading-tight">{task.title}</span>
                      <span className="text-red-500 text-[7px] md:text-[9px] font-black bg-red-50 px-1 rounded">{getDDayLabel(task.due_date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 리스트 필터 및 상세 목록 */}
      <div className="flex space-x-2 bg-gray-100/80 w-fit p-1 rounded-2xl mx-1 mt-10 mb-4 border border-gray-200/50">
        {['all', 'incomplete', 'completed'].map(f => (
          <button key={f} onClick={() => setAssignFilter(f)} className={`px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-xs md:text-sm font-black transition-all ${assignFilter === f ? 'bg-white text-[#5c56e0] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'all' ? '전체' : f === 'incomplete' ? '미완료' : '완료'}
          </button>
        ))}
      </div>

      {/* 과제 상세 리스트[cite: 1] */}
      <div className="space-y-12">
        {filteredCourses.map(course => {
          const tasks = safeCoursework.filter(a => {
            if (a.course_id !== course.id || (a.category && a.category !== 'assignment')) return false;
            if (assignFilter === 'incomplete') return !a.is_completed;
            if (assignFilter === 'completed') return a.is_completed;
            return true;
          }).sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));

          return (
            <div key={course.id} id={`course-${course.id}`} className="overflow-hidden scroll-mt-24">
              <div className="bg-indigo-900 text-white px-6 py-5 md:px-10 md:py-7 rounded-t-[32px] flex justify-between items-center shadow-xl">
                <div className="min-w-0 pr-4">
                  <h3 className="text-lg md:text-2xl font-black truncate flex items-center gap-3"><BookOpen className="text-indigo-300" /> {course.name}</h3>
                  <p className="text-[10px] md:text-sm text-indigo-200/80 font-bold ml-11 uppercase tracking-widest">{course.professor || '교수 미지정'} ㅣ {course.day_of_week} {course.start_time?.slice(0,5)} ~ {course.end_time?.slice(0,5)}</p>
                </div>
                <div className="flex space-x-2 shrink-0">
                  <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => { setEditingAssignId(null); setAssignForm({...initialAssignForm, course_id: course.id, category: 'assignment'}); setShowAssignModal(true); }} className="bg-white text-indigo-900 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-indigo-50">+ 과제</button>
                </div>
              </div>

              <div className="bg-slate-50/50 p-4 md:p-8 rounded-b-[32px] border-x border-b border-gray-100 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {tasks.map(a => (
                  <div key={a.id} onClick={() => openEditAssignModal(a)} className={`bg-white border-2 border-gray-50 rounded-[32px] p-6 md:p-8 shadow-sm transition-all cursor-pointer ${a.is_completed ? 'opacity-50 grayscale' : 'hover:border-indigo-100 hover:shadow-lg'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-2"><Hash size={14} className="text-indigo-400" /><span className="text-[10px] font-black uppercase tracking-tighter text-indigo-500">TASK</span></div>
                      {!a.is_completed && <span className="text-red-500 text-[10px] md:text-xs font-black bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-red-100">{getDDayLabel(a.due_date)}</span>}
                    </div>
                    <h4 className="text-base md:text-xl font-bold mb-3 text-slate-800 leading-tight">{a.title}</h4>
                    {a.description && <p className="text-[12px] text-gray-700 font-medium bg-gray-50 p-3 rounded-2xl mb-4 leading-relaxed border border-gray-100/50">{a.description}</p>}
                    
                    <div className="flex justify-between items-center border-t border-gray-50 pt-4 mt-auto">
                      <div className="flex items-center font-bold text-red-500 text-[10px] md:text-xs"><Clock size={14} className="mr-1.5" /> {formatDeadline(a.due_date)}</div>
                      <div className="flex items-center space-x-3">
                        {/* 🔧 '클릭하여 수정' 문구 유지[cite: 1] */}
                        <span className="text-gray-300 font-bold text-[10px]">클릭하여 수정</span>
                        <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-9 h-5 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- 모달 영역 (전체 포함) --- */}
      {/* 4. 과제 등록/수정 모달[cite: 1] */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white rounded-3xl shadow-2xl w-full max-w-[480px] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50/50 shrink-0">
              <h2 className="text-lg font-black text-gray-800">{editingAssignId ? '과제 정보 수정' : 'AI 추천 기반 등록'}</h2>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-6 overflow-y-auto bg-white">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">등록 분류</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                  {[{id:'assignment', label:'과제', Icon:CheckCircle2}, {id:'schedule', label:'일정', Icon:Calendar}].map(cat => (
                    <button key={cat.id} type="button" onClick={() => setAssignForm({...assignForm, category: cat.id})} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${assignForm.category === cat.id ? 'bg-white text-[#6366f1] shadow-sm' : 'text-gray-400'}`}>
                      <cat.Icon size={14} /> {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2 min-w-0">
                  <label className="text-[13px] font-black text-gray-700 ml-1">과목 매칭</label>
                  <select className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold border border-transparent focus:border-indigo-300 truncate" value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})}>
                    <option value="">개인 일정</option>
                    {safeCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <label className="text-[13px] font-black text-gray-700 ml-1">마감 일시</label>
                  <input type="datetime-local" required className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold border border-transparent focus:border-indigo-300" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">제목</label>
                <input required className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold border border-transparent focus:border-indigo-300" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} />
              </div>
              <div className="space-y-3 pt-2">
                <label className="text-[13px] font-black text-gray-700 ml-1 flex items-center gap-2"><Sparkles size={14} className="text-indigo-500" /> AI 세부 일정 추천</label>
                {assignForm.sub_tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-3 bg-gray-50 border border-transparent rounded-[12px] text-sm font-bold" value={task} onChange={(e) => {
                      const newTasks = [...assignForm.sub_tasks];
                      newTasks[idx] = e.target.value;
                      setAssignForm({...assignForm, sub_tasks: newTasks});
                    }} />
                    <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...assignForm.sub_tasks, '']})} className="w-full py-3.5 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
              {editingAssignId && (
                <button type="button" onClick={async () => { if(window.confirm('삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); setCoursework(safeCoursework.filter(a => a.id !== editingAssignId)); setShowAssignModal(false); } }} className="mr-auto px-5 text-red-500 font-black text-sm">삭제</button>
              )}
              <button type="button" onClick={() => setShowAssignModal(false)} className="px-6 py-3 bg-gray-50 text-gray-600 rounded-xl font-black text-sm">취소</button>
              <button type="submit" className="px-8 py-3.5 bg-[#6366f1] text-white rounded-xl font-black text-sm shadow-lg">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 5. 과목 추가/수정 모달 (시간 필드 포함)[cite: 1] */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white rounded-3xl shadow-2xl w-full max-w-[420px] animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50/50">
              <h2 className="text-lg font-black text-gray-800">{editingCourseId ? '과목 정보 수정' : '새 과목 추가'}</h2>
              <button type="button" onClick={() => setShowCourseModal(false)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-6 bg-white">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">과목명</label>
                <input required placeholder="예: 조직신학 특론" className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-indigo-500 rounded-xl outline-none text-sm font-bold" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <label className="text-[13px] font-black text-gray-700 ml-1">시작 시간</label>
                  <input type="time" className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold" value={courseForm.start_time} onChange={e => setCourseForm({...courseForm, start_time: e.target.value})} />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[13px] font-black text-gray-700 ml-1">종료 시간</label>
                  <input type="time" className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold" value={courseForm.end_time} onChange={e => setCourseForm({...courseForm, end_time: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">이수 상태</label>
                <select className="w-full px-4 py-3.5 bg-gray-50 rounded-xl outline-none text-sm font-bold" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}>
                  <option value="in_progress">수업중</option>
                  <option value="completed">완료</option>
                  <option value="incomplete">미이수</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3">
              {editingCourseId && (
                <button type="button" onClick={async () => { if(window.confirm('삭제할까요?')) { await supabase.from('courses').delete().eq('id', editingCourseId); setCourses(safeCourses.filter(c => c.id !== editingCourseId)); setShowCourseModal(false); } }} className="mr-auto px-5 text-red-500 font-black text-sm">삭제</button>
              )}
              <button type="button" onClick={() => setShowCourseModal(false)} className="px-6 py-3 bg-gray-50 text-gray-600 rounded-xl font-black text-sm">취소</button>
              <button type="submit" className="px-8 py-3.5 bg-[#6366f1] text-white rounded-xl font-black text-sm shadow-lg">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}