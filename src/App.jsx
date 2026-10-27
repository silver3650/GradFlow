import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, BookOpen, Calendar, User, GraduationCap, Bell, Brain } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Coursework from './pages/Coursework';
import CalendarView from './pages/CalendarView';
import Profile from './pages/Profile';
import AuthScreen from './pages/AuthScreen';
import AdminDashboard from './pages/AdminDashboard'; // 관리자 컴포넌트 추가

// 🚀 분리된 학습 코칭 컴포넌트들 불러오기
import DashboardHome from './components/learning/LearningDashboard'; // 대시보드 홈 (기존 내용 유지)
import GeneralStudy from './components/learning/GeneralStudy';
import BiblicalStudy from './components/learning/BiblicalStudy';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // 🚀 모든 탭과 하위 뷰를 하나의 상태(activeTab)로 통일하여 관리합니다.
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
        setUserProfile({});
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

  // 학습코칭 탭 버튼을 눌렀을 때 항상 대시보드 홈으로 가도록 설정
  const handleNavClick = (id) => {
    if (id === 'learning') {
      setActiveTab('learning_dashboard');
    } else {
      setActiveTab(id);
    }
  };

  const navItems = [
    { id: 'dashboard', label: '홈', icon: <LayoutDashboard size={22} /> },
    { id: 'coursework', label: '과제', icon: <BookOpen size={22} /> },
    { id: 'calendar', label: '캘린더', icon: <Calendar size={22} /> },
    { id: 'learning', label: '학습코칭', icon: <Brain size={22} /> },
    { id: 'profile', label: 'MY', icon: <User size={22} /> },
  ];

  if (isAuthLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-[#6366f1] animate-pulse">GradFlow 로딩 중...</div>;
  if (!session) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><AuthScreen showAlert={showAlert} /></div>;

  // 학습코칭 하위 메뉴인지 판단
  const isLearningTab = activeTab.startsWith('learning');

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-left">
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl shadow-lg shadow-indigo-500/20"><GraduationCap size={24} className="text-white" /></div>
          <span className="text-xl font-black tracking-tighter">GradFlow</span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => handleNavClick(item.id)} 
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${
                (activeTab === item.id || (item.id === 'learning' && isLearningTab))
                  ? 'bg-[#5c56e0] text-white shadow-lg' 
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 h-[56px] flex items-center justify-between px-5 z-[50] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#6366f1] p-1.5 rounded-lg shadow-md"><GraduationCap size={18} className="text-white" /></div>
          <span className="text-lg font-black tracking-tighter text-[#1a1f2c]">GradFlow</span>
        </div>
        <button className="p-2 text-gray-400"><Bell size={20} /></button>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pt-[72px] md:pt-12 pb-20 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto w-full h-full relative">
          
          {/* 🚀 통합 라우팅 스위치 영역 */}
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} setCoursework={setCoursework} userProfile={userProfile} setActiveTab={setActiveTab} providerToken={providerToken} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} setCoursework={setCoursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} setActiveTab={setActiveTab} />}
          {activeTab === 'admin' && <AdminDashboard setActiveTab={setActiveTab} />}

          {/* 학습 코칭 관련 뷰들 */}
          {activeTab === 'learning_dashboard' && <DashboardHome onNavigate={(target) => setActiveTab(`learning_${target}`)} />}
          {activeTab === 'learning_general' && (
            <GeneralStudy 
              onBack={() => setActiveTab('learning_dashboard')} 
              onNavigate={setActiveTab} // 🚀 이 줄을 추가하세요!
            />
          )}
          {activeTab === 'learning_biblical' && (
            <BiblicalStudy 
              onBack={() => setActiveTab('learning_dashboard')} 
              onNavigate={setActiveTab} // 🚀 이 줄을 추가하세요!
            />
          )}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 flex justify-between items-center py-2 px-1 z-[50] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => handleNavClick(item.id)} 
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
              (activeTab === item.id || (item.id === 'learning' && isLearningTab)) ? 'text-[#6366f1]' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${ (activeTab === item.id || (item.id === 'learning' && isLearningTab)) ? 'bg-indigo-50' : ''}`}>
              {React.cloneElement(item.icon, { size: 20 })}
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tighter whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="fixed top-[68px] md:top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-in fade-in zoom-in duration-300">{toast}</div>}
    </div>
  );
}