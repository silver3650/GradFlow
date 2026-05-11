import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, BookOpen, Calendar, User, GraduationCap, Bell, ShieldCheck } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Coursework from './pages/Coursework';
import CalendarView from './pages/CalendarView';
import Profile from './pages/Profile';
import AuthScreen from './pages/AuthScreen';
import AdminDashboard from './pages/AdminDashboard'; // 🚀 관리자 페이지 추가

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState([]);
  const [coursework, setCoursework] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [toast, setToast] = useState('');
  
  const [providerToken, setProviderToken] = useState(localStorage.getItem('google_provider_token') || null);
  
  const mainContentRef = useRef(null);

  const showAlert = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        setProviderToken(session.provider_token);
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      setIsAuthLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.provider_token) {
        setProviderToken(session.provider_token);
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      if (event === 'SIGNED_OUT') {
        setProviderToken(null);
        localStorage.removeItem('google_provider_token');
        setUserProfile({}); // 로그아웃 시 프로필 초기화
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [activeTab]);

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

  // 🚀 기본 네비게이션 아이템
  const navItems = [
    { id: 'dashboard', label: '홈', icon: <LayoutDashboard size={20} /> },
    { id: 'coursework', label: '과제', icon: <BookOpen size={20} /> },
    { id: 'calendar', label: '캘린더', icon: <Calendar size={20} /> },
    { id: 'profile', label: 'MY', icon: <User size={20} /> },
  ];

  // 🚀 관리자 권한이 있을 경우 '관리' 탭 추가
  if (userProfile?.is_admin) {
    navItems.push({ id: 'admin', label: '관리', icon: <ShieldCheck size={20} className="text-red-400" /> });
  }

  if (isAuthLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-[#6366f1] animate-pulse">GradFlow 로딩 중...</div>;
  if (!session) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><AuthScreen showAlert={showAlert} /></div>;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-left">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl shadow-lg shadow-indigo-500/20"><GraduationCap size={24} className="text-white" /></div>
          <span className="text-xl font-black tracking-tighter">GradFlow</span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)} 
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${
                activeTab === item.id 
                  ? 'bg-[#5c56e0] text-white shadow-lg' 
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 모바일 헤더 */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 h-[56px] flex items-center justify-between px-5 z-[50] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#6366f1] p-1.5 rounded-lg shadow-md"><GraduationCap size={18} className="text-white" /></div>
          <span className="text-lg font-black tracking-tighter text-[#1a1f2c]">GradFlow</span>
        </div>
        <button className="p-2 text-gray-400"><Bell size={20} /></button>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pt-[72px] md:pt-12 pb-20 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} setCoursework={setCoursework} userProfile={userProfile} setActiveTab={setActiveTab} providerToken={providerToken} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} setCoursework={setCoursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} setActiveTab={setActiveTab} />}
          
          {/* 🚀 관리자 페이지 렌더링 (is_admin 확인 후 노출) */}
          {activeTab === 'admin' && userProfile?.is_admin && <AdminDashboard />}
        </div>
      </main>

      {/* 모바일 하단 네비게이션 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 flex justify-around items-center py-1.5 px-2 z-[50] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        {navItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveTab(item.id)} 
            className={`flex flex-col items-center justify-center min-w-[60px] py-1 transition-all ${
              activeTab === item.id ? 'text-[#6366f1]' : 'text-gray-300'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-50' : ''}`}>{item.icon}</div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 토스트 알림 */}
      {toast && <div className="fixed top-[68px] md:top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-in fade-in zoom-in duration-300">{toast}</div>}
    </div>
  );
}