import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Brain, FileText, Folder, Play, Repeat, ChevronRight, BookOpen, Globe, Plus, Loader2 } from 'lucide-react';

export default function DashboardHome({ onNavigate }) {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🚀 과목 상태 필터링 State 추가 (기본값: 'in_progress')
  const [courseStatusFilter, setCourseStatusFilter] = useState('in_progress');

  // 실제 DB 연동 통계
  const stats = {
    todayReviews: 0,
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Coursework의 과목 데이터(courses 테이블) 로드
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("과목 불러오기 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 선택된 상태값에 맞춰 과목 필터링
  const filteredCourses = courses.filter(c => (c.status || 'in_progress') === courseStatusFilter);

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300 space-y-8 pb-10">
      
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">학습코칭 대시보드</h1>
          <p className="text-slate-400 text-sm">오늘도 효율적인 인출 훈련으로 학습을 완성하세요.</p>
        </div>
        {stats.todayReviews > 0 && (
          <button 
            onClick={() => onNavigate('general')}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 px-4 py-2.5 rounded-2xl transition-colors shadow-sm"
          >
            <Repeat size={16} />
            <span className="font-bold text-sm">오늘의 오답 복습 {stats.todayReviews}건</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => onNavigate('general')}
          className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 p-6 rounded-3xl cursor-pointer transition-all group flex flex-col justify-between h-40"
        >
          <div className="flex justify-between items-start">
            <div className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-sm"><FileText size={24}/></div>
            <ChevronRight className="text-emerald-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-emerald-900 mb-1">일반 과목 학습</h2>
            <p className="text-xs text-emerald-700 font-medium">뼈대 구조화 및 백지 논술 훈련</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('biblical')}
          className="bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 p-6 rounded-3xl cursor-pointer transition-all group flex flex-col justify-between h-40"
        >
          <div className="flex justify-between items-start">
            <div className="bg-indigo-500 text-white p-2.5 rounded-xl shadow-sm"><Globe size={24}/></div>
            <ChevronRight className="text-indigo-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-indigo-900 mb-1">성서 원어 훈련</h2>
            <p className="text-xs text-indigo-700 font-medium">형태소 파싱 및 원어 단어장</p>
          </div>
        </div>
      </div>

      <div>
        {/* 🚀 상단 과목 필터링 토글 메뉴 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-2">
            <Folder className="text-slate-400" size={18} />
            <h3 className="text-sm font-bold text-slate-800">과목별 보관함 <span className="text-slate-400 font-medium ml-1 text-xs">(과제 탭 자동 연동)</span></h3>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
            {['in_progress', 'completed', 'incomplete'].map(s => (
              <button
                key={s}
                onClick={() => setCourseStatusFilter(s)}
                className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${courseStatusFilter === s ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                {s === 'in_progress' ? '수강중' : s === 'completed' ? '이수' : '미이수'}
              </button>
            ))}
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="animate-spin text-slate-300" size={32}/></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filteredCourses.map(course => {
              const isBiblical = course.name.includes('원어') || course.name.includes('헬라어') || course.name.includes('히브리어');
              return (
                <div 
                  key={course.id} 
                  onClick={() => onNavigate(isBiblical ? 'biblical' : 'general')}
                  className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-start gap-3"
                >
                  <div className={`p-2 rounded-lg ${isBiblical ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {isBiblical ? <Globe size={16}/> : <BookOpen size={16}/>}
                  </div>
                  <div className="w-full">
                    <h4 className="font-bold text-slate-800 text-sm mb-0.5 truncate">{course.name}</h4>
                    <div className="text-[10px] text-slate-400 font-bold">{course.professor ? `${course.professor} 교수` : '일반과목'}</div>
                  </div>
                </div>
              );
            })}

            {filteredCourses.length === 0 && (
              <div 
                className="col-span-full border-2 border-dashed border-slate-200 p-6 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors min-h-[120px]"
              >
                <BookOpen size={24} className="mb-2 text-slate-300" />
                <span className="text-xs font-bold text-center">해당 상태로 등록된 과목이 없습니다.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}