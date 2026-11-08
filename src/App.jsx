import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { LayoutDashboard, BookOpen, Calendar, User, GraduationCap, Bell, Brain, MessageCircle } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Coursework from './pages/Coursework';
import CalendarView from './pages/CalendarView';
import Profile from './pages/Profile';
import AuthScreen from './pages/AuthScreen';
import AdminDashboard from './pages/AdminDashboard'; 

import DashboardHome from './components/learning/LearningDashboard'; 
import GeneralStudy from './components/learning/GeneralStudy';
import BiblicalStudy from './components/learning/BiblicalStudy';

import CommunicationModal from './components/modals/CommunicationModal'; 

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

  const [showCommModal, setShowCommModal] = useState(false);
  const [hasNewComm, setHasNewComm] = useState(false); 

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
    if (session) {
      fetchAllData();
      checkNewCommunications(); 
    }
  }, [session]);

  const checkNewCommunications = async () => {
    if (!session?.user) return;
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: notices } = await supabase
        .from('announcements')
        .select('id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(1);

      const { data: inquiries } = await supabase
        .from('inquiries')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'answered')
        .limit(1);

      if ((notices && notices.length > 0) || (inquiries && inquiries.length > 0)) {
        setHasNewComm(true);
      }
    } catch (error) {
      console.error("알림 체크 실패:", error);
    }
  };

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
        
        <button 
          onClick={() => {
            setShowCommModal(true);
            setHasNewComm(false); 
          }} 
          className="relative p-2 text-slate-400 hover:text-indigo-500 transition-colors"
        >
          <MessageCircle size={22} />
          {hasNewComm && (
             <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 border-2 border-white rounded-full"></span>
          )}
        </button>
      </header>

      {/* 🚀 데스크탑용 소통 라운지 버튼 (우측 상단 뷰포트 고정 배치로 겹침 완전 방지) */}
      <div className="hidden md:block fixed top-6 right-8 z-[60]">
        <button 
          onClick={() => {
            setShowCommModal(true);
            setHasNewComm(false);
          }} 
          className="relative p-3 bg-white rounded-full shadow-md border border-slate-200 text-slate-400 hover:text-indigo-500 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          title="공지사항 및 1:1 문의"
        >
          <MessageCircle size={24} />
          {hasNewComm && (
             <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-rose-500 border-[2px] border-white rounded-full"></span>
          )}
        </button>
      </div>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pt-[72px] md:pt-12 pb-20 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto w-full h-full relative">
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} setCoursework={setCoursework} userProfile={userProfile} setActiveTab={setActiveTab} providerToken={providerToken} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} setCoursework={setCoursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} setActiveTab={setActiveTab} />}
          {activeTab === 'admin' && <AdminDashboard setActiveTab={setActiveTab} />}

          {activeTab === 'learning_dashboard' && <DashboardHome onNavigate={(target) => setActiveTab(`learning_${target}`)} />}
          {activeTab === 'learning_general' && (
            <GeneralStudy 
              onBack={() => setActiveTab('learning_dashboard')} 
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'learning_biblical' && (
            <BiblicalStudy 
              onBack={() => setActiveTab('learning_dashboard')} 
              onNavigate={setActiveTab}
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
      
      {showCommModal && <CommunicationModal onClose={() => setShowCommModal(false)} />}
    </div>
  );
}