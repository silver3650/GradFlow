import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, TrendingUp, UserMinus, Activity, Loader2 } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AdminDashboard() {
  const [filter, setFilter] = useState('daily');
  const [isLoading, setIsLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({ total: 0, new: 0, withdrawn: 0, visits: 0 });
  const [chartData, setChartData] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (profileError) throw profileError;

      // 실제 방문 데이터를 visits 테이블에서 가져옵니다 (더미 데이터 제거)
      const { data: visits, error: visitError } = await supabase
        .from('visits')
        .select('created_at')
        .gte('created_at', getFilterStartDate(filter));

      const safeProfiles = profiles || [];
      const safeVisits = visits || [];

      const filterDate = getFilterStartDate(filter);
      
      const newUsers = safeProfiles.filter(p => new Date(p.created_at) >= new Date(filterDate));
      const withdrawnUsers = safeProfiles.filter(p => p.status === 'deleted' && new Date(p.updated_at) >= new Date(filterDate));

      setMetrics({
        total: safeProfiles.length,
        new: newUsers.length,
        withdrawn: withdrawnUsers.length,
        visits: safeVisits.length 
      });

      setRecentUsers(safeProfiles.slice(0, 10)); // 최근 가입자 10명

      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const currentWeekData = days.map((day, index) => {
        const signups = safeProfiles.filter(p => new Date(p.created_at).getDay() === index).length;
        const withdrawals = withdrawnUsers.filter(p => new Date(p.updated_at).getDay() === index).length;
        const visitCount = safeVisits.filter(v => new Date(v.created_at).getDay() === index).length;

        return {
          name: day,
          가입: signups,
          탈퇴: withdrawals,
          방문: visitCount
        };
      });

      setChartData(currentWeekData);

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filter]);

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
    { id: 'monthly', label: '월별' }
  ];

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen pb-24 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-red-500 leading-tight">GradFlow Admin</h1>
          <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">시스템 관리자 대시보드</p>
        </div>
        <div className="flex gap-1.5 md:gap-2 bg-white p-1 rounded-xl shadow-sm w-full md:w-auto overflow-x-auto">
          {filterOptions.map(opt => (
            <button 
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all whitespace-nowrap ${filter === opt.id ? 'bg-[#1e253c] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        {[
          { icon: <Users size={20} className="text-indigo-500"/>, label: '총 회원수', val: metrics.total, unit: '명', bg: 'bg-indigo-50' },
          { icon: <TrendingUp size={20} className="text-green-500"/>, label: '신규 가입', val: metrics.new, unit: '명', bg: 'bg-green-50' },
          { icon: <UserMinus size={20} className="text-red-500"/>, label: '탈퇴 추정치', val: metrics.withdrawn, unit: '명', bg: 'bg-red-50' },
          { icon: <Activity size={20} className="text-blue-500"/>, label: '방문수', val: metrics.visits, unit: '회', bg: 'bg-blue-50' }
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm flex flex-col items-center justify-center text-center border border-gray-100">
            <div className={`${item.bg} p-2.5 md:p-3 rounded-full mb-2 md:mb-3`}>{item.icon}</div>
            <p className="text-gray-500 text-[10px] md:text-xs font-bold mb-0.5 md:mb-1">{item.label}</p>
            <p className="text-xl md:text-3xl font-black text-gray-800">{item.val}<span className="text-xs md:text-base font-bold ml-0.5 md:ml-1 text-gray-500">{item.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm border border-gray-100">
          <h3 className="text-base md:text-lg font-black text-gray-800 mb-4 md:mb-6">회원 가입 및 탈퇴 추이</h3>
          <div className="h-[200px] md:h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="가입" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="탈퇴" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs md:text-sm font-bold text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> 가입</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> 탈퇴</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm border border-gray-100">
          <h3 className="text-base md:text-lg font-black text-gray-800 mb-4 md:mb-6">서비스 방문수 추이</h3>
          <div className="h-[200px] md:h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="방문" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs md:text-sm font-bold text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 방문</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm border border-gray-100">
        <h3 className="text-base md:text-lg font-black text-gray-800 mb-4">최근 가입 회원 리스트</h3>
        <div className="overflow-x-auto whitespace-nowrap">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-gray-100 text-gray-400 text-xs md:text-sm font-bold">
                <th className="pb-3 font-medium px-2">번호</th>
                <th className="pb-3 font-medium px-2">이름(닉네임)</th>
                <th className="pb-3 font-medium px-2">대학교(원)</th>
                <th className="pb-3 font-medium px-2">전공/학위</th>
                <th className="pb-3 font-medium px-2">가입일</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user, idx) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors text-xs md:text-sm">
                  <td className="py-3 md:py-4 px-2 text-gray-500 font-medium">{idx + 1}</td>
                  <td className="py-3 md:py-4 px-2 font-bold text-gray-800 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center text-[10px]">
                      {user.nickname ? user.nickname.charAt(0) : 'G'}
                    </div>
                    {user.nickname || '미등록'}
                  </td>
                  <td className="py-3 md:py-4 px-2 text-gray-600">{user.university || '-'}</td>
                  <td className="py-3 md:py-4 px-2 text-gray-600">{user.major || '-'}</td>
                  <td className="py-3 md:py-4 px-2 text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                  </td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400 font-bold text-sm">가입 회원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}