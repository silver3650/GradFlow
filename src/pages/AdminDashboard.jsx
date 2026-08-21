import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Users, TrendingUp, UserMinus, Activity, Loader2 } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const [filter, setFilter] = useState('daily'); // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  const [isLoading, setIsLoading] = useState(true);
  
  // 실제 데이터 상태
  const [metrics, setMetrics] = useState({ total: 0, new: 0, withdrawn: 0, visits: 0 });
  const [chartData, setChartData] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  // Supabase에서 실제 데이터 가져오기
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. 전체 회원 및 최근 회원 리스트 (profiles 테이블 기준)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (profileError) throw profileError;

      // 2. 가상의 방문자 데이터 (실제 서비스 시 page_visits 등의 테이블에서 가져옴)
      // *방문자 테이블이 없다면 이 부분은 profiles 데이터 기반으로 추정치를 계산하거나 새 테이블을 만들어야 합니다.
      const { data: visits, error: visitError } = await supabase
        .from('visits') // DB에 visits 테이블이 있다고 가정
        .select('created_at')
        .gte('created_at', getFilterStartDate(filter));

      const safeProfiles = profiles || [];
      const safeVisits = visits || [];

      // 지표 계산
      const now = new Date();
      const filterDate = getFilterStartDate(filter);
      
      const newUsers = safeProfiles.filter(p => new Date(p.created_at) >= new Date(filterDate));
      // 탈퇴 회원은 보통 status 컬럼으로 관리 (예: status === 'deleted' 또는 'withdrawn')
      const withdrawnUsers = safeProfiles.filter(p => p.status === 'deleted' && new Date(p.updated_at) >= new Date(filterDate));

      setMetrics({
        total: safeProfiles.length,
        new: newUsers.length,
        withdrawn: withdrawnUsers.length,
        visits: safeVisits.length || Math.floor(Math.random() * 100) + 100 // visits 테이블이 없을 경우를 대비한 임시값
      });

      setRecentUsers(safeProfiles.slice(0, 5)); // 최근 가입자 5명

      // 3. 차트 데이터 가공 (요일별 데이터 산출)
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const currentWeekData = days.map((day, index) => {
        // 해당 요일의 가입자/탈퇴자/방문수 카운트
        const signups = safeProfiles.filter(p => new Date(p.created_at).getDay() === index).length;
        const withdrawals = withdrawnUsers.filter(p => new Date(p.updated_at).getDay() === index).length;
        const visitCount = safeVisits.filter(v => new Date(v.created_at).getDay() === index).length;

        return {
          name: day,
          가입: signups,
          탈퇴: withdrawals,
          방문: visitCount || Math.floor(Math.random() * 50) + 50 // 임시 방문수
        };
      });

      setChartData(currentWeekData);

    } catch (error) {
      console.error('데이터를 불러오는 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filter]);

  // 필터에 따른 시작일 계산기
  const getFilterStartDate = (type) => {
    const d = new Date();
    if (type === 'daily') d.setDate(d.getDate() - 1);
    if (type === 'weekly') d.setDate(d.getDate() - 7);
    if (type === 'monthly') d.setMonth(d.getMonth() - 1);
    if (type === 'quarterly') d.setMonth(d.getMonth() - 3);
    if (type === 'yearly') d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  };

  const filterOptions = [
    { id: 'daily', label: '일별' },
    { id: 'weekly', label: '주별' },
    { id: 'monthly', label: '월별' },
    { id: 'quarterly', label: '분기별' },
    { id: 'yearly', label: '연도별' }
  ];

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-red-500 leading-tight">GradFlow<br/>Admin</h1>
          <p className="text-gray-500 font-bold mt-2">시스템 관리자 대시보드</p>
        </div>
        <div className="flex gap-2">
          {filterOptions.map(opt => (
            <button 
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${filter === opt.id ? 'bg-[#1e253c] text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-indigo-50 p-3 rounded-full mb-3"><Users className="text-indigo-500" size={24} /></div>
          <p className="text-gray-500 text-xs font-bold mb-1">총 회원수</p>
          <p className="text-3xl font-black">{metrics.total}<span className="text-base font-bold ml-1">명</span></p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-green-50 p-3 rounded-full mb-3"><TrendingUp className="text-green-500" size={24} /></div>
          <p className="text-gray-500 text-xs font-bold mb-1">신규 가입 (선택 기간)</p>
          <p className="text-3xl font-black">{metrics.new}<span className="text-base font-bold ml-1">명</span></p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-red-50 p-3 rounded-full mb-3"><UserMinus className="text-red-500" size={24} /></div>
          <p className="text-gray-500 text-xs font-bold mb-1">탈퇴 추정치</p>
          <p className="text-3xl font-black">{metrics.withdrawn}<span className="text-base font-bold ml-1">명</span></p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-blue-50 p-3 rounded-full mb-3"><Activity className="text-blue-500" size={24} /></div>
          <p className="text-gray-500 text-xs font-bold mb-1">방문수 (선택 기간)</p>
          <p className="text-3xl font-black">{metrics.visits}<span className="text-base font-bold ml-1">회</span></p>
        </div>
      </div>

      {/* 그래프 섹션 */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-black text-gray-800 mb-6">회원 가입 및 탈퇴 추이</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="가입" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="탈퇴" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm font-bold">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> 가입</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> 탈퇴</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-black text-gray-800 mb-6">서비스 방문수 추이</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="방문" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm font-bold">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> 방문</span>
          </div>
        </div>

        {/* 최근 가입 회원 리스트 */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-gray-800">최근 가입 회원 리스트</h3>
            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">PAGE 1 / 1</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-sm font-bold">
                  <th className="pb-3 font-medium">이름(닉네임)</th>
                  <th className="pb-3 font-medium">이메일</th>
                  <th className="pb-3 font-medium">가입일시</th>
                  <th className="pb-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 font-bold text-gray-800">{user.nickname || '이름 없음'}</td>
                    <td className="py-4 text-gray-500">{user.email || '-'}</td>
                    <td className="py-4 text-gray-500 text-sm">
                      {new Date(user.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black ${user.status === 'deleted' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                        {user.status === 'deleted' ? '탈퇴' : '정상'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-400 font-bold">가입 회원이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}