import React, { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, LogOut, Settings, Calendar, 
  BookOpen, Edit3, Check, X, GraduationCap, ArrowRight, Shield
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Profile({ userProfile = {}, setUserProfile, showAlert }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLmsLinked, setIsLmsLinked] = useState(false);
  const [isCustomDegree, setIsCustomDegree] = useState(false);
  
  // 🚀 유저 이메일 상태 추가
  const [userEmail, setUserEmail] = useState(userProfile.email || '');

  const [formData, setFormData] = useState({
    nickname: userProfile.nickname || '',
    full_name: userProfile.full_name || '',
    university: userProfile.university || '',
    graduate_school: userProfile.graduate_school || '',
    major: userProfile.major || '',
    degree: userProfile.degree || 'M.S.', 
    semester: userProfile.semester || '1',
    total_semesters: userProfile.total_semesters || '4', 
    bio: userProfile.bio || ''
  });

  useEffect(() => {
    // 1. 폼 데이터 초기화
    const initialDegree = userProfile.degree || 'M.S.';
    setFormData({
      nickname: userProfile.nickname || '',
      full_name: userProfile.full_name || '',
      university: userProfile.university || '',
      graduate_school: userProfile.graduate_school || '',
      major: userProfile.major || '',
      degree: initialDegree,
      semester: userProfile.semester || '1',
      total_semesters: userProfile.total_semesters || '4',
      bio: userProfile.bio || ''
    });

    // 2. 직접 입력 학위 여부 확인
    const commonDegrees = ['M.S.', 'M.A.', 'M.B.A.', 'M.Div.', 'Ph.D.', 'M.S./Ph.D.'];
    if (initialDegree && !commonDegrees.includes(initialDegree)) {
      setIsCustomDegree(true);
    } else {
      setIsCustomDegree(false);
    }

    // 3. 구글 연동 여부 확인
    const token = localStorage.getItem('google_provider_token');
    setIsGoogleLinked(!!token);

    // 4. 이메일 정보 가져오기 (userProfile에 없을 경우를 대비)
    const fetchAuthUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
      }
    };
    if (!userEmail) fetchAuthUser();
    
  }, [userProfile, userEmail]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('google_provider_token');
      await supabase.auth.signOut();
    } catch (error) {
      if (showAlert) showAlert('로그아웃 중 오류가 발생했습니다.');
    }
  };

const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 🚀 핵심 변경: update() -> upsert() 로 변경하고 id를 직접 넣어줍니다.
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id, // 없으면 새로 만들어야 하므로 내 고유 id를 꼭 넣어줘야 합니다!
          ...formData,
          updated_at: new Date()
        });

      if (error) throw error;

      if (setUserProfile) {
        setUserProfile({ ...userProfile, ...formData });
      }
      
      setIsEditing(false);
      if (showAlert) showAlert('✅ 프로필 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      console.error("Update Error:", error);
      if (showAlert) showAlert('🚨 정보 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGoogle = async () => {
    if (isGoogleLinked) {
      localStorage.removeItem('google_provider_token');
      setIsGoogleLinked(false);
      if (showAlert) showAlert('구글 연동이 해제되었습니다.');
    } else {
      if (showAlert) showAlert('구글 계정 연동 페이지로 이동합니다...');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo: window.location.origin
        }
      });
      if (error && showAlert) showAlert('구글 연동 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const toggleLms = () => {
    if (showAlert) showAlert('🚨 학교 LMS 연동 기능은 현재 개발 준비 중입니다.');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 text-left font-sans px-4">
      
      {/* 페이지 타이틀 영역 */}
      <div className="pt-4 pb-2">
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">MY PROFILE</h1>
        <p className="text-gray-500 font-bold text-sm md:text-base">회원 정보 및 외부 서비스 연동 설정을 관리합니다.</p>
      </div>

      {/* 관리자 전용 배너 */}
      {userProfile.is_admin && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-full text-indigo-400">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">관리자 계정으로 접속 중입니다</h3>
              <p className="text-slate-400 text-xs">시스템 설정 및 전체 회원 관리를 할 수 있습니다.</p>
            </div>
          </div>
          <button className="w-full sm:w-auto px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            관리자 페이지로 이동 <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* 헤더 및 컴팩트 프로필 카드 */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0">
              <User size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-gray-900">{userProfile.full_name || '이름 없음'}</h1>
                <span className="text-sm font-bold text-gray-400">({userProfile.nickname || '닉네임 미설정'})</span>
                <span className="bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center ml-1">
                  <ShieldCheck size={12} className="mr-1" /> 인증됨
                </span>
              </div>
              {/* 🚀 이메일 정보 노출 */}
              <p className="text-sm font-medium text-gray-500 mb-2">
                {userEmail || '이메일 정보 없음'}
              </p>
              <p className="text-gray-600 font-bold text-sm md:text-base mb-1">
                {userProfile.university} {userProfile.graduate_school} • {userProfile.major}
              </p>
              <p className="text-indigo-600 font-black text-sm">
                {userProfile.degree || 'M.S.'} {userProfile.semester}/{userProfile.total_semesters || '4'}학기
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${isEditing ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
            >
              {isEditing ? <><X size={16} /> 취소</> : <><Edit3 size={16} /> 프로필 수정</>}
            </button>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 정보 수정 폼 */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-6 md:p-8 shadow-sm">
        <h3 className="text-lg font-black text-gray-800 mb-5 flex items-center">
          <GraduationCap className="mr-2 text-indigo-500" size={20} /> 상세 학업 정보
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-5">
          {/* 닉네임 / 실명 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">실명 / 닉네임</label>
            {isEditing ? (
              <div className="flex gap-2">
                <input className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="실명" />
                <input className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} placeholder="닉네임" />
              </div>
            ) : (
              <p className="text-sm font-bold text-gray-800 py-2">{userProfile.full_name} / {userProfile.nickname}</p>
            )}
          </div>

          {/* 대학교 / 대학원 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">소속 대학교 / 대학원</label>
            {isEditing ? (
              <div className="flex gap-2">
                <input className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.university} onChange={(e) => setFormData({...formData, university: e.target.value})} placeholder="대학교" />
                <input className="w-1/2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.graduate_school} onChange={(e) => setFormData({...formData, graduate_school: e.target.value})} placeholder="대학원" />
              </div>
            ) : (
              <p className="text-sm font-bold text-gray-800 py-2">{userProfile.university} {userProfile.graduate_school}</p>
            )}
          </div>

          {/* 학과 / 과정 및 학기 */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-gray-400">학과(전공) / 학위 및 학기</label>
            {isEditing ? (
              <div className="flex gap-2 w-full md:w-3/4">
                <input className="w-[45%] px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.major} onChange={(e) => setFormData({...formData, major: e.target.value})} placeholder="학과 및 전공" />
                
                {isCustomDegree ? (
                  <div className="w-[25%] relative flex items-center">
                    <input 
                      type="text"
                      className="w-full px-3 py-2.5 bg-white border-2 border-indigo-400 rounded-xl text-sm font-bold focus:outline-none"
                      value={formData.degree} 
                      onChange={(e) => setFormData({...formData, degree: e.target.value})} 
                      placeholder="학위명 입력"
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setIsCustomDegree(false);
                        setFormData({...formData, degree: 'M.S.'});
                      }}
                      className="absolute right-2 text-gray-400 hover:text-gray-700 bg-white"
                      title="선택 목록으로 돌아가기"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <select 
                    className="w-[25%] px-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" 
                    value={formData.degree} 
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomDegree(true);
                        setFormData({...formData, degree: ''});
                      } else {
                        setFormData({...formData, degree: e.target.value});
                      }
                    }}
                  >
                    <option value="M.S.">M.S.</option>
                    <option value="M.A.">M.A.</option>
                    <option value="M.B.A.">M.B.A.</option>
                    <option value="M.Div.">M.Div.</option>
                    <option value="Ph.D.">Ph.D.</option>
                    <option value="M.S./Ph.D.">M.S./Ph.D.</option>
                    <option value="custom">직접 입력...</option>
                  </select>
                )}

                <div className="w-[30%] flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-1 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
                  <input type="number" min="1" max="20" className="w-full bg-transparent text-sm font-bold text-center focus:outline-none" value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} placeholder="현재" />
                  <span className="text-gray-400 font-bold text-sm">/</span>
                  <input type="number" min="1" max="20" className="w-full bg-transparent text-sm font-bold text-center focus:outline-none" value={formData.total_semesters} onChange={(e) => setFormData({...formData, total_semesters: e.target.value})} placeholder="전체" />
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-gray-800 py-2">
                {userProfile.major} / {userProfile.degree || 'M.S.'} {userProfile.semester}/{userProfile.total_semesters || '4'}학기
              </p>
            )}
          </div>

          {/* 🚀 연구 분야 소개 (수정 모드이거나, 내용이 있을 때만 렌더링) */}
          {(isEditing || userProfile.bio) && (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-gray-400">한 줄 소개</label>
              {isEditing ? (
                <input className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400" value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} placeholder="연구 분야나 목표를 적어주세요." />
              ) : (
                <p className="text-sm font-bold text-gray-800 py-2">{userProfile.bio}</p>
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleUpdateProfile}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-md hover:bg-indigo-700 transition-all"
            >
              {loading ? '저장 중...' : <><Check size={18} /> 변경사항 저장하기</>}
            </button>
          </div>
        )}
      </div>

      {/* 외부 서비스 연동 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 구글 연동 */}
        <div className={`flex justify-between items-center p-5 rounded-[24px] border transition-all ${isGoogleLinked ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isGoogleLinked ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Calendar size={18} />
            </div>
            <div>
              <p className="font-black text-gray-800 text-sm">Google Workspace</p>
              <p className={`text-[11px] font-bold mt-0.5 ${isGoogleLinked ? 'text-indigo-600' : 'text-gray-400'}`}>
                {isGoogleLinked ? '캘린더, 클래스룸 연동됨' : '연동이 필요합니다'}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleGoogle}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${isGoogleLinked ? 'bg-white text-gray-500 border border-gray-200 hover:text-red-500' : 'bg-gray-900 text-white'}`}
          >
            {isGoogleLinked ? '연동 해제' : '연동하기'}
          </button>
        </div>

        {/* 학교 LMS 연동 */}
        <div className={`flex justify-between items-center p-5 rounded-[24px] border transition-all ${isLmsLinked ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isLmsLinked ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <BookOpen size={18} />
            </div>
            <div>
              <p className="font-black text-gray-800 text-sm">학교 LMS 시스템</p>
              <p className={`text-[11px] font-bold mt-0.5 ${isLmsLinked ? 'text-indigo-600' : 'text-gray-400'}`}>
                {isLmsLinked ? '과제 자동 수집 활성화' : '연동 준비 중입니다'}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleLms}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${isLmsLinked ? 'bg-white text-gray-500 border border-gray-200 hover:text-red-500' : 'bg-gray-900 text-white'}`}
          >
            {isLmsLinked ? '연동 해제' : '연동하기'}
          </button>
        </div>
      </div>
    </div>
  );
}