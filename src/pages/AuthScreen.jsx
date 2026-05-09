import React, { useState } from 'react';
import { 
  GraduationCap, Mail, Lock, User, CheckCircle, 
  X, ShieldCheck
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const TermsModal = ({ title, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
      <div className="flex justify-between items-center p-6 border-b bg-slate-50">
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
      </div>
      <div className="p-8 overflow-y-auto text-sm text-gray-600 space-y-6 leading-relaxed">
        <p>여기에 {title} 내용이 들어갑니다.</p>
        <p>원활한 학업 관리 및 서비스 제공을 위해 회원님의 정보를 안전하게 보관 및 처리합니다.</p>
      </div>
      <div className="p-5 border-t bg-gray-50 flex justify-end">
        <button onClick={onClose} className="w-full py-3 text-base font-bold text-white bg-[#151b2b] hover:bg-slate-800 rounded-xl transition-colors">확인</button>
      </div>
    </div>
  </div>
);

const AuthScreen = ({ showAlert }) => {
  // 모드: 'login' | 'signup_email' | 'signup_verify' | 'signup_profile'
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null); // 'terms' or 'privacy'
  
  const [form, setForm] = useState({
    email: '', password: '', realName: '', nickname: '', 
    university: '', gradSchool: '', major: '', semester: ''
  });
  const [otpCode, setOtpCode] = useState('');
  
  // 약관 동의 상태
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  // 이메일 형식 검증 (ac.kr 또는 edu)
  const isEduEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(ac\.kr|edu)$/.test(email);
  };

  // 1. 일반 이메일 로그인 처리
  const handleLogin = async () => {
    if (!form.email || !form.password) return showAlert('이메일과 비밀번호를 입력해주세요.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) showAlert('이메일 또는 비밀번호가 일치하지 않습니다.');
    setLoading(false);
  };

  // 2. 구글 클래스룸 연동 로그인 함수
  const handleGoogleLogin = async () => {
    setLoading(true);
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

    if (error) {
      showAlert('구글 로그인 중 에러가 발생했습니다: ' + error.message);
      setLoading(false);
    }
  };

  // 3. 인증 메일 발송 요청 (실제 Supabase 연동)
  const handleRequestVerification = async () => {
    if (!isEduEmail(form.email)) return showAlert('대학원생 인증을 위해 .ac.kr 또는 .edu 계정만 사용 가능합니다.');
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: { emailRedirectTo: window.location.origin }
    });
    setLoading(false);

    if (error) {
      return showAlert('인증 메일 발송 실패: ' + error.message);
    }

    showAlert('인증번호가 메일로 발송되었습니다. (스팸함 확인 필수)');
    setAuthMode('signup_verify');
  };

  // 4. 인증번호 확인 (실제 Supabase 연동)
  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) return showAlert('6자리 인증번호를 입력해 주세요.');

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token: otpCode,
      type: 'email'
    });
    setLoading(false);

    if (error) {
      return showAlert('인증번호가 일치하지 않거나 만료되었습니다.');
    }

    showAlert('이메일 인증이 완료되었습니다.');
    setAuthMode('signup_profile');
  };

  // 5. 최종 가입 완료 및 Supabase 데이터 저장
  const handleCompleteSignup = async () => {
    if (!form.realName || !form.nickname || !form.password || !form.university || !form.major) {
      return showAlert('필수 정보를 모두 입력해주세요.');
    }
    if (form.password.length < 6) return showAlert('비밀번호는 6자리 이상이어야 합니다.');
    if (!agreedTerms || !agreedPrivacy) return showAlert('필수 약관에 동의해주세요.');

    setLoading(true);
    
    // OTP 인증을 통해 이미 로그인 세션이 생성되었으므로, 비밀번호를 업데이트합니다.
    const { data: userUpdateData, error: userUpdateError } = await supabase.auth.updateUser({
      password: form.password
    });

    if (userUpdateError) {
      setLoading(false);
      return showAlert('비밀번호 설정 중 오류: ' + userUpdateError.message);
    }

    // 프로필 테이블에 부가 정보 저장
    if (userUpdateData.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userUpdateData.user.id, 
        real_name: form.realName, 
        nickname: form.nickname, 
        university: form.university, 
        grad_school: form.gradSchool, 
        major: form.major, 
        semester: form.semester
      });

      if (profileError) {
        showAlert('프로필 저장 중 오류: ' + profileError.message);
      } else {
        showAlert('🎉 가입이 완료되었습니다! 환영합니다.');
        // 상태 변경으로 자동 라우팅 처리됨
      }
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden font-sans">
      
      {/* 🌑 상단 헤더 영역 */}
      <div className="bg-[#151b2b] pt-10 pb-8 text-center text-white">
        <div className="bg-[#6b62ff] w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <GraduationCap size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">GradFlow</h2>
        <p className="text-gray-400 text-[13px]">대학원생을 위한 연구 일정 관리</p>
      </div>
      
      <div className="p-8">
        
        {/* ==================== [로그인 모드] ==================== */}
        {authMode === 'login' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-3">
              <input type="email" placeholder="이메일 주소" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 focus:border-[#6b62ff] rounded-xl outline-none text-sm transition-all" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input type="password" placeholder="비밀번호" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 focus:border-[#6b62ff] rounded-xl outline-none text-sm transition-all" value={form.password} onChange={e => setForm({...form, password: e.target.value})} onKeyPress={e => e.key === 'Enter' && handleLogin()} />
            </div>
            
            <button onClick={handleLogin} disabled={loading} className="w-full bg-[#151b2b] text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all">
              {loading ? '로그인 중...' : '로그인'}
            </button>

            {/* 🔥 구분선 및 구글 로그인 버튼 */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-100"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-[11px] font-bold">또는</span>
              <div className="flex-grow border-t border-gray-100"></div>
            </div>

            <button 
              onClick={handleGoogleLogin} 
              disabled={loading} 
              className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google 연동으로 시작하기
            </button>
            
            <div className="text-center pt-2">
              <button onClick={() => setAuthMode('signup_email')} className="text-[13px] text-gray-500 hover:text-gray-800">
                아직 계정이 없으신가요? <span className="font-bold underline underline-offset-2">회원가입</span>
              </button>
            </div>
          </div>
        )}

        {/* =============== [회원가입 공통 헤더] =============== */}
        {authMode !== 'login' && (
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1">회원가입</h3>
            <p className="text-[13px] text-gray-500">서비스 이용을 위해 대학원생 인증이 필요합니다.</p>
          </div>
        )}

        {/* ==================== [가입 1단계: 이메일 인증] ==================== */}
        {authMode === 'signup_email' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">대학원 이메일 인증</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="email" placeholder="example@snu.ac.kr 또는 .edu" className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-[#6b62ff] rounded-xl outline-none text-sm transition-all" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <button onClick={handleRequestVerification} disabled={loading} className="bg-indigo-50 text-indigo-600 px-5 rounded-xl font-bold text-[13px] hover:bg-indigo-100 transition-colors whitespace-nowrap disabled:opacity-50">
                  {loading ? '처리중' : '인증요청'}
                </button>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-6 text-center">
              <button onClick={() => setAuthMode('login')} className="text-[13px] text-gray-500 hover:text-gray-800">
                이미 계정이 있으신가요? <span className="font-bold underline underline-offset-2">로그인</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== [가입 2단계: 인증번호 확인] ==================== */}
        {authMode === 'signup_verify' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">대학원 이메일 인증</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="email" disabled className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm text-gray-500" value={form.email} />
                </div>
                <button disabled className="bg-gray-50 text-gray-400 px-5 rounded-xl font-bold text-[13px] whitespace-nowrap border border-gray-100">
                  발송됨
                </button>
              </div>
              <p className="text-[12px] text-emerald-600 font-medium ml-1">인증 메일이 발송되었습니다. (스팸함 확인 필요)</p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">인증번호 입력</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" maxLength={6} placeholder="인증번호 6자리" className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-[#6b62ff] rounded-xl outline-none text-sm transition-all tracking-[0.2em]" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <button onClick={handleVerifyCode} disabled={loading} className="bg-[#4b44e6] text-white px-6 rounded-xl font-bold text-[13px] hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm disabled:opacity-50">
                  {loading ? '확인중' : '확인'}
                </button>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-6 text-center">
              <button onClick={() => setAuthMode('login')} className="text-[13px] text-gray-500 hover:text-gray-800">
                이미 계정이 있으신가요? <span className="font-bold underline underline-offset-2">로그인</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== [가입 3단계: 프로필 입력 및 완료] ==================== */}
        {authMode === 'signup_profile' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            
            {/* 인증 완료 배너 */}
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 py-3 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm mb-6">
              <CheckCircle size={16} className="mr-2" /> 대학원생 인증이 완료되었습니다.
            </div>

            {/* 본명 & 닉네임 (모바일 대응 flex-col sm:flex-row 적용) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="space-y-1.5 flex-1">
                <label className="text-[12px] font-bold text-gray-700 ml-1">본명</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="text" placeholder="홍길동" className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-[#6b62ff]" value={form.realName} onChange={e => setForm({...form, realName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-[12px] font-bold text-gray-700 ml-1">별명 (앱 내 표시용)</label>
                <input type="text" placeholder="랩짱" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-[#6b62ff]" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-gray-700 ml-1">비밀번호 설정</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input type="password" placeholder="•••••••• (6자리 이상)" className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg outline-none text-sm focus:border-[#6b62ff]" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
            </div>

            {/* 소속 정보 (모바일 대응 flex-col sm:flex-row 적용) */}
            <div className="pt-2">
              <label className="text-[12px] font-bold text-gray-700 ml-1 mb-1.5 block">소속 정보</label>
              <div className="space-y-2 border border-gray-100 p-3 rounded-xl bg-gray-50/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="학교명 (예: 한국대)" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs focus:border-[#6b62ff]" value={form.university} onChange={e => setForm({...form, university: e.target.value})} />
                  <input type="text" placeholder="대학원 (예: 일반대학원)" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs focus:border-[#6b62ff]" value={form.gradSchool} onChange={e => setForm({...form, gradSchool: e.target.value})} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="전공 (예: 컴퓨터공학)" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs focus:border-[#6b62ff]" value={form.major} onChange={e => setForm({...form, major: e.target.value})} />
                  <input type="text" placeholder="학기 (예: 2/4)" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs focus:border-[#6b62ff]" value={form.semester} onChange={e => setForm({...form, semester: e.target.value})} />
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-[12px] text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded text-[#6b62ff] focus:ring-[#6b62ff]" checked={agreedTerms} onChange={() => setAgreedTerms(!agreedTerms)} />
                  <span>(필수) 이용약관 동의</span>
                </label>
                <button onClick={() => setModalType('terms')} className="text-[11px] text-gray-400 hover:text-gray-600 underline">보기</button>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-[12px] text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded text-[#6b62ff] focus:ring-[#6b62ff]" checked={agreedPrivacy} onChange={() => setAgreedPrivacy(!agreedPrivacy)} />
                  <span>(필수) 개인정보처리방침 동의</span>
                </label>
                <button onClick={() => setModalType('privacy')} className="text-[11px] text-gray-400 hover:text-gray-600 underline">보기</button>
              </div>
            </div>

            {/* 가입 완료 버튼 */}
            <button onClick={handleCompleteSignup} disabled={loading} className="w-full bg-[#151b2b] text-white py-3.5 mt-2 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50">
              {loading ? '가입 처리 중...' : '가입 완료 및 시작하기'}
            </button>

            <div className="border-t border-gray-100 pt-5 text-center">
              <button onClick={() => setAuthMode('login')} className="text-[12px] text-gray-500 hover:text-gray-800">
                이미 계정이 있으신가요? <span className="font-bold underline underline-offset-2">로그인</span>
              </button>
            </div>
          </div>
        )}

      </div>
      
      {/* 약관 모달 렌더링 */}
      {modalType && (
        <TermsModal 
          title={modalType === 'terms' ? '이용약관' : '개인정보처리방침'} 
          onClose={() => setModalType(null)} 
        />
      )}
    </div>
  );
};

export default AuthScreen;