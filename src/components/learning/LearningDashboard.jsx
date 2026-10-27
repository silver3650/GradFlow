import React from 'react';
import { Brain, FileText, Folder, Play, Repeat, ChevronRight, BookOpen, Globe, Plus } from 'lucide-react';

export default function DashboardHome({ onNavigate }) {
  // 실제 DB와 연동 시 상태값으로 대체될 더미 데이터입니다.
  const stats = {
    generalTasks: 12,
    biblicalVocab: 45,
    todayReviews: 3,
  };

  const folders = [
    { id: 1, title: '구약개론', count: 8, type: 'general' },
    { id: 2, title: '신약개론', count: 4, type: 'general' },
    { id: 3, title: '헬라어', count: 32, type: 'biblical' },
    { id: 4, title: '히브리어', count: 13, type: 'biblical' },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300 space-y-8 pb-10">
      
      {/* 1. 상단: 환영 인사 및 투데이 리마인더 */}
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

      {/* 2. 중단: 핵심 워크플로우 (빠른 시작) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 일반 과목 학습 버튼 */}
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

        {/* 성서 원어 훈련 버튼 */}
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

      {/* 3. 하단: 과목별 폴더 라이브러리 */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <Folder className="text-slate-400" size={18} />
          <h3 className="text-sm font-bold text-slate-800">과목별 보관함</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {folders.map(folder => (
            <div 
              key={folder.id} 
              onClick={() => onNavigate(folder.type)}
              className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-slate-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-start gap-3"
            >
              <div className={`p-2 rounded-lg ${folder.type === 'general' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {folder.type === 'general' ? <BookOpen size={16}/> : <Brain size={16}/>}
              </div>
              <div className="w-full">
                <h4 className="font-bold text-slate-800 text-sm mb-0.5 truncate">{folder.title}</h4>
                <div className="text-xs text-slate-400 font-medium">{folder.count}개의 항목</div>
              </div>
            </div>
          ))}

          {/* 새 과목 추가 버튼 */}
          <div 
            onClick={() => alert("새 과목 추가 기능은 준비 중입니다.")}
            className="border-2 border-dashed border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer min-h-[100px]"
          >
            <Plus size={20} className="mb-1" />
            <span className="text-xs font-bold">새 과목 추가</span>
          </div>
        </div>
      </div>
    </div>
  );
}