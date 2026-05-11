import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, TrendingUp, UserMinus, Activity } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar 
} from 'recharts';

export default function AdminDashboard() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('daily'); // daily, weekly, monthly, quarterly, yearly

  // 🚀 실제 DB에서 최근 가입자 리스트 불러오기
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('updated_at', { ascending: false }); // 보통 가입일(created_at)로 하지만, profiles 업데이트 순으로 대체 가능

        if (error) throw error;
        setUsersList(data || []);
      } catch (error) {
        console.error('회원 목록 불러오기 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // 🚀 그래프용 더미 데이터 세팅 (실제 환경에서는 방문자 로그 DB에서 집계해 와야 함)
  const chartData = {
    daily: [
      { name: '월', 가입: 12, 탈퇴: 1, 방문: 150 }, { name: '화', 가입: 19, 탈퇴: 0, 방문: 230 },
      { name: '수', 가입: 15, 탈퇴: 2, 방문: 180 }, { name: '목', 가입: 22, 탈퇴: 1, 방문: 290 },
      { name: '금', 가입: 30, 탈퇴: 0, 방문: 350 }, { name: '토', 가입: 45, 탈퇴: 3, 방문: 500 },
      { name: '일', 가입: 42, 탈퇴: 1, 방문: 480 },
    ],
    weekly: [
      { name: '1주차', 가입: 80, 탈퇴: 5, 방문: 1200 }, { name: '2주차', 가입: 120, 탈퇴: 8, 방문: 1800 },
      { name: '3주차', 가입: 150, 탈퇴: 10, 방문: 2200 }, { name: '4주차', 가입: 170, 탈퇴: 7, 방문: 2600 },
    ],
    monthly: [
      { name: '1월', 가입: 300, 탈퇴: 20, 방문: 5000 }, { name: '2월', 가입: 450, 탈퇴: 35, 방문: 7200 },
      { name: '3월', 가입: 600, 탈퇴: 40, 방문: 9500 }, { name: '4월', 가입: 800, 탈퇴: 50, 방문: 12000 },
    ],
    quarterly: [
      { name: '1분기', 가입: 1350, 탈퇴: 95, 방문: 21700 }, { name: '2분기', 가입: 2100, 탈퇴: 120, 방문: 35000 },
      { name: '3분기', 가입: 2800, 탈퇴: 150, 방문: 42000 }, { name: '4분기', 가입: 3200, 탈퇴: 180, 방문: 51000 },
    ],
    yearly: [
      { name: '2024', 가입: 5000, 탈퇴: 300, 방문: 80000 }, { name: '2025', 가입: 8500, 탈퇴: 450, 방문: 130000 },
      { name: '2026', 가입: 12000, 탈퇴: 600, 방문: 190000 },
    ]
  };

  const currentData = chartData[timeRange];

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 px-4 font-sans text-left animate-in fade-in duration-500">
      
      {/* 🚀 1. 헤더 영역 (빨간색 로고) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-4 pb-2 border-b border-gray-200">
        <div>
          {/* 빨간색 로고 적용 */}
          <h1 className="text-3xl md:text-4xl font-black text-red-600 tracking-tighter">GradFlow Admin</h1>
          <p className="text-gray-500 font-bold text-sm md:text-base mt-1">시스템 관리자 대시보드</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                timeRange === range ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {range === 'daily' ? '일별' : range === 'weekly' ? '주별' : range === 'monthly' ? '월별' : range === 'quarterly' ? '분기별' : '연도별'}
            </button>
          ))}
        </div>
      </div>

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Users size={24} /></div>
          <div>
            <p className="text-gray-400 text-xs font-bold">총 회원 수</p>
            <h3 className="text-2xl font-black text-gray-900">{usersList.length}명</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24} /></div>
          <div>
            <p className="text-gray-400 text-xs font-bold">신규 가입 (선택 기간)</p>
            <h3 className="text-2xl font-black text-gray-900">{currentData[currentData.length-1].가입}명</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><UserMinus size={24} /></div>
          <div>
            <p className="text-gray-400 text-xs font-bold">탈퇴 (선택 기간)</p>
            <h3 className="text-2xl font-black text-gray-900">{currentData[currentData.length-1].탈퇴}명</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Activity size={24} /></div>
          <div>
            <p className="text-gray-400 text-xs font-bold">방문수 (선택 기간)</p>
            <h3 className="text-2xl font-black text-gray-900">{currentData[currentData.length-1].방문.toLocaleString()}회</h3>
          </div>
        </div>
      </div>

      {/* 🚀 2 & 3. 그래프 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 가입/탈퇴 추이 그래프 */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-6">회원 가입 및 탈퇴 추이</h3>
          <div className="h-[300px] w-full text-xs font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="가입" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="탈퇴" stroke="#ef4444" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 방문수 추이 막대 그래프 */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-6">서비스 방문수 추이</h3>
          <div className="h-[300px] w-full text-xs font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="방문" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 🚀 4. 회원 리스트 표(Table) */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-black text-gray-800">최근 가입 회원 리스트</h3>
          <span className="text-xs font-bold text-gray-400">총 {usersList.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="p-4 font-black">이름</th>
                <th className="p-4 font-black">별명(닉네임)</th>
                <th className="p-4 font-black">소속 대학원</th>
                <th className="p-4 font-black">전공 및 학위</th>
                <th className="p-4 font-black">학기</th>
              </tr>
            </thead>
            <tbody className="text-sm font-bold text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">가입한 회원이 없습니다.</td>
                </tr>
              ) : (
                usersList.map((user, idx) => (
                  <tr key={user.id || idx} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black text-xs">
                          {user.full_name ? user.full_name.charAt(0) : '?'}
                        </div>
                        <span className="text-gray-900">{user.full_name || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">{user.nickname || '-'}</td>
                    <td className="p-4">{user.university} {user.graduate_school || '-'}</td>
                    <td className="p-4 text-indigo-600">{user.major || '-'} / {user.degree}</td>
                    <td className="p-4">{user.semester ? `${user.semester}학기` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}