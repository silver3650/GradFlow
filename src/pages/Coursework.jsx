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

  // 복구된 과목 폼 초기 데이터 (8개 필드 반영)[cite: 4]
  const initialCourseForm = { 
    name: '', professor: '', day_of_week: '월요일', 
    status: 'in_progress', start_date: '2026-03-02', end_date: '2026-06-20',
    start_time: '09:00', end_time: '10:30'
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
    const payload = { ...assignForm, due_date: new Date(assignForm.due_date).toISOString(), sub_tasks: assignForm.sub_tasks.filter(t => t && t.trim() !== ''), user_id: user.id };
    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();
    if (!res.error) { setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId ? res.data[0] : a) : [...safeCoursework, res.data[0]]); setShowAssignModal(false); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left pb-10">
      {/* 액션 헤더 */}
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">학업 관리</h2>
        <button onClick={() => setShowClassroomPanel(true)} className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 🚀 전체 진행 중인 과제 요약[cite: 4] */}
      <div className="bg-white border border-gray-100 rounded-[24px] p-4 md:p-8 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-[#6366f1]" /> 
          전체 진행 중인 과제({safeCoursework.filter(a => !a.is_completed).length})
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {filteredCourses.map(c => {
            const tasks = safeCoursework.filter(a => a.course_id === c.id && !a.is_completed);
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-slate-50/70 p-2 rounded-xl border border-gray-100 cursor-pointer min-w-0">
                <span className="font-black text-gray-900 text-[10px] block truncate leading-tight">{c.name} ({tasks.length})</span>
                <div className="space-y-1 mt-1">
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

      {/* 과제 리스트 및 추가 버튼[cite: 4] */}
      <div className="space-y-10">
        {filteredCourses.map(course => {
          const tasks = safeCoursework.filter(a => a.course_id === course.id && (assignFilter === 'incomplete' ? !a.is_completed : a.is_completed));
          return (
            <div key={course.id} id={`course-${course.id}`} className="scroll-mt-24">
              <div className="bg-indigo-900 text-white px-5 py-4 rounded-t-[24px] flex justify-between items-center shadow-lg">
                <div className="min-w-0">
                  <h3 className="font-black truncate text-sm flex items-center gap-2"><BookOpen size={16} className="text-indigo-300" /> {course.name}</h3>
                  <p className="text-[10px] text-indigo-200/80 font-bold ml-6 uppercase tracking-widest">{course.professor || '교수 미지정'} ㅣ {course.day_of_week}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2 bg-white/10 rounded-lg"><Edit3 size={16} /></button>
                  {/* 과제 추가 버튼 활성화 */}
                  <button onClick={() => { setEditingAssignId(null); setAssignForm({...initialAssignForm, course_id: course.id}); setShowAssignModal(true); }} className="bg-white text-indigo-900 px-3 py-1.5 rounded-xl text-[10px] font-black">+ 과제</button>
                </div>
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
                      <div className="flex items-center gap-2">
                        {/* 클릭하여 수정 안내 문구[cite: 4] */}
                        <span className="text-[10px] text-indigo-300 font-bold">클릭하여 수정</span>
                        <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-8 h-4 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-indigo-600' : 'bg-gray-200'}`}><div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-black text-sm hover:bg-gray-50">+ 새로운 과목 추가</button>
      </div>

      {/* 🚀 복구된 과목 추가 모달 (8개 필드)[cite: 4] */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white w-full max-w-[420px] rounded-t-[32px] sm:rounded-[24px] p-8 space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-2">
               <h2 className="text-lg font-black text-gray-900">{editingCourseId ? '과목 수정' : '새 과목 추가'}</h2>
               <button type="button" onClick={() => setShowCourseModal(false)}><X size={24} className="text-gray-300"/></button>
             </div>
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">과목명</label><input required className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">교수명</label><input className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.professor} onChange={e => setCourseForm({...courseForm, professor: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">수업 요일</label><select className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.day_of_week} onChange={e => setCourseForm({...courseForm, day_of_week: e.target.value})}>{['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">상태</label><select className="w-full px-4 py-2.5 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}><option value="in_progress">수업중</option><option value="completed">완료</option></select></div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">학기 시작일</label><input type="date" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.start_date} onChange={e => setCourseForm({...courseForm, start_date: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">학기 종료일</label><input type="date" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.end_date} onChange={e => setCourseForm({...courseForm, end_date: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">수업 시작시간</label><input type="time" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.start_time} onChange={e => setCourseForm({...courseForm, start_time: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400">수업 종료시간</label><input type="time" className="w-full px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.end_time} onChange={e => setCourseForm({...courseForm, end_time: e.target.value})} /></div>
               </div>
             </div>
             <button type="submit" className="w-full py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">과목 저장하기</button>
          </form>
        </div>
      )}

      {/* 🚀 복구된 과제 추가 모달 (세부 항목 포함)[cite: 4] */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white w-full max-w-[480px] rounded-t-[32px] sm:rounded-[24px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black text-gray-900">{editingAssignId ? '과제 수정' : '새 과제 등록'}</h2><button type="button" onClick={() => setShowAssignModal(false)}><X size={24} className="text-gray-300"/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">마감 일시</label><input type="datetime-local" required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">분류</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm" value={assignForm.category} onChange={e => setAssignForm({...assignForm, category: e.target.value})}><option value="assignment">과제</option><option value="schedule">일정</option></select></div>
              </div>
              <div className="space-y-1"><label className="text-xs font-black text-gray-400">제목</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} /></div>
              
              {/* 세부 항목(Sub-tasks) 복구[cite: 4] */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black text-gray-700 flex items-center gap-2"><Sparkles size={14} className="text-indigo-500" /> AI 세부 일정 항목</label>
                {assignForm.sub_tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm font-bold" value={task} onChange={(e) => {
                      const newTasks = [...assignForm.sub_tasks];
                      newTasks[idx] = e.target.value;
                      setAssignForm({...assignForm, sub_tasks: newTasks});
                    }} />
                    <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...assignForm.sub_tasks, '']})} className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              {editingAssignId && <button type="button" onClick={async () => { if(confirm('과제를 삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); setCoursework(safeCoursework.filter(a => a.id !== editingAssignId)); setShowAssignModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
              <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}