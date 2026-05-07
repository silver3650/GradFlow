import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Plus, X, Clock, BookOpen, FileText, Edit3, Trash2, Ban, Sparkles
} from 'lucide-react';

export default function CalendarView({ courses = [], coursework = [], setCoursework }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssignId, setEditingAssignId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 폼 초기값: description(내용) 필드 추가
  const initialAssignForm = { 
    title: '', 
    due_date: '', 
    course_id: '', 
    description: '', 
    sub_tasks: [''], 
    category: 'schedule' 
  };
  const [assignForm, setAssignForm] = useState(initialAssignForm);

  const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };

  // 🚀 날짜 비교 헬퍼 함수
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // 날짜 클릭 시 핸들러
  const handleDateClick = (date) => {
    setSelectedDate(date);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setAssignForm({ ...initialAssignForm, due_date: localDate });
  };

  // 🚀 저장 로직: 개인 일정 자동 분류 및 휴강 제목 처리
  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    let finalCategory = assignForm.category;
    let finalTitle = assignForm.title;

    // 1. 과목이 선택되지 않으면 무조건 '일반 일정'으로 분류 (과제 건수 제외용)
    if (!assignForm.course_id) {
      finalCategory = 'schedule';
    } 
    // 2. 휴강 설정 시 제목을 '과목명-휴강'으로 자동 생성
    else if (assignForm.category === 'cancellation') {
      const courseName = courses.find(c => c.id === assignForm.course_id)?.name || '';
      finalTitle = `${courseName}-휴강`;
    }

    const payload = {
      ...assignForm,
      title: finalTitle,
      category: finalCategory,
      due_date: new Date(assignForm.due_date).toISOString(),
      user_id: user.id,
      sub_tasks: assignForm.sub_tasks.filter(t => t.trim() !== '')
    };

    let res;
    if (editingAssignId) {
      res = await supabase.from('assignments').update(payload).eq('id', editingAssignId).select();
    } else {
      res = await supabase.from('assignments').insert([payload]).select();
    }

    if (!res.error) {
      if (setCoursework) {
        setCoursework(editingAssignId 
          ? coursework.map(a => a.id === editingAssignId ? res.data[0] : a)
          : [...coursework, res.data[0]]
        );
      }
      setShowAssignModal(false);
      setEditingAssignId(null);
    }
    setLoading(false);
  };

  const openEditModal = (a) => {
    setEditingAssignId(a.id);
    const localTime = new Date(new Date(a.due_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setAssignForm({ ...a, due_date: localTime, sub_tasks: a.sub_tasks || [''] });
    setShowAssignModal(true);
  };

  const renderDays = () => {
    const days = [];
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    for (let i = 0; i < start.getDay(); i++) {
      days.push(<div key={`empty-${i}`} className="h-24 md:h-32 border-b border-r border-gray-50 bg-gray-50/30" />);
    }

    for (let d = 1; d <= end.getDate(); d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const isToday = isSameDay(date, new Date());
      const isSelected = isSameDay(date, selectedDate);
      
      const dayCourses = courses.filter(c => dayMap[c.day_of_week] === date.getDay());
      const dayAssignments = coursework.filter(a => isSameDay(a.due_date, date));

      days.push(
        <div 
          key={d} 
          onClick={() => handleDateClick(date)}
          className={`h-24 md:h-32 border-b border-r border-gray-100 p-1 overflow-y-auto cursor-pointer transition-all hover:bg-indigo-50/30 ${isSelected ? 'bg-indigo-50/50' : ''}`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10px] md:text-xs font-black w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#6366f1] text-white shadow-md' : 'text-gray-400'}`}>{d}</span>
          </div>
          
          <div className="space-y-1 mt-1">
            {/* 🚀 수업 블록: 해당 날짜에 '휴강' 데이터가 있는지 확인하여 표시 변경 */}
            {dayCourses.map(c => {
              const cancellation = coursework.find(a => 
                a.course_id === c.id && 
                a.category === 'cancellation' && 
                isSameDay(a.due_date, date)
              );

              return (
                <div key={c.id} className={`text-[8px] md:text-[9px] p-1 rounded-md border truncate flex flex-col leading-tight ${cancellation ? 'bg-red-50 border-red-100 text-red-500 line-through opacity-70' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                  <span className="font-bold">{c.name} {cancellation ? '(휴강)' : ''}</span>
                  <span className="opacity-70">{c.start_time?.slice(0,5)}</span>
                </div>
              );
            })}

            {/* 과제/일정 표시 (휴강 데이터는 위에서 처리했으므로 제외) */}
            {dayAssignments.filter(a => a.category !== 'cancellation').map(a => (
              <div 
                key={a.id} 
                onClick={(e) => { e.stopPropagation(); openEditModal(a); }}
                className={`text-[8px] md:text-[9px] p-1 rounded-md border truncate font-bold ${a.category === 'assignment' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-green-50 border-green-100 text-green-700'}`}
              >
                {a.category === 'assignment' ? '📝 ' : '📅 '}{a.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      {/* 헤더 부분 */}
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-all"><ChevronLeft size={18} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-[11px] font-black text-gray-500 hover:text-[#6366f1]">오늘</button>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition-all"><ChevronRight size={18} /></button>
          </div>
        </div>
        <button 
          onClick={() => { setEditingAssignId(null); setAssignForm({ ...initialAssignForm, due_date: new Date().toISOString().slice(0, 16) }); setShowAssignModal(true); }}
          className="bg-[#1a1f2c] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} /> 일정/휴강 등록
        </button>
      </div>

      {/* 캘린더 본체 */}
      <div className="p-2 md:p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-t border-l border-gray-100 rounded-lg overflow-hidden shadow-sm">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className={`py-3 text-center text-[11px] font-black bg-gray-50 border-b border-r border-gray-100 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
          {renderDays()}
        </div>
      </div>

      {/* 🚀 일정/과제/휴강 등록 모달 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAssignment} className="bg-white w-full max-w-[480px] rounded-[32px] p-8 space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl text-left">
            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
              <h2 className="text-xl font-black text-gray-900">상세 정보 등록</h2>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 ml-1">날짜 및 시간</label>
                  <input type="datetime-local" required className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={assignForm.due_date} onChange={e => setAssignForm({...assignForm, due_date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 ml-1">분류</label>
                  <select 
                    className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm border-none outline-none transition-all ${assignForm.category === 'cancellation' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}
                    value={assignForm.category} 
                    onChange={e => setAssignForm({...assignForm, category: e.target.value})}
                  >
                    <option value="schedule">📅 일반 일정 (건수 미포함)</option>
                    <option value="assignment">📝 과제 등록 (건수 포함)</option>
                    <option value="cancellation">🚨 휴강 설정 (건수 미포함)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 ml-1">과목 선택 (선택 사항)</label>
                <select className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})}>
                  <option value="">과목 없음 (개인 일정)</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 ml-1">제목</label>
                <input 
                  required 
                  disabled={assignForm.category === 'cancellation'}
                  placeholder={assignForm.category === 'cancellation' ? "휴강 설정 시 과목명이 제목이 됩니다." : "제목을 입력하세요."}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl font-bold text-sm border-none outline-none focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50" 
                  value={assignForm.title} 
                  onChange={e => setAssignForm({...assignForm, title: e.target.value})} 
                />
              </div>

              {/* 🚀 과제(일정) 내용 필드 */}
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 ml-1">과제(일정) 내용</label>
                <textarea className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl font-bold text-sm border-none outline-none min-h-[80px] resize-none focus:ring-2 focus:ring-indigo-100 transition-all" value={assignForm.description} onChange={e => setAssignForm({...assignForm, description: e.target.value})} placeholder="상세 정보를 입력하세요." />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 ml-1 flex items-center gap-2"><Sparkles size={16} className="text-[#6366f1]" /> AI 세부 체크리스트</label>
                {(assignForm.sub_tasks || []).map((task, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold border-none outline-none" value={task} onChange={(e) => {
                      const nt = [...assignForm.sub_tasks];
                      nt[idx] = e.target.value;
                      setAssignForm({...assignForm, sub_tasks: nt});
                    }} />
                    <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: assignForm.sub_tasks.filter((_, i) => i !== idx)})} className="text-gray-300 hover:text-red-400"><Trash2 size={18}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => setAssignForm({...assignForm, sub_tasks: [...(assignForm.sub_tasks || []), '']})} className="w-full py-3 border-2 border-dashed border-gray-100 text-gray-400 rounded-2xl text-[11px] font-black hover:bg-gray-50">+ 항목 추가</button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingAssignId && (
                <button type="button" onClick={async () => { if(window.confirm('삭제할까요?')) { await supabase.from('assignments').delete().eq('id', editingAssignId); if(setCoursework) setCoursework(coursework.filter(a => a.id !== editingAssignId)); setShowAssignModal(false); } }} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm hover:bg-red-100">삭제</button>
              )}
              <button type="submit" disabled={loading} className="flex-1 py-4 bg-[#6366f1] text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                {loading ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}