import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, BookOpen, CalendarDays, 
  X, Edit3, Clock, Hash, Trash2, Sparkles, RefreshCw, CheckCircle2, Calendar as CalendarIcon, Ban
} from 'lucide-react';

export default function Coursework({ courses = [], setCourses, coursework = [], setCoursework, showAlert }) {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCoursework = Array.isArray(coursework) ? coursework : [];

  const [courseStatusFilter, setCourseStatusFilter] = useState('in_progress'); 
  const [assignFilter, setAssignFilter] = useState('incomplete'); 
  
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingAssignId, setEditingAssignId] = useState(null);

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

  // 마감 임박순 정렬 로직
  const getDDayValue = (date) => {
    if (!date) return 9999999999999;
    return new Date(date).getTime();
  };

  const getDDayLabel = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  // 🚀 1. 과제 건수 계산 로직 수정 (개인 일정 및 휴강 제외)
  const totalAssignmentCount = useMemo(() => {
    return safeCoursework.filter(a => 
      !a.is_completed && 
      (a.category === 'assignment' || !a.category) && 
      a.course_id // 과목이 매칭된 경우만 '과제 건수'로 인정
    ).length;
  }, [safeCoursework]);

  const sortedCoursesForSummary = useMemo(() => {
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
    
    let finalCategory = assignForm.category;
    let finalTitle = assignForm.title;

    // 🚀 2. 개인 일정 자동 분류 및 휴강 제목 처리
    if (!assignForm.course_id) {
      finalCategory = 'schedule'; // 과목 없으면 무조건 개인 일정
    } else if (assignForm.category === 'cancellation') {
      const courseName = safeCourses.find(c => c.id === assignForm.course_id)?.name || '';
      finalTitle = `${courseName}-휴강`; // 요청하신 '과목명-휴강' 형태 적용
    }

    const payload = { 
      ...assignForm, 
      title: finalTitle,
      category: finalCategory,
      due_date: new Date(assignForm.due_date).toISOString(), 
      sub_tasks: assignForm.sub_tasks.filter(t => t && t.trim() !== ''), 
      user_id: user.id 
    };

    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();

    if (!res.error) {
      setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId ? res.data[0] : a) : [...safeCoursework, res.data[0]]);
      setShowAssignModal(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left pb-10">
      <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-center px-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tighter">학업 대시보드</h2>
        <div className="flex justify-between items-center gap-4">
          <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 w-fit">
            {['in_progress', 'completed', 'incomplete'].map(s => (
              <button key={s} onClick={() => setCourseStatusFilter(s)} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${courseStatusFilter === s ? 'bg-[#6366f1] text-white shadow-md' : 'text-indigo-400'}`}>
                {s === 'in_progress' ? '수업중' : s === 'completed' ? '완료' : '미이수'}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="bg-[#1a1f2c] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg flex items-center shrink-0">
            <Plus size={18} className="mr-1" /> 과목 추가
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm">
        <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
          <CalendarDays size={20} className="text-[#6366f1]" /> 
          현재 과제 상황 ({totalAssignmentCount})
        </h3>
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          {sortedCoursesForSummary.map(c => {
            const tasks = safeCoursework
              .filter(a => a.course_id === c.id && !a.is_completed && (a.category === 'assignment' || !a.category))
              .sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-slate-50/70 p-3 md:p-5 rounded-2xl border border-gray-100 cursor-pointer min-w-0 shadow-sm hover:border-indigo-200 transition-all">
                <span className="font-black text-gray-900 text-xs md:text-base block truncate mb-3">{c.name} ({tasks.length})</span>
                <div className="space-y-2">
                  {tasks.slice(0, 2).map(task => (
                    <div key={task.id} className="bg-white p-2 rounded-xl shadow-sm text-center">
                      <p className="text-[10px] md:text-xs font-bold text-gray-700 truncate">{task.title}</p>
                      <p className="text-[9px] md:text-[11px] font-black text-red-500">{getDDayLabel(task.due_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {['all', 'incomplete', 'completed'].map(f => (
          <button key={f} onClick={() => setAssignFilter(f)} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${assignFilter === f ? 'bg-white text-[#5c56e0] shadow-sm' : 'text-gray-500'}`}>
            {f === 'all' ? '전체' : f === 'incomplete' ? '미완료' : '제출완료'}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {sortedCoursesForSummary.map(course => {
          const tasks = safeCoursework
            .filter(a => a.course_id === course.id && (assignFilter === 'all' ? true : assignFilter === 'incomplete' ? !a.is_completed : a.is_completed))
            .sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));
          return (
            <div key={course.id} id={`course-${course.id}`} className="scroll-mt-24">
              <div className="bg-indigo-900 text-white px-6 py-5 rounded-t-[32px] flex justify-between items-center shadow-lg text-left">
                <div className="min-w-0 pr-4">
                  <h3 className="text-lg font-black truncate flex items-center gap-3"><BookOpen size={18} className="text-indigo-300" /> {course.name}</h3>
                  <p className="text-xs text-indigo-200/80 font-bold ml-11 uppercase tracking-widest">{course.professor || '교수 미지정'} ㅣ {course.day_of_week}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2.5 bg-white/10 rounded-xl"><Edit3 size={18} /></button>
                  <button onClick={() => { setEditingAssignId(null); setAssignForm({...initialAssignForm, course_id: course.id, due_date: new Date().toISOString().slice(0, 16)}); setShowAssignModal(true); }} className="bg-white text-indigo-900 px-4 py-2 rounded-xl text-xs font-black shadow-lg">+ 과제 추가</button>
                </div>
              </div>
              <div className="bg-white border-x border-b border-gray-100 p-6 rounded-b-[32px] grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map(a => (
                  <div key={a.id} onClick={() => { setEditingAssignId(a.id); setAssignForm({...a, due_date: a.due_date?.slice(0,16)}); setShowAssignModal(true); }} className={`bg-slate-50/50 p-6 rounded-[32px] border-2 border-gray-50 cursor-pointer hover:border-indigo-100 transition-all text-left ${a.category === 'cancellation' ? 'border-red-100 bg-red-50/30' : ''}`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        {a.category === 'cancellation' ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase"><Ban size={12}/> 휴강</span>
                        ) : (
                          <span className="text-[10px] font-black text-indigo-400 uppercase">TASK</span>
                        )}
                      </div>
                      {!a.is_completed && (a.category === 'assignment' || !a.category) && <span className="text-red-500 text-xs font-black bg-red-50 px-3 py-1 rounded-full">{getDDayLabel(a.due_date)}</span>}
                    </div>
                    <h4 className={`font-bold text-base mb-3 leading-tight truncate ${a.category === 'cancellation' ? 'text-red-900' : 'text-gray-800'}`}>{a.title}</h4>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                      <span className="text-xs text-gray-400 font-bold flex items-center gap-1.5"><Clock size={14}/> {new Date(a.due_date).toLocaleString().slice(0,12)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-indigo-300 font-bold">수정</span>
                        <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-9 h-5 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-indigo-600' : 'bg-gray-200'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 과목 설정 모달 */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white w-full max-w-[420px] rounded-[32px] p-8 space-y-5 animate-in zoom-in-95 duration-200 text-left">
             <div className="flex justify-between items-center"><h2 className="text-lg font-black text-gray-900">과목 정보 설정</h2><button type="button" onClick={() => setShowCourseModal(false)}><X size={24} className="text-gray-300"/></button></div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1 col-span-2"><label className="text-xs font-black text-gray-400">과목명</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">교수명</label><input className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.professor} onChange={e => setCourseForm({...courseForm, professor: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">수업요일</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.day_of_week} onChange={e => setCourseForm({...courseForm, day_of_week: e.target.value})}>{['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">시작시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.start_time} onChange={e => setCourseForm({...courseForm, start_time: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">종료시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.end_time} onChange={e => setCourseForm({...courseForm, end_time: e.target.value})} /></div>
               <div className="space-y-1 col-span-2"><label className="text-xs font-black text-gray-400">이수 상태</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}><option value="in_progress">수업중</option><option value="completed">완료</option><option value="incomplete">미이수</option></select></div>
             </div>
             <div className="flex gap-3 pt-2">
               {editingCourseId && <button type="button" onClick={async () => { if(confirm('삭제할까요?')) { await supabase.from('courses').delete().eq('id', editingCourseId); setCourses(safeCourses.filter(c => c.id !== editingCourseId)); setShowCourseModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
               <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
             </div>
          </form>
        </div>
      )}

      {/* 과제 상세 모달 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4">
          <form onSubmit={handleSaveAssignment} className="bg-white w-full max-w-[480px] rounded-[32px] p-8 space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black text-gray-900">과제 상세 정보</h2><button type="button" onClick={() => setShowAssignModal(false)}><X size={24} className="text-gray-300"/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">마감 일시</label><input type="datetime-local" required className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">분류</label>
                  <select className={`w-full px-4 py-3 rounded-xl font-bold text-sm border-none outline-none ${assignForm.category === 'cancellation' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`} value={assignForm.category || 'assignment'} onChange={e => setAssignForm({...assignForm, category: e.target.value})}>
                    <option value="assignment">과제</option>
                    <option value="schedule">일반 일정</option>
                    <option value="cancellation">🚨 휴강 (건수 제외)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1"><label className="text-xs font-black text-gray-400">과목 선택</label>
                <select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})}>
                  <option value="">개인 일정 (건수 제외)</option>
                  {safeCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-xs font-black text-gray-400">제목</label><input required disabled={assignForm.category === 'cancellation'} placeholder={assignForm.category === 'cancellation' ? "휴강은 제목이 자동 생성됩니다." : "제목을 입력하세요."} className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} /></div>
              
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400">과제(일정) 내용</label>
                <textarea className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none min-h-[80px] resize-none" value={assignForm.description} onChange={e => setAssignForm({...assignForm, description: e.target.value})} placeholder="상세 정보를 입력하세요." />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> AI 세부 일정</label>
                {(assignForm.sub_tasks || []).map((task, idx) => (
                  <div key={idx} className="flex gap-2"><input className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none" value={task} onChange={(e) => { const nt = [...assignForm.sub_tasks]; nt[idx] = e.target.value; setAssignForm({...assignForm, sub_tasks: nt}); }} /><button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300"><Trash2 size={18}/></button></div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...(assignForm.sub_tasks || []), '']})} className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            <div className="flex gap-3">
              {editingAssignId && <button type="button" onClick={async () => { if(confirm('삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); setCoursework(safeCoursework.filter(a => a.id !== editingAssignId)); setShowAssignModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
              <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}