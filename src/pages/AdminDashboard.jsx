import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, TrendingUp, UserMinus, Activity, X, ChevronLeft, ChevronRight, Search 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar 
} from 'recharts';

export default function AdminDashboard() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('daily');
  
  // 페이지네이션 및 모달 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 🚀 DB에서 가입자 리스트 불러오기 (created_at 기준 내림차순)
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

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

  // 🚀 페이지네이션 계산
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = usersList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(usersList.length / itemsPerPage);

  // 🚀 모달 핸들러
  const openUserDetail = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const closeUserDetail = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
  };

  // 🚀 그래프 데이터 (더미)
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
      
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-red-600 tracking-tighter">GradFlow Admin</h1>
          <p className="text-gray-500 font-bold text-sm md:text-base mt-1">시스템 관리자 대시보드</p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((range) => (
            <button
              key={range}
              onClick={() => { setTimeRange(range); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                timeRange === range ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {range === 'daily' ? '일별' : range === 'weekly' ? '주별' : range === 'monthly' ? '월별' : range === 'quarterly' ? '분기별' : '연도별'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 요약 카드 */}
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

      {/* 3. 그래프 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-6">회원 가입 및 탈퇴 추이</h3>
          <div className="h-[250px] w-full text-xs font-bold">
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
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-6">서비스 방문수 추이</h3>
          <div className="h-[250px] w-full text-xs font-bold">
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

      {/* 4. 회원 리스트 테이블 */}
      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-black text-gray-800">최근 가입 회원 리스트</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 bg-slate-200 text-slate-600 rounded-full font-black">PAGE {currentPage} / {totalPages || 1}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="p-4 font-black">번호</th>
                <th className="p-4 font-black">이름 / 닉네임</th>
                <th className="p-4 font-black">대학교(원)</th>
                <th className="p-4 font-black">전공 / 학위</th>
                <th className="p-4 font-black text-center">가입일</th>
              </tr>
            </thead>
            <tbody className="text-sm font-bold text-gray-700">
              {loading ? (
                <tr><td colSpan="5" className="p-12 text-center text-gray-400">데이터 로딩 중...</td></tr>
              ) : currentUsers.length === 0 ? (
                <tr><td colSpan="5" className="p-12 text-center text-gray-400">조회된 회원이 없습니다.</td></tr>
              ) : (
                currentUsers.map((user, idx) => (
                  <tr 
                    key={user.id} 
                    onClick={() => openUserDetail(user)}
                    className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 text-gray-400 text-xs">
                      {usersList.length - (indexOfFirstItem + idx)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs border border-gray-200 group-hover:bg-white transition-colors">
                          {user.full_name ? user.full_name.charAt(0) : '?'}
                        </div>
                        <div>
                          <p className="text-gray-900 leading-none mb-1">{user.full_name || '미입력'}</p>
                          <p className="text-[10px] text-gray-400 font-medium">@{user.nickname || '익명'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-700">{user.university || '-'}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{user.graduate_school || '일반대학원'}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-indigo-600">{user.major || '-'}</span>
                      <span className="mx-1 text-gray-300">|</span>
                      <span className="text-gray-500 text-xs font-medium">{user.degree || '-'}</span>
                    </td>
                    <td className="p-4 text-center text-gray-400 text-xs">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 5. 페이지네이션 컨트롤 */}
        <div className="p-6 flex justify-center items-center gap-2 bg-gray-50/30 border-t border-gray-100">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                currentPage === i + 1 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-white text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-200'
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 6. 회원 상세정보 모달 */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="relative h-24 bg-gradient-to-r from-red-500 to-red-600">
              <button 
                onClick={closeUserDetail}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="px-8 pb-8">
              <div className="relative -mt-10 mb-4 flex justify-between items-end">
                <div className="w-20 h-20 rounded-3xl bg-white p-1 shadow-lg">
                  <div className="w-full h-full rounded-[20px] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-2xl border border-gray-100">
                    {selectedUser.full_name?.charAt(0)}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${selectedUser.is_active !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {selectedUser.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">{selectedUser.full_name || '이름 없음'}</h2>
                  <p className="text-gray-400 font-bold">@{selectedUser.nickname || '닉네임미설정'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">대학교(원)</p>
                    <p className="text-sm font-bold text-gray-800">{selectedUser.university}</p>
                    <p className="text-xs text-gray-500">{selectedUser.graduate_school || '일반대학원'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">학기 정보</p>
                    <p className="text-sm font-bold text-gray-800">{selectedUser.semester ? `${selectedUser.semester}학기` : '정보 없음'}</p>
                    <p className="text-xs text-gray-500">{selectedUser.degree || '-'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-400 font-bold">전공</span>
                    <span className="text-gray-900 font-black">{selectedUser.major || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-400 font-bold">가입일</span>
                    <span className="text-gray-900 font-black">
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-400 font-bold">UID</span>
                    <span className="text-[10px] text-gray-400 font-mono">{selectedUser.id}</span>
                  </div>
                </div>

                <button 
                  onClick={closeUserDetail}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}