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

  // 복구된 과목 폼 초기 데이터[cite: 4]
  const initialCourseForm = { 
    name: '', professor: '', day_of_week: '월요일', 
    start_time: '09:00', end_time: '10:30', 
    start_date: '2026-03-02', end_date: '2026-06-20',
    status: 'in_progress' 
  };
  
  const initialAssignForm = { 
    title: '', due_date: '', course_id: '', is_completed: false,
    description: '', sub_tasks: [''], category: 'assignment' 
  };
  
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [assignForm, setAssignForm] = useState(initialAssignForm);

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
    if (!dateStr) return '미지정';
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]}) ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const filteredCourses = useMemo(() => {
    return safeCourses
      .filter(c => (c?.status || 'in_progress') === courseStatusFilter)
      .sort((a, b) => {
        const aTasks = safeCoursework.filter(cw => cw?.course_id === a?.id && !cw?.is_completed);
        const bTasks = safeCoursework.filter(cw => cw?.course_id === b?.id && !cw?.is_completed);
        const aMin = aTasks.length > 0 ? Math.min(...aTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        const bMin = bTasks.length > 0 ? Math.min(...bTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        return aMin - bMin;
      });
  }, [safeCourses, safeCoursework, courseStatusFilter]);

  const handleSyncClassroom = async () => {
    setLoading(true);
    const data = await fetchGoogleClassroomAssignments();
    if (data.error) showAlert("🚨 에러: " + data.error);
    else { setClassroomTasks(data); setShowClassroomPanel(true); showAlert(`✨ ${data.length}개의 과제를 가져왔습니다.`); }
    setLoading(false);
  };

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
    const payload = { ...assignForm, due_date: new Date(assignForm.due_date).toISOString(), user_id: user.id };
    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();
    if (!res.error) { setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId ? res.data[0] : a) : [...safeCoursework, res.data[0]]); setShowAssignModal(false); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left pb-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">학업 관리</h2>
        <button onClick={handleSyncClassroom} className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex justify-between items-center px-1 gap-3">
        <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 overflow-x-auto no-scrollbar">
          {['in_progress', 'completed', 'incomplete'].map(s => (
            <button key={s} onClick={() => setCourseStatusFilter(s)} className={`px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${courseStatusFilter === s ? 'bg-[#6366f1] text-white shadow-md' : 'text-indigo-400 hover:bg-indigo-100/50'}`}>
              {s === 'in_progress' ? '수업중' : s === 'completed' ? '완료' : '미이수'}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="bg-[#1a1f2c] text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center shrink-0">
          <Plus size={16} className="mr-1" /> 과목 추가
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-[24px] p-4 md:p-8 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-[#6366f1]" /> 요약</h3>
        <div className="grid grid-cols-3 gap-2">
          {filteredCourses.map(c => {
            const tasks = safeCoursework.filter(a => a.course_id === c.id && !a.is_completed).sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-slate-50/70 p-2 rounded-xl border border-gray-100 cursor-pointer min-w-0">
                <span className="font-black text-gray-900 text-[10px] block truncate leading-tight mb-1">{c.name}</span>
                <div className="space-y-1">
                  {tasks.slice(0, 1).map(task => (
                    <div key={task.id} className="bg-white p-1 rounded shadow-sm">
                      <p className="text-[7px] font-black text-red-500">{getDDayLabel(task.due_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-10">
        {filteredCourses.map(course => {
          const tasks = safeCoursework.filter(a => a.course_id === course.id && (assignFilter === 'incomplete' ? !a.is_completed : a.is_completed));
          return (
            <div key={course.id} id={`course-${course.id}`} className="scroll-mt-24">
              <div className="bg-indigo-900 text-white px-5 py-4 rounded-t-[24px] flex justify-between items-center">
                <div className="min-w-0">
                  <h3 className="font-black truncate text-sm flex items-center gap-2"><BookOpen size={16} className="text-indigo-300" /> {course.name}</h3>
                  <p className="text-[10px] text-indigo-200/80 font-bold ml-6">{course.professor || '교수 미지정'} ㅣ {course.day_of_week}</p>
                </div>
                <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2 bg-white/10 rounded-lg"><Edit3 size={16} /></button>
              </div>
              <div className="bg-white border-x border-b border-gray-100 p-4 rounded-b-[24px] space-y-3">
                {tasks.map(a => (
                  <div key={a.id} onClick={() => { setEditingAssignId(a.id); setAssignForm({...a, due_date: a.due_date?.slice(0,16)}); setShowAssignModal(true); }} className="bg-slate-50/50 p-4 rounded-2xl border border-gray-50 flex flex-col gap-2 cursor-pointer hover:border-indigo-100">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">TASK</span>
                      <span className="text-red-500 text-[10px] font-black bg-red-50 px-2 py-0.5 rounded-full">{getDDayLabel(a.due_date)}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm leading-tight">{a.title}</h4>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
                      <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Clock size={12}/> {formatDeadline(a.due_date)}</span>
                      <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-8 h-4 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-indigo-600' : 'bg-gray-200'}`}><div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🚀 복구된 과목 추가 모달 (교수명, 요일, 기간 포함)[cite: 4] */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white w-full max-w-[420px] rounded-t-[32px] sm:rounded-[24px] p-8 space-y-5 animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-2">
               <h2 className="text-lg font-black text-gray-900">{editingCourseId ? '과목 수정' : '새 과목 추가'}</h2>
               <button type="button" onClick={() => setShowCourseModal(false)}><X size={24} className="text-gray-300"/></button>
             </div>
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">과목명</label><input required className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">교수명</label><input className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.professor} onChange={e => setCourseForm({...courseForm, professor: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">수업 요일</label><select className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.day_of_week} onChange={e => setCourseForm({...courseForm, day_of_week: e.target.value})}>{['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">상태</label><select className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}><option value="in_progress">수업중</option><option value="completed">완료</option></select></div>
               </div>
               <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">시작일</label><input type="date" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.start_date} onChange={e => setCourseForm({...courseForm, start_date: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">종료일</label><input type="date" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.end_date} onChange={e => setCourseForm({...courseForm, end_date: e.target.value})} /></div>
               </div>
             </div>
             <button type="submit" className="w-full py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
          </form>
        </div>
      )}

      {/* 과제 모달 (기존 유지) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white w-full max-w-[480px] rounded-t-[32px] sm:rounded-[24px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black text-gray-900">과제 정보</h2><button type="button" onClick={() => setShowAssignModal(false)}><X size={24} className="text-gray-300"/></button></div>
            <div className="space-y-1"><label className="text-xs font-black text-gray-400 ml-1">제목</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} /></div>
            <button type="submit" className="w-full py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장</button>
          </form>
        </div>
      )}
    </div>
  );
}