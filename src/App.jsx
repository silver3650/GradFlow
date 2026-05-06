import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, BookOpen, Calendar, User, GraduationCap } from 'lucide-react';

// 페이지 및 컴포넌트 임포트 (경로에 맞게 확인해주세요)
import Dashboard from './pages/Dashboard';
import Coursework from './pages/Coursework';
import CalendarView from './pages/CalendarView';
import Profile from './pages/Profile';
import AuthScreen from './pages/AuthScreen'; // ✅ 인증 화면 임포트 추가

export default function App() {
  const [session, setSession] = useState(null); // ✅ 로그인 세션 상태 관리
  const [isAuthLoading, setIsAuthLoading] = useState(true); // ✅ 초기 로딩 상태
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState([]);
  const [coursework, setCoursework] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [toast, setToast] = useState('');
  
  const mainContentRef = useRef(null);

  const showAlert = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ✅ 1. 앱 실행 시 로그인 상태 확인 및 실시간 감지
  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });

    // 로그인/로그아웃 상태 변화 실시간 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 탭 이동 시 스크롤 최상단 이동[cite: 1]
  useEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [activeTab]);

  // ✅ 2. 세션이 있을 때만 데이터를 불러오도록 수정
  const fetchAllData = async () => {
    if (!session?.user) return;

    try {
      const [pRes, cRes, aRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('courses').select('*').eq('user_id', session.user.id),
        supabase.from('assignments').select('*').eq('user_id', session.user.id)
      ]);

      if (pRes.data) setUserProfile(pRes.data);
      setCourses(cRes.data || []);
      setCoursework(aRes.data || []);
    } catch (err) { console.error("Data error:", err.message); }
  };

  useEffect(() => {
    if (session) fetchAllData();
  }, [session]);

  const navItems = [
    { id: 'dashboard', label: '홈', icon: <LayoutDashboard size={22} /> },
    { id: 'coursework', label: '과제', icon: <BookOpen size={22} /> },
    { id: 'calendar', label: '캘린더', icon: <Calendar size={22} /> },
    { id: 'profile', label: 'MY', icon: <User size={22} /> },
  ];

  // ✅ 3. 로딩 중 화면 처리
  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-indigo-500 animate-pulse">GradFlow 로딩 중...</div>;
  }

  // ✅ 4. 로그인하지 않은 상태면 AuthScreen만 렌더링
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <AuthScreen showAlert={showAlert} />
      </div>
    );
  }

  // ✅ 5. 로그인 성공 시 메인 레이아웃 렌더링[cite: 1]
  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl"><GraduationCap size={24} /></div>
          <span className="text-xl font-black italic">GradFlow</span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[#5c56e0] text-white shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pb-28 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} userProfile={userProfile} setActiveTab={setActiveTab} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} />}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center pt-3 pb-8 px-2 z-50 shadow-lg">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center min-w-[64px] ${activeTab === item.id ? 'text-[#5c56e0]' : 'text-gray-300'}`}>
            <div className={`p-1 rounded-xl ${activeTab === item.id ? 'bg-indigo-50' : ''}`}>{item.icon}</div>
            <span className="text-[10px] font-bold mt-1">{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold">{toast}</div>}
    </div>
  );
}