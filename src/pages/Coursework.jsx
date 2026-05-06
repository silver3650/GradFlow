import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, BookOpen, CalendarDays, 
  X, Edit3, Clock, Hash, Trash2, Sparkles, RefreshCw, CheckCircle2, Calendar as CalendarIcon
} from 'lucide-react';

export default function Coursework({ courses = [], setCourses, coursework = [], setCoursework, showAlert }) {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCoursework = Array.isArray(coursework) ? coursework : [];

  const [loading, setLoading] = useState(false);
  const [courseStatusFilter, setCourseStatusFilter] = useState('in_progress'); 
  const [assignFilter, setAssignFilter] = useState('incomplete');
  
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingAssignId, setEditingAssignId] = useState(null);

  // 과목 추가 모달 필드 확장 (8개 항목)
  const initialCourseForm = { 
    name: '', professor: '', day_of_week: '월요일', 
    status: 'in_progress', start_date: '2026-03-02', end_date: '2026-06-20',
    start_time: '09:00', end_time: '10:30'
  };
  
  // 과제 추가 모달 필드 확장 (설명 항목 추가)
  const initialAssignForm = { 
    title: '', due_date: '', course_id: '', is_completed: false,
    description: '', sub_tasks: [''], category: 'assignment' 
  };
  
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [assignForm, setAssignForm] = useState(initialAssignForm);

  const getDDayLabel = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const filteredCourses = useMemo(() => {
    return safeCourses
      .filter(c => {
        if (courseStatusFilter === 'incomplete') return c.status === 'incomplete';
        return (c?.status || 'in_progress') === courseStatusFilter;
      });
  }, [safeCourses, courseStatusFilter]);

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...courseForm, user_id: user.id };
    const res = editingCourseId 
      ? await supabase.from('courses').update(payload).eq('id', editingCourseId).select()
      : await supabase.from('courses').insert([payload]).select();
    if (!res.error) { setCourses(editingCourseId ? safeCourses.map(c => c.id === editingCourseId ? res.data[0] : c) : [...safeCourses, res.data[0]]); setShowCourseModal(false); }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...assignForm, due_date: new Date(assignForm.due_date).toISOString(), sub_tasks: assignForm.sub_tasks.filter(t => t && t.trim() !== ''), user_id: user.id };
    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();
    if (!res.error) { setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId ? res.data[0] : a) : [...safeCoursework, res.data[0]]); setShowAssignModal(false); }
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left pb-10">
      
      {/* 상단 제목 및 필터 */}
      <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-center px-1">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">학업 대시보드</h2>
        <div className="flex justify-between items-center gap-4">
          <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 overflow-x-auto no-scrollbar">
            {['in_progress', 'completed', 'incomplete'].map(s => (
              <button key={s} onClick={() => setCourseStatusFilter(s)} className={`px-5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${courseStatusFilter === s ? 'bg-[#6366f1] text-white shadow-md' : 'text-indigo-400 hover:bg-indigo-100/50'}`}>
                {s === 'in_progress' ? '수업중' : s === 'completed' ? '완료' : '미이수'}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="bg-[#1a1f2c] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg flex items-center shrink-0">
            <Plus size={18} className="mr-1" /> 과목 추가
          </button>
        </div>
      </div>

      {/* 🚀 이미지 기반 과제 요약 카드 (폰트 확대 및 가독성 개선) */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-6 md:p-10 shadow-sm">
        <h3 className="text-lg md:text-xl font-black text-gray-800 mb-8 flex items-center gap-2">
          <CalendarDays size={22} className="text-[#6366f1]" /> 
          현재 과제 상황 <span className="text-[#6366f1]">({safeCoursework.filter(a => !a.is_completed).length})</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {filteredCourses.map(c => {
            const tasks = safeCoursework.filter(a => a.course_id === c.id && !a.is_completed);
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-slate-50/70 p-5 rounded-[24px] border border-gray-100 cursor-pointer hover:border-indigo-300 transition-all min-w-0 shadow-sm">
                <span className="font-black text-gray-900 text-sm md:text-lg block truncate mb-3">
                  {c.name} <span className="text-[#6366f1] ml-1">({tasks.length})</span>
                </span>
                <div className="space-y-2">
                  {tasks.slice(0, 2).map(task => (
                    <div key={task.id} className="bg-white px-3 py-2 rounded-xl shadow-sm border border-indigo-50/50 text-center">
                      <p className="text-[11px] md:text-xs font-bold text-gray-700 truncate mb-0.5">{task.title}</p>
                      <p className="text-[10px] md:text-xs font-black text-red-500">{getDDayLabel(task.due_date)}</p>
                    </div>
                  ))}
                  {tasks.length === 0 && <p className="text-xs text-gray-300 text-center py-2 font-bold">진행 중인 과제 없음</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 과제 상세 리스트[cite: 4] */}
      <div className="space-y-12 mt-10">
        {filteredCourses.map(course => {
          const tasks = safeCoursework.filter(a => a.course_id === course.id && (assignFilter === 'incomplete' ? !a.is_completed : a.is_completed));
          return (
            <div key={course.id} id={`course-${course.id}`} className="scroll-mt-24">
              <div className="bg-indigo-900 text-white px-6 py-5 md:px-10 md:py-8 rounded-t-[32px] flex justify-between items-center shadow-lg">
                <div className="min-w-0 pr-4">
                  <h3 className="text-xl md:text-2xl font-black truncate flex items-center gap-3"><BookOpen size={20} className="text-indigo-300" /> {course.name}</h3>
                  <p className="text-xs md:text-sm text-indigo-200/80 font-bold ml-11 uppercase tracking-widest">{course.professor || '교수 미지정'} ㅣ {course.day_of_week}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => { setEditingAssignId(null); setAssignForm({...initialAssignForm, course_id: course.id}); setShowAssignModal(true); }} className="bg-white text-indigo-900 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg">+ 과제 추가</button>
                </div>
              </div>
              <div className="bg-white border-x border-b border-gray-100 p-6 md:p-10 rounded-b-[32px] grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {tasks.map(a => (
                  <div key={a.id} onClick={() => { setEditingAssignId(a.id); setAssignForm({...a, due_date: a.due_date?.slice(0,16)}); setShowAssignModal(true); }} className="bg-slate-50/50 p-6 md:p-8 rounded-[32px] border-2 border-gray-50 flex flex-col gap-3 cursor-pointer hover:border-indigo-100 hover:bg-white transition-all shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">TASK</span>
                      <span className="text-red-500 text-xs font-black bg-red-50 px-3 py-1 rounded-full">{getDDayLabel(a.due_date)}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-lg md:text-xl leading-tight">{a.title}</h4>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                      <span className="text-xs text-gray-400 font-bold flex items-center gap-1.5"><Clock size={14}/> {formatDeadline(a.due_date)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-indigo-300 font-bold">클릭하여 수정</span>
                        <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-9 h-5 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-indigo-600' : 'bg-gray-200'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && <p className="col-span-full text-center py-10 text-gray-300 font-black">과제가 없습니다.</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🚀 과목 추가 모달: 8개 항목 복구 및 가이드 반영[cite: 4] */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white w-full max-w-[480px] rounded-t-[32px] sm:rounded-[32px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-2">
               <h2 className="text-xl font-black text-gray-900">{editingCourseId ? '과목 수정' : '새 과목 추가'}</h2>
               <button type="button" onClick={() => setShowCourseModal(false)}><X size={24} className="text-gray-300"/></button>
             </div>
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">과목명</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">교수명</label><input className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={courseForm.professor} onChange={e => setCourseForm({...courseForm, professor: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">수업 요일</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.day_of_week} onChange={e => setCourseForm({...courseForm, day_of_week: e.target.value})}>{['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">이수 상태</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}><option value="in_progress">수업중</option><option value="completed">완료</option><option value="incomplete">미이수</option></select></div>
               </div>
               <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">학기 시작일</label><input type="date" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.start_date} onChange={e => setCourseForm({...courseForm, start_date: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">학기 종료일</label><input type="date" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-xs" value={courseForm.end_date} onChange={e => setCourseForm({...courseForm, end_date: e.target.value})} /></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">수업 시작시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.start_time} onChange={e => setCourseForm({...courseForm, start_time: e.target.value})} /></div>
                 <div className="space-y-1"><label className="text-[11px] font-black text-gray-400 ml-1">수업 종료시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm" value={courseForm.end_time} onChange={e => setCourseForm({...courseForm, end_time: e.target.value})} /></div>
               </div>
             </div>
             <div className="flex gap-3 pt-4">
               {editingCourseId && <button type="button" onClick={async () => { if(confirm('과목을 삭제할까요?')) { await supabase.from('courses').delete().eq('id', editingCourseId); setCourses(safeCourses.filter(c => c.id !== editingCourseId)); setShowCourseModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
               <button type="button" onClick={() => setShowCourseModal(false)} className="px-6 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-sm">취소</button>
               <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
             </div>
          </form>
        </div>
      )}

      {/* 🚀 이미지 기반 과제 추가 모달 (세부 항목 및 설명 포함)[cite: 4] */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white rounded-[32px] shadow-2xl w-full max-w-[480px] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50/50 shrink-0">
              <h2 className="text-xl font-black text-gray-800">{editingAssignId ? '과제 정보 수정' : 'AI 추천 기반 등록'}</h2>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-7 space-y-6 overflow-y-auto bg-white">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">등록 분류</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                  {[{id:'assignment', label:'과제', Icon:CheckCircle2}, {id:'schedule', label:'일정', Icon:CalendarIcon}].map(cat => (
                    <button key={cat.id} type="button" onClick={() => setAssignForm({...assignForm, category: cat.id})} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${assignForm.category === cat.id ? 'bg-white text-[#6366f1] shadow-sm' : 'text-gray-400'}`}>
                      <cat.Icon size={16} /> {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[13px] font-black text-gray-700 ml-1">과목 매칭</label>
                  <select className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none text-sm font-bold border-none" value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})}>
                    <option value="">개인 일정</option>
                    {safeCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[13px] font-black text-gray-700 ml-1">마감 일시</label>
                  <input type="datetime-local" required className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none text-sm font-bold border-none" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">제목</label>
                <input required className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none text-sm font-bold border-none" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">과제/일정 내용</label>
                <textarea className="w-full px-4 py-4 bg-gray-50 rounded-2xl outline-none text-sm font-bold border-none h-24 resize-none" value={assignForm.description} onChange={e => setAssignForm({...assignForm, description: e.target.value})} placeholder="상세 내용을 입력하세요." />
              </div>
              <div className="space-y-3 pt-2">
                <label className="text-[13px] font-black text-gray-700 ml-1 flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> AI 세부 일정 추천</label>
                {assignForm.sub_tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-bold" value={task} onChange={(e) => {
                      const newTasks = [...assignForm.sub_tasks];
                      newTasks[idx] = e.target.value;
                      setAssignForm({...assignForm, sub_tasks: newTasks});
                    }} />
                    <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...assignForm.sub_tasks, '']})} className="w-full py-4 border-2 border-dashed border-gray-100 text-gray-400 rounded-2xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowAssignModal(false)} className="px-8 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-sm">취소</button>
              <button type="submit" className="px-10 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function formatDeadline(dateStr) {
  if (!dateStr) return '미지정';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}(${['일','월','화','수','목','금','토'][date.getDay()]}) ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}