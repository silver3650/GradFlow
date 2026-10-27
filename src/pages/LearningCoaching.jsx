import React, { useState } from 'react';
import LearningDashboard from '../components/learning/LearningDashboard';
import GeneralStudy from '../components/learning/GeneralStudy';
import BiblicalStudy from '../components/learning/BiblicalStudy';
import { ArrowLeft } from 'lucide-react';

export default function LearningCoaching() {
  // 'dashboard', 'general', 'biblical' 중 하나를 상태로 가짐
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div className="w-full bg-slate-50 min-h-screen px-4 py-6 md:py-8">
      {/* 뷰가 대시보드가 아닐 경우 뒤로가기 버튼 렌더링 */}
      {activeView !== 'dashboard' && (
        <div className="max-w-6xl mx-auto mb-6">
          <button 
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-1.5 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
          >
            <ArrowLeft size={16} /> 대시보드로 돌아가기
          </button>
        </div>
      )}

      {/* 라우팅 로직 */}
      {activeView === 'dashboard' && <LearningDashboard setActiveView={setActiveView} />}
      {activeView === 'general' && <GeneralStudy />}
      {activeView === 'biblical' && <BiblicalStudy />}
    </div>
  );
}