import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Plus, X, Clock, BookOpen, FileText, Edit3, Trash2
} from 'lucide-react';

export default function CalendarView({ courses = [], coursework = [], setCoursework }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [editingAssignId, setEditingAssignId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const initialAssignForm = { title: '', due_date: '', course_id: '', description: '', sub_tasks: [''] };
  const [assignForm, setAssignForm] = useState(initialAssignForm);

  const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };

  const getLocalDateStr = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const events = [];
    const targetDateStr = getLocalDateStr(date);
    const targetDay = date.getDay();

    coursework.forEach(item => {
      if (item.due_date && getLocalDateStr(item.due_date) === targetDateStr) {
        // course_id가 없으면(null) 개인 일정으로 분류
        const isPersonal = !item.course_id;
        events.push({ 
          id: `a-${item.id}`, db_id: item.id, 
          type: isPersonal ? 'personal' : 'assignment', 
          label: isPersonal ? '개인 일정' : '과제', 
          title: item.title, 
          time: new Date(item.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
          isCompleted: item.is_completed, 
          raw: item 
        });
      }
    });

    courses.forEach(course => {
      const dayStr = course.day_of_week ? course.day_of_week.trim().substring(0, 1) : '';
      if (dayMap[dayStr] === targetDay) {
        events.push({ id: `c-${course.id}`, type: 'course', label: '수업', title: course.name, time: course.start_time?.substring(0, 5) || '' });
      }
    });
    return events.sort((a, b) => a.time.localeCompare(b.time));
  };

  const moveMonth = (offset) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  const moveYear = (offset) => setCurrentDate(new Date(currentDate.getFullYear() + offset, currentDate.getMonth(), 1));

  const calendarDays = (() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  })();

  const openAddModal = (date) => {
    const defaultDate = new Date(date);
    defaultDate.setHours(23, 59, 0, 0); 
    const tzOffset = defaultDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);

    setEditingAssignId(null);
    setAssignForm({ ...initialAssignForm, due_date: localISOTime, course_id: '' });
    setShowAssignModal(true);
  };

  const openEditModal = (eventRaw) => {
    let localDateTimeStr = '';
    if (eventRaw.due_date) {
      try {
        const dateObj = new Date(eventRaw.due_date);
        localDateTimeStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      } catch(e) {}
    }
    const validSubTasks = Array.isArray(eventRaw.sub_tasks) && eventRaw.sub_tasks.length > 0 ? eventRaw.sub_tasks : [''];
    setEditingAssignId(eventRaw.id);
    setAssignForm({ ...eventRaw, due_date: localDateTimeStr, sub_tasks: validSubTasks, course_id: eventRaw.course_id || '' });
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const safeSubTasks = Array.isArray(assignForm.sub_tasks) ? assignForm.sub_tasks : [];
      const filteredSubTasks = safeSubTasks.filter(task => task && task.trim() !== '');
      
      const localDateObj = new Date(assignForm.due_date);
      const isoDueDate = localDateObj.toISOString();

      // 🔥 핵심 수정: course_id가 빈 문자열이면 null로 변환하여 에러 방지
      const payload = { 
        ...assignForm, 
        due_date: isoDueDate, 
        sub_tasks: filteredSubTasks, 
        user_id: user.id,
        course_id: assignForm.course_id === '' ? null : assignForm.course_id
      };
      
      let res = editingAssignId 
        ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
        : await supabase.from('assignments').insert([payload]).select();
      
      if (res.error) throw new Error(res.error.message);
      
      if (setCoursework) {
        setCoursework(prev => editingAssignId ? prev.map(a => a.id === editingAssignId ? res.data[0] : a) : [...prev, res.data[0]]);
      } else {
        window.location.reload(); 
      }
      setShowAssignModal(false); 
      window.alert(editingAssignId ? '✅ 일정이 수정되었습니다.' : '✅ 일정이 등록되었습니다.');
    } catch (err) { 
      window.alert(`🚨 저장 실패: ${err.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const currentSubTasks = Array.isArray(assignForm.sub_tasks) ? assignForm.sub_tasks : [''];
  const handleAddSubTask = () => setAssignForm({ ...assignForm, sub_tasks: [...currentSubTasks, ''] });
  const handleSubTaskChange = (index, value) => {
    const newTasks = [...currentSubTasks];
    newTasks[index] = value;
    setAssignForm({ ...assignForm, sub_tasks: newTasks });
  };
  const handleRemoveSubTask = (index) => {
    const newTasks = currentSubTasks.filter((_, i) => i !== index);
    setAssignForm({ ...assignForm, sub_tasks: newTasks.length ? newTasks : [''] });
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-24 text-left animate-in fade-in duration-500 px-1 font-sans">
      <div>
        <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">통합 캘린더</h1>
        <p className="text-gray-500 font-bold text-xs md:text-base mt-2">수업, 과제, 개인 일정을 스마트하게 관리하세요.</p>
      </div>

      <div className="bg-[#1a1f2c] rounded-[28px] md:rounded-[32px] p-4 md:p-6 text-white shadow-2xl flex flex-row gap-3 md:gap-8 items-stretch">
        <div className="w-1/2 pr-3 border-r border-white/5 flex flex-col">
          <div className="flex justify-between items-center mb-2 md:mb-3 px-1 shrink-0">
            <span className="text-sm md:text-lg font-black text-indigo-400">{currentDate.getMonth() + 1}월</span>
            <div className="flex space-x-1">
              <button onClick={() => moveMonth(-1)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft size={16}/></button>
              <button onClick={() => moveMonth(1)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight size={16}/></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-y-0.5 text-center font-bold">
            {['일','월','화','수','목','금','토'].map((d, i) => (
              <span key={d} className={`text-[8px] md:text-[11px] mb-1 ${i===0?'text-red-500':i===6?'text-blue-400':'text-gray-500'}`}>{d}</span>
            ))}
            {calendarDays.map((date, i) => {
              const dayEvents = getEventsForDate(date);
              const hasCourse = dayEvents.some(e => e.type === 'course');
              const hasAssign = dayEvents.some(e => e.type === 'assignment');
              const hasPersonal = dayEvents.some(e => e.type === 'personal');
              
              const isSelected = date && selectedDate.toDateString() === date.toDateString();
              let textClass = 'text-gray-300';
              if (isSelected) textClass = 'text-white';
              else if (date?.getDay() === 0) textClass = 'text-red-500/90';
              else if (date?.getDay() === 6) textClass = 'text-blue-400/90';

              return (
                <div key={i} className="flex flex-col items-center justify-center h-6 md:h-8 relative">
                  {date && (
                    <>
                      <button 
                        onClick={() => setSelectedDate(date)}
                        className={`w-5 h-5 md:w-7 md:h-7 rounded-full text-[9px] md:text-[12px] font-black flex items-center justify-center transition-all z-10
                          ${isSelected ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-110' : 'hover:bg-white/10'}
                          ${textClass}
                        `}
                      >
                        {date.getDate()}
                      </button>
                      <div className="flex gap-[2px] mt-px h-[3px]">
                        {hasCourse && <div className="w-[3px] h-[3px] rounded-full bg-amber-400"></div>}
                        {hasAssign && <div className="w-[3px] h-[3px] rounded-full bg-rose-500"></div>}
                        {hasPersonal && <div className="w-[3px] h-[3px] rounded-full bg-emerald-400"></div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-1/2 pl-1 relative">
          <div className="absolute inset-0 flex flex-col pr-1 pb-1">
            <div className="flex justify-between items-center mb-3 md:mb-4 shrink-0">
              <h3 className="text-xs md:text-lg font-black truncate tracking-tight text-white/90">
                {selectedDate.getMonth() + 1}/{selectedDate.getDate()}({['일','월','화','수','목','금','토'][selectedDate.getDay()]})
              </h3>
              <button onClick={() => { setShowDetailModal(true); openAddModal(selectedDate); }} className="bg-indigo-500 p-1 md:p-1.5 rounded-full hover:bg-indigo-600 shadow-md transition-colors"><Plus size={14} className="text-white"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3">
              {getEventsForDate(selectedDate).map((event) => (
                <div key={event.id} className="relative pl-3.5 py-0.5 flex flex-col justify-center">
                  <div className={`absolute left-0 top-0.5 bottom-0.5 w-[3px] md:w-1 rounded-full shadow-sm 
                    ${event.type === 'assignment' ? 'bg-rose-500' : event.type === 'personal' ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[8px] md:text-[10px] font-black text-white/40 flex items-center gap-1 uppercase tracking-tighter">
                      {event.time} <span className="text-white/20">|</span> {event.label}
                    </span>
                    <span className={`text-[10px] md:text-[13px] font-bold truncate mt-0.5 ${event.isCompleted ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
                      {event.title}
                    </span>
                  </div>
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <div className="h-full flex items-center justify-center pb-6">
                  <p className="text-[9px] md:text-xs text-gray-500 font-black italic uppercase tracking-widest">No Schedule</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[28px] md:rounded-[32px] shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center space-x-1 md:space-x-2">
            <button onClick={() => moveYear(-1)} className="p-1.5 text-gray-400 hover:bg-white hover:shadow-sm rounded-lg hover:text-indigo-600 transition-all"><ChevronsLeft size={20}/></button>
            <button onClick={() => moveMonth(-1)} className="p-1.5 text-gray-400 hover:bg-white hover:shadow-sm rounded-lg hover:text-indigo-600 transition-all"><ChevronLeft size={20}/></button>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 min-w-[130px] text-center tracking-tighter mx-2">
              {currentDate.getFullYear()}. {currentDate.getMonth() + 1}
            </h2>
            <button onClick={() => moveMonth(1)} className="p-1.5 text-gray-400 hover:bg-white hover:shadow-sm rounded-lg hover:text-indigo-600 transition-all"><ChevronRight size={20}/></button>
            <button onClick={() => moveYear(1)} className="p-1.5 text-gray-400 hover:bg-white hover:shadow-sm rounded-lg hover:text-indigo-600 transition-all"><ChevronsRight size={20}/></button>
          </div>

          <div className="flex items-center gap-3 md:gap-5 text-[11px] md:text-xs font-bold text-gray-500">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></div> 수업</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div> 과제</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> 개인 일정</span>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center border-b border-gray-100 font-black text-[11px] md:text-sm text-gray-400 bg-white">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`py-3 md:py-4 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 bg-white">
          {calendarDays.map((date, index) => {
            const dateEvents = getEventsForDate(date);
            const isToday = date?.toDateString() === new Date().toDateString();
            return (
              <div 
                key={index} 
                onClick={() => { if(date) { setSelectedDate(date); setShowDetailModal(true); } }}
                className={`h-24 md:h-36 border-r border-b border-gray-100 p-1 md:p-2 flex flex-col items-center transition-all 
                  ${date ? 'cursor-pointer hover:bg-indigo-50/40' : 'bg-gray-50/30'}
                `}
              >
                {date && (
                  <>
                    <span className={`text-xs md:text-[14px] font-black mb-1 md:mb-1.5 w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-all mt-1
                      ${isToday ? 'bg-indigo-600 text-white shadow-md' : date.getDay() === 0 ? 'text-red-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-gray-700'}
                    `}>
                      {date.getDate()}
                    </span>
                    
                    <div className="w-full flex flex-col space-y-[2px] overflow-hidden px-1 text-left">
                      {dateEvents.slice(0, 3).map(event => (
                        <div key={event.id} className="flex items-center gap-1 w-full truncate">
                          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 
                            ${event.type === 'assignment' ? 'bg-rose-500' : event.type === 'personal' ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                          </div>
                          <span className={`text-[9px] md:text-[11px] font-bold truncate 
                            ${event.type === 'assignment' ? 'text-rose-600' : event.type === 'personal' ? 'text-emerald-600' : 'text-amber-700'}`}>
                            {event.title}
                          </span>
                        </div>
                      ))}
                      {dateEvents.length > 3 && (
                        <p className="text-[9px] md:text-[10px] text-gray-400 font-bold text-left pl-2.5 md:pl-3 pt-0.5">
                          외 {dateEvents.length - 3}개
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showDetailModal && !showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-[32px] md:rounded-[40px] w-full max-w-md p-8 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{selectedDate.getMonth()+1}월 {selectedDate.getDate()}일</h2>
                <p className="text-gray-400 font-black text-sm uppercase tracking-widest mt-0.5">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][selectedDate.getDay()]}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openAddModal(selectedDate)} className="bg-indigo-50 text-indigo-600 px-3.5 py-2 rounded-xl font-black text-sm hover:bg-indigo-100 transition-colors shadow-sm">
                  + 일정 추가
                </button>
                <button onClick={() => setShowDetailModal(false)} className="bg-gray-100 p-2.5 rounded-xl text-gray-500 hover:bg-gray-200 transition-colors"><X size={18} /></button>
              </div>
            </div>
            
            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-2 pb-4 scrollbar-hide">
              {getEventsForDate(selectedDate).map(event => (
                <div key={event.id} className={`flex items-center p-4 md:p-5 rounded-[24px] border-2 transition-all 
                  ${event.type === 'assignment' ? 'bg-rose-50/40 border-rose-100' : event.type === 'personal' ? 'bg-emerald-50/40 border-emerald-100' : 'bg-amber-50/40 border-amber-100'}`}>
                  
                  <div className={`p-3.5 rounded-2xl mr-4 shadow-sm 
                    ${event.type === 'assignment' ? 'bg-rose-500 text-white' : event.type === 'personal' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                    {event.type === 'assignment' ? <FileText size={22} /> : event.type === 'personal' ? <Clock size={22} /> : <BookOpen size={22} />}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className={`text-[10px] font-black uppercase tracking-widest 
                      ${event.type === 'assignment' ? 'text-rose-500' : event.type === 'personal' ? 'text-emerald-500' : 'text-amber-600'}`}>{event.label}</p>
                    <h4 className={`font-black truncate text-base md:text-lg mt-0.5 ${event.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{event.title}</h4>
                    <p className="text-xs text-gray-500 font-bold flex items-center mt-1.5"><Clock size={12} className="mr-1.5 text-gray-400" /> {event.time}</p>
                  </div>
                  
                  {(event.type === 'assignment' || event.type === 'personal') && (
                    <button onClick={() => openEditModal(event.raw)} className="ml-2 p-2 bg-white text-gray-400 rounded-xl hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                      <Edit3 size={18} />
                    </button>
                  )}
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-[24px]">
                  <p className="text-gray-400 font-bold">등록된 일정이 없습니다.</p>
                </div>
              )}
            </div>
            <button onClick={() => setShowDetailModal(false)} className="w-full mt-4 bg-[#1a1f2c] text-white py-4 md:py-5 rounded-[20px] font-black shadow-xl hover:bg-slate-800 transition-colors text-base md:text-lg">확인</button>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white rounded-3xl shadow-2xl w-full max-w-[480px] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50/50 shrink-0">
              <h2 className="text-lg font-black text-gray-800">{editingAssignId ? '일정 상세 및 수정' : '새로운 일정 추가'}</h2>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-800 bg-white p-1 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            
            <div className="p-7 space-y-6 overflow-y-auto">
              <div className="flex gap-4">
                <div className="space-y-2 flex-[1]">
                  <label className="text-[13px] font-black text-gray-700 ml-1">과목 지정 (선택)</label>
                  <select className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-[#6b62ff] focus:bg-white rounded-[14px] outline-none text-sm text-gray-800 font-bold transition-all" value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})}>
                    <option value="">개인 일정</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-[1.2]">
                  <label className="text-[13px] font-black text-gray-700 ml-1">일정 일시</label>
                  <input type="datetime-local" required className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-[#6b62ff] focus:bg-white rounded-[14px] outline-none text-sm text-gray-800 font-bold transition-all" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">일정명</label>
                <input required placeholder="일정 제목을 입력하세요" className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-[#6b62ff] focus:bg-white rounded-[14px] outline-none text-sm text-gray-800 placeholder-gray-400 font-bold transition-all" value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">메모 및 내용 (선택)</label>
                <textarea rows={3} placeholder="상세 내용을 입력하세요" className="w-full px-4 py-3.5 bg-gray-50 border border-transparent focus:border-[#6b62ff] focus:bg-white rounded-[14px] outline-none text-sm text-gray-800 placeholder-gray-400 resize-none font-bold transition-all" value={assignForm.description} onChange={e => setAssignForm({...assignForm, description: e.target.value})} />
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[13px] font-black text-gray-700 ml-1">세부 일정 쪼개기 (선택)</label>
                <div className="space-y-2.5">
                  {currentSubTasks.map((task, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-gray-300 font-black text-sm w-5 text-center">{index + 1}.</span>
                      <input placeholder="예: 관련 논문 조사하기" className="flex-1 px-4 py-3 bg-gray-50 border border-transparent focus:border-[#6b62ff] focus:bg-white rounded-[12px] outline-none text-sm text-gray-800 font-bold transition-all" value={task} onChange={(e) => handleSubTaskChange(index, e.target.value)} />
                      <button type="button" onClick={() => handleRemoveSubTask(index)} className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleAddSubTask} className="w-full py-3.5 mt-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-[14px] text-sm font-black hover:bg-gray-50 hover:border-gray-300 transition-all">
                  + 세부 일정 추가
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
              {editingAssignId && (
                <button type="button" onClick={async () => { if(window.confirm('일정을 삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); if(setCoursework){ setCoursework(coursework.filter(a => a.id !== editingAssignId)); }else{ window.location.reload(); } setShowAssignModal(false); } }} className="mr-auto px-5 py-3.5 bg-red-50 text-red-500 rounded-[14px] font-black text-[14px] hover:bg-red-100 transition-colors">삭제</button>
              )}
              <button type="button" onClick={() => setShowAssignModal(false)} className="px-6 py-3.5 bg-white border border-gray-200 text-gray-600 rounded-[14px] font-black text-[14px] hover:bg-gray-50 transition-colors">취소</button>
              <button type="submit" disabled={loading} className="px-8 py-3.5 bg-[#4b44e6] text-white rounded-[14px] font-black text-[14px] shadow-lg hover:bg-indigo-700 transition-colors">{editingAssignId ? '수정 저장하기' : '등록하기'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}