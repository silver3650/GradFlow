import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Ban } from 'lucide-react';

export default function CalendarView({ courses = [], coursework = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  
  const isSameDay = (d1, d2) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
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
      const dayCourses = courses.filter(c => dayMap[c.day_of_week] === date.getDay());
      const dayTasks = coursework.filter(a => isSameDay(a.due_date, date));

      days.push(
        <div key={d} className={`h-24 md:h-32 border-b border-r border-gray-100 p-1 overflow-y-auto cursor-pointer transition-all hover:bg-indigo-50/30`}>
          <div className="flex justify-between items-start">
            <span className={`text-[10px] md:text-xs font-black w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#6366f1] text-white' : 'text-gray-400'}`}>{d}</span>
          </div>
          
          <div className="space-y-1 mt-1">
            {/* 🚀 수업 블록: 휴강 체크 로직 */}
            {dayCourses.map(c => {
              const cancellation = coursework.find(a => 
                a.course_id === c.id && 
                a.category === 'cancellation' && 
                isSameDay(a.due_date, date)
              );

              return (
                <div key={c.id} className={`text-[8px] md:text-[9px] p-1 rounded border truncate flex flex-col leading-tight ${cancellation ? 'bg-red-50 border-red-100 text-red-500 line-through opacity-70' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                  <span className="font-bold">{c.name} {cancellation ? '(휴강)' : ''}</span>
                  <span className="opacity-70">{c.start_time?.slice(0,5)}</span>
                </div>
              );
            })}

            {/* 과제 및 일정 */}
            {dayTasks.filter(a => a.category !== 'cancellation').map(a => (
              <div key={a.id} className={`text-[8px] md:text-[9px] p-1 rounded border truncate font-bold ${a.category === 'assignment' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                {a.title}
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
      <div className="p-6 flex justify-between items-center border-b border-gray-50 bg-white">
        <h2 className="text-xl font-black text-gray-900">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18} /></button>
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="p-2 md:p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-t border-l border-gray-100 rounded-lg overflow-hidden">
          {['일','월','화','수','목','금','토'].map((d, i) => <div key={d} className={`py-3 text-center text-[10px] font-black bg-gray-50 border-b border-r text-gray-400 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}`}>{d}</div>)}
          {renderDays()}
        </div>
      </div>
    </div>
  );
}