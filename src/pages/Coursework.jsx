import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, BookOpen, CalendarDays, 
  X, Edit3, Clock, Hash, Trash2, Sparkles, RefreshCw, CheckCircle2, Calendar as CalendarIcon, Ban, ChevronUp
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
  
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const mainContent = document.querySelector('main');
    
    const handleScroll = (e) => {
      const scrollTop = e.target ? e.target.scrollTop : window.scrollY;
      if (scrollTop > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
      return () => mainContent.removeEventListener('scroll', handleScroll);
    } else {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getDDayValue = (date) => {
    if (!date) return 9999999999999;
    return new Date(date).getTime();
  };

  const getDDayLabel = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const sortedCoursesForSummary = useMemo(() => {
    return safeCourses
      .filter(c => (c?.status || 'in_progress') === courseStatusFilter)
      .sort((a, b) => {
        const aTasks = safeCoursework.filter(cw => cw?.course_id === a?.id && !cw?.is_completed && cw?.category !== 'cancellation' && cw?.category !== 'schedule');
        const bTasks = safeCoursework.filter(cw => cw?.course_id === b?.id && !cw?.is_completed && cw?.category !== 'cancellation' && cw?.category !== 'schedule');
        const aMin = aTasks.length > 0 ? Math.min(...aTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        const bMin = bTasks.length > 0 ? Math.min(...bTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        return aMin - bMin;
      });
  }, [safeCourses, safeCoursework, courseStatusFilter]);

  const totalActiveAssignments = safeCoursework.filter(a => !a.is_completed && a.category !== 'cancellation' && a.category !== 'schedule').length;

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

  // 날짜 포맷 헬퍼 함수 (리스트에서 보여줄 때 사용)
  const formatDisplayDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 md:space-y-10 text-left pb-10 relative">
      <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-center px-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tighter">과목 & 과제 현황</h2>
        <div className="flex justify-between items-center gap-4">
          <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 w-fit">
            {['in_progress', 'completed', 'incomplete'].map(s => (
              <button key={s} onClick={() => setCourseStatusFilter(s)} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${courseStatusFilter === s ? 'bg-[#6366f1] text-white shadow-md' : 'text-indigo-400'}`}>
                {s === 'in_progress' ? '수강중' : s === 'completed' ? '이수' : '미이수'}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditingCourseId(null); setCourseForm(initialCourseForm); setShowCourseModal(true); }} className="bg-[#1a1f2c] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg flex items-center shrink-0">
            <Plus size={18} className="mr-1" /> 과목 추가
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[24px] p-4 md:p-5 shadow-sm">
        <h3 className="text-base md:text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-[#6366f1]" /> 
          진행중인 과제 현황 <span className="text-[#6b62ff]">({totalActiveAssignments})</span>
        </h3>
        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          {sortedCoursesForSummary.map(c => {
            const tasks = safeCoursework
              .filter(a => a.course_id === c.id && !a.is_completed && a.category !== 'cancellation' && a.category !== 'schedule')
              .sort((a,b) => getDDayValue(a.due_date) - getDDayValue(b.due_date));
            return (
              <div key={c.id} onClick={() => document.getElementById(`course-${c.id}`)?.scrollIntoView({behavior:'smooth'})} className="bg-indigo-50/40 p-3 md:p-4 rounded-[16px] border border-indigo-100/50 cursor-pointer min-w-0 shadow-sm hover:border-[#6b62ff] transition-all">
                <span className="font-black text-gray-900 text-[11px] md:text-sm block truncate mb-2.5">
                  {c.name} <span className="text-[#6b62ff]">({tasks.length})</span>
                </span>
                <div className="space-y-1.5">
                  {tasks.slice(0, 2).map(task => (
                    <div key={task.id} className="bg-white border border-indigo-50 p-2 md:p-2.5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-center">
                      <p className="text-[10px] md:text-xs font-bold text-gray-700 truncate leading-tight">{task.title}</p>
                      <p className="text-[9px] md:text-[11px] font-black text-red-500 mt-1">{getDDayLabel(task.due_date)}</p>
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
              <div className="bg-[#1e253c] text-white px-6 py-5 rounded-t-[32px] flex justify-between items-center shadow-lg">
                
                <div className="min-w-0 pr-4 flex items-start gap-3">
                  <BookOpen size={18} className="text-indigo-300 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black truncate leading-tight">{course.name}</h3>
                    {/* 🚀 수업 시간 표시 포맷 변경 (초 단위 제거) */}
                    <p className="text-xs text-indigo-200/80 font-bold mt-1 tracking-wide">
                      {course.professor ? `${course.professor} 교수` : '교수 미지정'} ㅣ {course.day_of_week ? course.day_of_week.replace('요일', '') : ''} {course.start_time ? course.start_time.slice(0, 5) : ''}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setEditingCourseId(course.id); setCourseForm(course); setShowCourseModal(true); }} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><Edit3 size={18} /></button>
                  <button onClick={() => { setEditingAssignId(null); setAssignForm({...initialAssignForm, course_id: course.id}); setShowAssignModal(true); }} className="bg-white text-[#1e253c] px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-gray-50 transition-colors">+ 과제 추가</button>
                </div>
              </div>
              <div className="bg-white border-x border-b border-gray-100 p-6 rounded-b-[32px] grid grid-cols-1 md:grid-cols-2 gap-4 text-left shadow-sm">
                {tasks.map(a => {
                  // 🚀 카드 색상 테마 결정 (과제/시험/휴강 등)
                  const cardStyle = a.category === 'cancellation' 
                    ? 'border-red-100 bg-red-50/40 hover:border-red-200'
                    : a.category === 'exam'
                    ? 'bg-orange-50/30 border-orange-100/50 hover:border-orange-200'
                    : 'bg-indigo-50/40 border-indigo-50/50 hover:border-indigo-200';

                  return (
                    <div 
                      key={a.id} 
                      onClick={() => { 
                        setEditingAssignId(a.id); 
                        // 🚀 로컬 타임존(한국 시간)에 맞춰 모달 input에 넣기 위한 변환 작업
                        const localDue = a.due_date ? new Date(new Date(a.due_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
                        setAssignForm({...a, due_date: localDue}); 
                        setShowAssignModal(true); 
                      }} 
                      className={`p-6 rounded-[24px] border-2 cursor-pointer transition-all ${cardStyle}`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          {a.category === 'cancellation' ? (
                            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase"><Ban size={12}/> 휴강</span>
                          ) : a.category === 'schedule' ? (
                            <span className="text-[10px] font-black text-emerald-500 uppercase">일정</span>
                          ) : a.category === 'exam' ? (
                            <span className="text-[10px] font-black text-orange-500 uppercase">EXAM</span>
                          ) : (
                            <span className="text-[10px] font-black text-[#6b62ff] uppercase">TASK</span>
                          )}
                        </div>
                        {!a.is_completed && a.category !== 'cancellation' && a.category !== 'schedule' && (
                          <span className="text-red-500 text-xs font-black bg-white shadow-sm border border-red-50 px-3 py-1 rounded-full">{getDDayLabel(a.due_date)}</span>
                        )}
                      </div>
                      <h4 className={`font-bold text-base mb-3 leading-tight truncate ${a.category === 'cancellation' ? 'text-red-900' : 'text-gray-900'}`}>{a.title}</h4>
                      <div className="flex justify-between items-center border-t border-black/5 pt-4">
                        {/* 🚀 보기 편한 커스텀 포맷 함수 적용 */}
                        <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5"><Clock size={14}/> {formatDisplayDate(a.due_date)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold">클릭하여 수정</span>
                          <button onClick={async (e) => { e.stopPropagation(); const { data } = await supabase.from('assignments').update({ is_completed: !a.is_completed }).eq('id', a.id).select(); setCoursework(safeCoursework.map(item => item.id === a.id ? data[0] : item)); }} className={`w-9 h-5 rounded-full p-0.5 transition-all ${a.is_completed ? 'bg-[#6b62ff]' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-all ${a.is_completed ? 'translate-x-4' : ''}`} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveCourse} className="bg-white w-full max-w-[420px] rounded-[32px] p-8 space-y-5 animate-in zoom-in-95 duration-200 text-left">
             <div className="flex justify-between items-center"><h2 className="text-lg font-black text-gray-900">과목 정보 설정</h2><button type="button" onClick={() => setShowCourseModal(false)}><X size={24} className="text-gray-300"/></button></div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1 col-span-2"><label className="text-xs font-black text-gray-400">과목명</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">교수명</label><input className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.professor} onChange={e => setCourseForm({...courseForm, professor: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">수업요일</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.day_of_week} onChange={e => setCourseForm({...courseForm, day_of_week: e.target.value})}>{['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
               
               <div className="space-y-1 col-span-2">
                 <label className="text-xs font-black text-gray-400">수업 기간</label>
                 <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2">
                   <input type="date" className="w-full px-2 py-3 bg-transparent font-bold text-sm border-none outline-none" value={courseForm.start_date} onChange={e => setCourseForm({...courseForm, start_date: e.target.value})} />
                   <span className="text-gray-300 font-bold">~</span>
                   <input type="date" className="w-full px-2 py-3 bg-transparent font-bold text-sm border-none outline-none" value={courseForm.end_date} onChange={e => setCourseForm({...courseForm, end_date: e.target.value})} />
                 </div>
               </div>

               <div className="space-y-1"><label className="text-xs font-black text-gray-400">시작시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.start_time} onChange={e => setCourseForm({...courseForm, start_time: e.target.value})} /></div>
               <div className="space-y-1"><label className="text-xs font-black text-gray-400">종료시간</label><input type="time" className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.end_time} onChange={e => setCourseForm({...courseForm, end_time: e.target.value})} /></div>
               <div className="space-y-1 col-span-2"><label className="text-xs font-black text-gray-400">이수 상태</label><select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={courseForm.status} onChange={e => setCourseForm({...courseForm, status: e.target.value})}><option value="in_progress">수업중</option><option value="completed">완료</option><option value="incomplete">미이수</option></select></div>
             </div>
             <div className="flex gap-3 pt-2">
               {editingCourseId && <button type="button" onClick={async () => { if(window.confirm('삭제할까요?')) { await supabase.from('courses').delete().eq('id', editingCourseId); setCourses(safeCourses.filter(c => c.id !== editingCourseId)); setShowCourseModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
               <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
             </div>
          </form>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center p-4">
          <form onSubmit={handleSaveAssignment} className="bg-white w-full max-w-[480px] rounded-[32px] p-8 space-y-6 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800">과제 및 일정 상세</h2>
              <button type="button" onClick={() => setShowAssignModal(false)}><X size={24} className="text-gray-300"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">마감/일정 일시</label><input type="datetime-local" required className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-xs font-black text-gray-400">분류</label>
                  <select className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold text-sm border-none outline-none" value={assignForm.category || 'assignment'} onChange={e => setAssignForm({...assignForm, category: e.target.value})}>
                    <option value="assignment">과제</option>
                    {/* 🚀 시험 옵션 추가 */}
                    <option value="exam">시험</option>
                    <option value="schedule">일반 일정 (건수 제외)</option>
                    <option value="cancellation">🚨 휴강 (건수 제외)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1"><label className="text-xs font-black text-gray-400">제목</label><input required className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} /></div>
              
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400">과제(일정) 내용</label>
                <textarea 
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border-none min-h-[100px] resize-none" 
                  value={assignForm.description} 
                  onChange={e => setAssignForm({...assignForm, description: e.target.value})}
                  placeholder="세부적인 과제 내용이나 준비물을 기록하세요."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> AI 세부 일정</label>
                {assignForm.sub_tasks.map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold border-none outline-none" value={task} onChange={(e) => { const nt = [...assignForm.sub_tasks]; nt[idx] = e.target.value; setAssignForm({...assignForm, sub_tasks: nt}); }} />
                    <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300"><Trash2 size={18}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...assignForm.sub_tasks, '']})} className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-xl text-xs font-black">+ 항목 추가</button>
              </div>
            </div>
            <div className="flex gap-3">
              {editingAssignId && <button type="button" onClick={async () => { if(window.confirm('삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); setCoursework(safeCoursework.filter(a => a.id !== editingAssignId)); setShowAssignModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm">삭제</button>}
              <button type="submit" className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg">저장하기</button>
            </div>
          </form>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="
            fixed bottom-24 md:bottom-8 right-5 md:right-8 z-[9999]
            w-12 h-12 md:w-14 md:h-14
            rounded-full
            bg-[#6366f1]
            text-white
            shadow-[0_8px_20px_rgba(99,102,241,0.4)]
            flex items-center justify-center
            hover:bg-indigo-600 hover:-translate-y-1
            active:scale-95
            transition-all duration-300
          "
        >
          <ChevronUp size={24} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}