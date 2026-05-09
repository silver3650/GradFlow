import React, { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, LogOut, Settings, Calendar, 
  BookOpen, Edit3, Check, X, GraduationCap 
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Profile({ userProfile = {}, setUserProfile, showAlert }) {
  // 연동 및 편집 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isLmsLinked, setIsLmsLinked] = useState(false);

  // 입력 폼 상태 (대학교, 대학원 필드 추가)
  const [formData, setFormData] = useState({
    nickname: userProfile.nickname || '',
    real_name: userProfile.real_name || '',
    university: userProfile.university || '',
    grad_school: userProfile.grad_school || '',
    department: userProfile.department || '',
    bio: userProfile.bio || ''
  });

  // 컴포넌트 마운트 시 구글 토큰 여부 확인 및 폼 데이터 초기화
  useEffect(() => {
    setFormData({
      nickname: userProfile.nickname || '',
      real_name: userProfile.real_name || '',
      university: userProfile.university || '',
      grad_school: userProfile.grad_school || '',
      department: userProfile.department || '',
      bio: userProfile.bio || ''
    });

    // 로컬 스토리지에 구글 토큰이 있으면 연동된 것으로 간주
    const token = localStorage.getItem('google_provider_token');
    setIsGoogleLinked(!!token);
  }, [userProfile]);

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      localStorage.removeItem('google_provider_token'); // 로그아웃 시 토큰 날림
      await supabase.auth.signOut();
    } catch (error) {
      if (showAlert) showAlert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 프로필 정보 저장
  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: formData.nickname,
          real_name: formData.real_name,
          university: formData.university,      // 대학교 추가
          grad_school: formData.grad_school,    // 대학원 추가
          department: formData.department,
          bio: formData.bio,
          updated_at: new Date()
        })
        .eq('id', user.id);

      if (error) throw error;

      if (setUserProfile) {
        setUserProfile({ ...userProfile, ...formData });
      }
      
      setIsEditing(false);
      if (showAlert) showAlert('✅ 프로필 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      if (showAlert) showAlert('🚨 정보 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 실제 구글 권한 연동 및 해제 로직 적용
  const toggleGoogle = async () => {
    if (isGoogleLinked) {
      // 1. 연동 해제 (로컬 토큰 삭제로 접근 차단)
      localStorage.removeItem('google_provider_token');
      setIsGoogleLinked(false);
      if (showAlert) showAlert('구글 연동이 해제되었습니다.');
    } else {
      // 2. 연동 시작 (Supabase OAuth 호출하여 클래스룸 권한 요청)
      if (showAlert) showAlert('구글 계정 연동 페이지로 이동합니다...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          redirectTo: window.location.origin
        }
      });

      if (error && showAlert) {
        showAlert('구글 연동 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  // LMS 연동 (실제 대학 시스템 통합 전까지 준비 중 처리)
  const toggleLms = () => {
    if (showAlert) showAlert('🚨 학교 LMS 연동 기능은 현재 개발 준비 중입니다. (각 대학별 API 규격 확정 후 지원 예정)');
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-24 text-left font-sans px-1">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter">MY PROFILE</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">회원 정보 및 대시보드 연동 설정을 관리합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 좌측: 요약 프로필 카드 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-50 to-white -z-10"></div>
            
            <div className="w-20 h-20 md:w-24 md:h-24 bg-white shadow-md text-indigo-600 rounded-full flex items-center justify-center mb-6 mt-4 border-4 border-white">
              <User size={40} />
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-gray-900">{userProfile.nickname || '연구자'}</h2>
            <p className="text-gray-500 font-bold mt-1 text-sm">{userProfile.university || '소속 대학 미입력'}</p>
            <p className="text-gray-400 font-bold mb-4 text-sm">{userProfile.department || '학과 미지정'}</p>
            
            <div className="bg-green-50 text-green-600 px-4 py-2 rounded-full text-[11px] font-black flex items-center mb-8">
              <ShieldCheck size={14} className="mr-2" /> 대학원생 인증됨
            </div>
            
            <div className="w-full space-y-3">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`w-full py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all text-sm ${isEditing ? 'bg-gray-100 text-gray-500' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'}`}
              >
                {isEditing ? <><X size={18} /> 취소하기</> : <><Edit3 size={18} /> 정보 수정</>}
              </button>
              
              <button 
                onClick={handleLogout} 
                className="w-full py-3.5 bg-red-50 text-red-500 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all text-sm"
              >
                <LogOut size={18} /> 로그아웃
              </button>
            </div>
          </div>
        </div>

        {/* 우측: 상세 정보 수정 폼 및 설정 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 기본 정보 수정 섹션 */}
          <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center">
              <GraduationCap className="mr-3 text-indigo-500" size={22} /> 학업 및 계정 정보
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 ml-1">닉네임</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.nickname}
                  onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 ml-1">실명</label>
                <input 
                  disabled={!isEditing}
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.real_name}
                  onChange={(e) => setFormData({...formData, real_name: e.target.value})}
                />
              </div>

              {/* 🚀 대학교 / 대학원 입력 필드 추가 */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 ml-1">대학교</label>
                <input 
                  disabled={!isEditing}
                  placeholder="예: 한국대학교"
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.university}
                  onChange={(e) => setFormData({...formData, university: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 ml-1">대학원 (소속기관)</label>
                <input 
                  disabled={!isEditing}
                  placeholder="예: 일반대학원"
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.grad_school}
                  onChange={(e) => setFormData({...formData, grad_school: e.target.value})}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-gray-400 ml-1">학과 / 전공</label>
                <input 
                  disabled={!isEditing}
                  placeholder="예: 컴퓨터공학과 인공지능 전공"
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-gray-400 ml-1">연구 분야 및 한 줄 소개</label>
                <textarea 
                  disabled={!isEditing}
                  rows={3}
                  placeholder="본인의 연구 분야나 목표를 적어주세요."
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-sm transition-all resize-none ${isEditing ? 'bg-gray-50 border-2 border-indigo-100 focus:bg-white outline-none' : 'bg-transparent border-2 border-transparent text-gray-800'}`}
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                />
              </div>
            </div>

            {isEditing && (
              <div className="mt-8">
                <button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="w-full py-4 bg-[#4b44e6] text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  {loading ? '저장 중...' : <><Check size={20} /> 변경사항 저장하기</>}
                </button>
              </div>
            )}
          </div>

          {/* 서비스 연동 섹션 */}
          <div className="bg-white rounded-[32px] border border-gray-100 p-6 md:p-8 shadow-sm">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center">
              <Settings className="mr-3 text-indigo-500" size={20} /> 외부 서비스 연동
            </h3>
            
            <div className="space-y-4">
              {/* 구글 연동 */}
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl border transition-all gap-4 ${isGoogleLinked ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-gray-100'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl ${isGoogleLinked ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-sm md:text-base">Google Workspace</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${isGoogleLinked ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {isGoogleLinked ? '캘린더, 클래스룸 데이터 동기화 활성' : '클래스룸 과제를 가져오려면 연동이 필요합니다'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={toggleGoogle}
                  className={`w-full sm:w-auto text-xs font-black px-5 py-2.5 rounded-xl transition-all ${isGoogleLinked ? 'bg-white text-gray-500 border border-gray-100 hover:text-red-500' : 'bg-[#5c56e0] text-white'}`}
                >
                  {isGoogleLinked ? '연동 해제' : '연동하기'}
                </button>
              </div>

              {/* 학교 LMS 연동 */}
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl border transition-all gap-4 ${isLmsLinked ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-gray-100'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl ${isLmsLinked ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-sm md:text-base">학교 LMS 시스템 (준비 중)</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${isLmsLinked ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {isLmsLinked ? '과제 자동 수집 활성화' : '대학별 API 규격 확정 후 지원 예정입니다.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={toggleLms}
                  className={`w-full sm:w-auto text-xs font-black px-5 py-2.5 rounded-xl transition-all ${isLmsLinked ? 'bg-white text-gray-500 border border-gray-100 hover:text-red-500' : 'bg-[#5c56e0] text-white'}`}
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