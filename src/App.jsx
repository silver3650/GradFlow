import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, BookOpen, Calendar, User, GraduationCap, Bell } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Coursework from './pages/Coursework';
import CalendarView from './pages/CalendarView';
import Profile from './pages/Profile';
import AuthScreen from './pages/AuthScreen';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 탭 전환 시 최상단 자동 스크롤
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

  const navItems = [
    { id: 'dashboard', label: '홈', icon: <LayoutDashboard size={20} /> },
    { id: 'coursework', label: '과제', icon: <BookOpen size={20} /> },
    { id: 'calendar', label: '캘린더', icon: <Calendar size={20} /> },
    { id: 'profile', label: 'MY', icon: <User size={20} /> },
  ];

  if (isAuthLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-[#6366f1] animate-pulse">GradFlow 로딩 중...</div>;
  if (!session) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><AuthScreen showAlert={showAlert} /></div>;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-left">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-xl font-black tracking-tighter">GradFlow</span>
            <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider mb-0.5">BETA</span>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)} 
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[#5c56e0] text-white shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 모바일 헤더 */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 h-[56px] flex items-center justify-between px-5 z-[50] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#6366f1] p-1.5 rounded-lg shadow-md">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-lg font-black tracking-tighter text-[#1a1f2c]">GradFlow</span>
            <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider mb-0.5">BETA</span>
          </div>
        </div>
        <button className="p-2 text-gray-400"><Bell size={20} /></button>
      </header>

      {/* 메인 영역 */}
      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pt-[72px] md:pt-12 pb-24 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} userProfile={userProfile} setActiveTab={setActiveTab} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} setCoursework={setCoursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} />}
        </div>
      </main>

      {/* 하단 내비바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 flex justify-around items-center py-2 pb-6 px-2 z-[50] shadow-lg">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center min-w-[60px] py-1 transition-all ${activeTab === item.id ? 'text-[#6366f1]' : 'text-gray-300'}`}>
            <div className={`p-1 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-50' : ''}`}>{item.icon}</div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="fixed top-[68px] md:top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-in fade-in zoom-in duration-300">{toast}</div>}
    </div>
  );
}