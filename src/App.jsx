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
      
      {/* 💻 데스크톱 사이드바: 로고 우측 라틴어 BETA 표기 추가 */}
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-xl font-black tracking-tighter leading-none">GradFlow</span>
            {/* 라틴어 'BETA' 표기 (작고 강조된 스타일) */}
            <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider mb-0.5">BETA</span>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[#5c56e0] text-white shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>
              ```jsx
import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, BookOpen, CalendarDays, 
  X, Edit3, Clock, Hash, Trash2, Sparkles, RefreshCw, CheckCircle2, Calendar as CalendarIcon, Ban
} from 'lucide-react';

export default function Coursework({ courses = [], setCourses, coursework = [], setCoursework, showAlert }) {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCoursework = Array.isArray(coursework) ? coursework : [];

  const [courseStatusFilter, setCourseStatusFilter] = useState('in_progress'); 
  const [assignFilter, setAssignFilter] = useState('incomplete'); 
  
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingAssignId, setEditingAssignId] = useState(null);

  const initialCourseForm = { 
    name: '', professor: '', day_of_week: '월요일', 
    status: 'in_progress', start_date: '2026-03-02', end_date: '2026-06-20',
    start_time: '09:00', end_time: '10:30'
  };
  
  const initialAssignForm = { 
    title: '', due_date: '', course_id: '', is_completed: false,
    description: '', sub_tasks: [''], category: 'assignment' 
  };
  
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [assignForm, setAssignForm] = useState(initialAssignForm);

  // 마감 임박순 정렬 로직 (카테고리가 'assignment'이거나 null인 경우만 합산)
  const getDDayValue = (date) => {
    if (!date) return 9999999999999;
    return new Date(date).getTime();
  };

  const getDDayLabel = (date) => {
    if (!date) return '';
    const diff = Math.ceil((new Date(date) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`;
  };

  const sortedCoursesForSummary = useMemo(() => {
    return safeCourses
      .filter(c => (c?.status || 'in_progress') === courseStatusFilter)
      .sort((a, b) => {
        const aTasks = safeCoursework.filter(cw => cw?.course_id === a?.id && !cw?.is_completed && (cw?.category === 'assignment' || !cw?.category));
        const bTasks = safeCoursework.filter(cw => cw?.course_id === b?.id && !cw?.is_completed && (cw?.category === 'assignment' || !cw?.category));
        const aMin = aTasks.length > 0 ? Math.min(...aTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        const bMin = bTasks.length > 0 ? Math.min(...bTasks.map(cw => getDDayValue(cw?.due_date))) : Infinity;
        return aMin - bMin;
      });
  }, [safeCourses, safeCoursework, courseStatusFilter]);

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...courseForm, user_id: user.id };
    const res = editingCourseId 
      ? await supabase.from('courses').update(payload).eq('id', editingCourseId).select()
      : await supabase.from('courses').insert([payload]).select();
    if (!res.error) { setCourses(editingCourseId ? safeCourses.map(c => c.id === editingCourseId ? res.data[0] : c) : [...safeCourses, res.data[0]]); setShowCourseModal(false); }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...assignForm, due_date: new Date(assignForm.due_date).toISOString(), sub_tasks: assignForm.sub_tasks.filter(t => t && t.trim() !== ''), user_id: user.id };
    const res = editingAssignId 
      ? await supabase.from('assignments').update(payload).eq('id', editingAssignId).select()
      : await supabase.from('assignments').insert([payload]).select();
    if (!res.error) { setCoursework(editingAssignId ? safeCoursework.map(a => a.id === editingAssignId`App.jsx`에서 사이드바와 모바일 헤더의 **GradFlow** 로고 우측에 작고 굵은 서식의 라틴어 **BETA** 표기를 추가하여 요청하신 디자인을 적용했습니다. Non-italic 로고, 최상단 스크롤, 마감 임박순 정렬 및 필터링 등의 기존 기능은 모두 정상적으로 유지됩니다.

### 1. App.jsx (최종본)

```jsx
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
      
      {/* 💻 데스크톱 사이드바: 로고 우측 라틴어 BETA 추가 */}
      <aside className="hidden md:flex w-64 bg-[#1a1f2c] p-6 text-white flex-col z-20">
        <div className="flex items-center space-x-3 mb-12 px-2">
          <div className="bg-[#6366f1] p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-xl font-black tracking-tighter leading-none">GradFlow</span>
            {/* 라틴어 'BETA' 표기 */}
            <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider mb-0.5">BETA</span>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[#5c56e0] text-white shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 📱 모바일 헤더: 로고 우측 라틴어 BETA 추가 */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 h-[56px] flex items-center justify-between px-5 z-[50] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#6366f1] p-1.5 rounded-lg shadow-md">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-lg font-black tracking-tighter text-[#1a1f2c] leading-none">GradFlow</span>
            {/* 라틴어 'BETA' 표기 */}
            <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider mb-0.5">BETA</span>
          </div>
        </div>
        <button className="p-2 text-gray-400"><Bell size={20} /></button>
      </header>

      {/* 메인 콘텐츠 */}
      <main ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-12 pt-[72px] md:pt-12 pb-20 md:pb-12 scroll-smooth">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard courses={courses} coursework={coursework} userProfile={userProfile} setActiveTab={setActiveTab} />}
          {activeTab === 'coursework' && <Coursework courses={courses} setCourses={setCourses} coursework={coursework} setCoursework={setCoursework} showAlert={showAlert} />}
          {activeTab === 'calendar' && <CalendarView courses={courses} coursework={coursework} />}
          {activeTab === 'profile' && <Profile userProfile={userProfile} setUserProfile={setUserProfile} showAlert={showAlert} />}
        </div>
      </main>

      {/* 📱 슬림 모바일 하단 내비바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 flex justify-around items-center py-1.5 px-2 z-[50] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center min-w-[60px] py-1 transition-all ${activeTab === item.id ? 'text-[#6366f1]' : 'text-gray-300'}`}>
            <div className={`p-1 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-50' : ''}`}>
              {item.icon}
            </div>
            <span className="text-[10px] font-bold mt-0.5 tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="fixed top-[68px] md:top-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-in fade-in zoom-in duration-300">{toast}</div>}
    </div>
  );
}