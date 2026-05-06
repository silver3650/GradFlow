import React, { useState } from 'react';
import { User, ShieldCheck, LogOut, Settings, Calendar, BookOpen } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Profile({ userProfile = {}, showAlert }) {
  // 연동 상태 관리
  const [isGoogleLinked, setIsGoogleLinked] = useState(true);
  const [isLmsLinked, setIsLmsLinked] = useState(false);

  // ✅ 로그아웃 처리 함수 (SPA 방식)
  const handleLogout = async () => {
    try {
      // signOut만 호출하면 App.jsx의 onAuthStateChange가 감지하여 자동으로 AuthScreen을 렌더링합니다.
      await supabase.auth.signOut();
    } catch (error) {
      if (showAlert) showAlert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const toggleGoogle = () => {
    setIsGoogleLinked(!isGoogleLinked);
    if (showAlert) showAlert(!isGoogleLinked ? '✅ Google Workspace 연동이 활성화되었습니다.' : 'Google 연동이 해제되었습니다.');
  };

  const toggleLms = () => {
    setIsLmsLinked(!isLmsLinked);
    if (showAlert) showAlert(!isLmsLinked ? '✅ 학교 LMS 과제 수집이 활성화되었습니다.' : '학교 LMS 연동이 해제되었습니다.');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left font-sans">
      <div>
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">MY</h1>
        <p className="text-gray-500 font-medium">내 프로필 정보 및 연동 설정을 관리합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 프로필 카드[cite: 6] */}
        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-50 to-white -z-10"></div>
          
          <div className="w-24 h-24 bg-white shadow-md text-indigo-600 rounded-full flex items-center justify-center mb-6 mt-4">
            <User size={48} />
          </div>
          <h2 className="text-2xl font-black text-gray-900">{userProfile.nickname || '연구자'}</h2>
          <p className="text-gray-400 font-bold mb-6">{userProfile.real_name || '대학원생'}</p>
          
          <div className="bg-green-50 text-green-600 px-4 py-2.5 rounded-full text-xs font-black flex items-center mb-8 shadow-sm">
            <ShieldCheck size={16} className="mr-2" /> 대학원생 인증됨
          </div>
          
          {/* ✅ 로그아웃 버튼 */}
          <button 
            onClick={handleLogout} 
            className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all shadow-sm"
          >
            <LogOut size={18} /> 로그아웃
          </button>
        </div>

        {/* 설정 영역 */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center">
              <Settings className="mr-3 text-indigo-500" size={20} /> 외부 서비스 연동
            </h3>
            
            <div className="space-y-4">
              {/* Google 연동 블록 */}
              <div className={`flex justify-between items-center p-4 md:p-5 rounded-2xl border transition-all duration-300 ${isGoogleLinked ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-gray-100'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl transition-colors ${isGoogleLinked ? 'bg-indigo-500 text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800">Google Workspace</p>
                    <p className={`text-[11px] md:text-xs mt-0.5 ${isGoogleLinked ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                      {isGoogleLinked ? '캘린더, 클래스룸 연동 활성화' : '연동이 필요합니다'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={toggleGoogle}
                  className={`text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-sm ${isGoogleLinked ? 'bg-white text-gray-500 border border-gray-100 hover:text-red-500' : 'bg-[#5c56e0] text-white hover:bg-indigo-700'}`}
                >
                  {isGoogleLinked ? '연동 해제' : '연동하기'}
                </button>
              </div>

              {/* 학교 LMS 연동 블록 */}
              <div className={`flex justify-between items-center p-4 md:p-5 rounded-2xl border transition-all duration-300 ${isLmsLinked ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-gray-100'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl transition-colors ${isLmsLinked ? 'bg-indigo-500 text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800">학교 LMS 시스템</p>
                    <p className={`text-[11px] md:text-xs mt-0.5 ${isLmsLinked ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                      {isLmsLinked ? '과제 자동 수집 활성화' : '연동이 필요합니다'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={toggleLms}
                  className={`text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-sm ${isLmsLinked ? 'bg-white text-gray-500 border border-gray-100 hover:text-red-500' : 'bg-[#5c56e0] text-white hover:bg-indigo-700'}`}
                >
                  {isLmsLinked ? '연동 해제' : '연동하기'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}