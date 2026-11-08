import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Bell, MessageSquare, ChevronRight, Edit3, Trash2, CheckCircle2, AlertCircle, Send, ArrowLeft, ChevronLeft } from 'lucide-react';

// 🚀 본인의 관리자 계정 이메일을 입력하세요! 이 계정으로 로그인해야 공지사항 작성이 가능합니다.
const ADMIN_EMAILS = ['silver3650@gmail.com', '202652029@mtu.ac.kr']; 

export default function CommunicationModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('notice'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [notices, setNotices] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  
  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [isWritingInquiry, setIsWritingInquiry] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [replyContent, setReplyContent] = useState('');

  // 🚀 페이징 처리를 위한 State (페이지당 3개)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    setCurrentPage(1); // 탭 전환 시 1페이지로 초기화
    checkUserAndFetchData();
  }, [activeTab]);

  const checkUserAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      
      // 🚀 실제 관리자 이메일 일치 여부 확인
      const userIsAdmin = ADMIN_EMAILS.includes(user.email);
      setIsAdmin(userIsAdmin); 
      
      if (activeTab === 'notice') fetchNotices();
      else fetchInquiries(user, userIsAdmin); 
    }
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (data) setNotices(data);
  };

  const fetchInquiries = async (user, adminCheck) => {
    let query = supabase.from('inquiries').select('*').order('created_at', { ascending: false });
    if (!adminCheck) query = query.eq('user_id', user.id); 
    
    const { data } = await query;
    if (data) setInquiries(data);
  };

  const handleSaveNotice = async () => {
    if (!formTitle || !formContent) return alert('제목과 내용을 입력해주세요.');
    const payload = { title: formTitle, content: formContent };
    
    if (selectedNotice?.id) {
      await supabase.from('announcements').update(payload).eq('id', selectedNotice.id);
    } else {
      await supabase.from('announcements').insert([payload]);
    }
    
    resetForms();
    fetchNotices();
  };

  const handleDeleteNotice = async (id) => {
    if (!window.confirm('공지사항을 삭제하시겠습니까?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    setSelectedNotice(null);
    fetchNotices();
  };

  const handleSaveInquiry = async () => {
    if (!formTitle || !formContent) return alert('제목과 내용을 입력해주세요.');
    
    if (selectedInquiry?.id) {
       const payload = { title: formTitle, content: formContent };
       if (isAdmin && replyContent !== undefined) {
          payload.reply = replyContent;
          if (replyContent.trim() !== '') {
             payload.status = 'answered';
          } else {
             payload.status = 'pending';
             payload.reply = null;
          }
       }
       await supabase.from('inquiries').update(payload).eq('id', selectedInquiry.id);
    } else {
       await supabase.from('inquiries').insert([{ user_id: currentUser.id, title: formTitle, content: formContent }]);
    }
    resetForms();
    fetchInquiries(currentUser, isAdmin);
  };

  const handleDeleteInquiry = async (id) => {
    if (!window.confirm('이 문의글을 삭제하시겠습니까?')) return;
    await supabase.from('inquiries').delete().eq('id', id);
    setSelectedInquiry(null);
    fetchInquiries(currentUser, isAdmin);
  };

  const handleSaveReply = async (id) => {
    if (!replyContent) return alert('답변 내용을 입력해주세요.');
    await supabase.from('inquiries').update({ 
      reply: replyContent, 
      status: 'answered', 
      replied_at: new Date().toISOString() 
    }).eq('id', id);
    
    setReplyContent('');
    setSelectedInquiry(null);
    fetchInquiries(currentUser, isAdmin);
  };

  const resetForms = () => {
    setFormTitle('');
    setFormContent('');
    setReplyContent('');
    setIsWritingNotice(false);
    setIsWritingInquiry(false);
    setSelectedNotice(null);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  // 🚀 새 글 알림 로직 (7일 이내 작성 기준)
  const isNew = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return (now - date) <= 7 * 24 * 60 * 60 * 1000;
  };

  const hasNewNotice = notices.some(n => isNew(n.created_at));
  const hasNewInquiry = inquiries.some(i => isAdmin ? (isNew(i.created_at) && i.status === 'pending') : (isNew(i.replied_at) && i.status === 'answered'));

  // 🚀 리스트 페이징 로직 (3개씩 노출)
  const currentNotices = notices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalNoticePages = Math.ceil(notices.length / itemsPerPage);

  const currentInquiries = inquiries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalInquiryPages = Math.ceil(inquiries.length / itemsPerPage);

  const renderPagination = (totalPages) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-center items-center gap-4 mt-5">
        <button 
          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs font-bold text-slate-500">{currentPage} / {totalPages}</span>
        <button 
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center p-4 sm:p-0 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[500px] h-[85vh] sm:h-[700px] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-slate-900 text-white pt-6 pb-4 px-6 shrink-0 relative">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
          <h2 className="text-xl font-black mb-5">소통 라운지</h2>
          
          <div className="flex bg-slate-800 p-1 rounded-xl w-full">
            <button 
              onClick={() => { setActiveTab('notice'); resetForms(); setSelectedInquiry(null); }} 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'notice' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Bell size={16}/> 공지사항
              {hasNewNotice && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full ml-0.5"></span>}
            </button>
            <button 
              onClick={() => { setActiveTab('inquiry'); resetForms(); setSelectedNotice(null); }} 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'inquiry' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <MessageSquare size={16}/> 1:1 문의
              {hasNewInquiry && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full ml-0.5"></span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 relative flex flex-col">
          
          {/* ===================== 공지사항 탭 ===================== */}
          {activeTab === 'notice' && (
            <>
              {!isWritingNotice && !selectedNotice && (
                <div className="flex flex-col h-full">
                  <div className="space-y-3 flex-1">
                    {isAdmin && (
                      <button onClick={() => setIsWritingNotice(true)} className="w-full py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl font-bold text-sm mb-2 transition-colors">
                        + 새 공지사항 작성 (관리자 전용)
                      </button>
                    )}
                    {notices.length === 0 ? (
                      <div className="text-center py-20 text-slate-400 font-bold text-sm">등록된 공지사항이 없습니다.</div>
                    ) : (
                      currentNotices.map(notice => (
                        <div key={notice.id} onClick={() => setSelectedNotice(notice)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 cursor-pointer flex justify-between items-center transition-all">
                          <div className="overflow-hidden pr-3">
                            <h3 className="font-extrabold text-slate-800 text-[15px] truncate flex items-center gap-2">
                              {notice.title}
                              {isNew(notice.created_at) && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shrink-0">N</span>}
                            </h3>
                            <span className="text-[11px] font-bold text-slate-400">{formatDate(notice.created_at)}</span>
                          </div>
                          <ChevronRight size={18} className="text-slate-300 shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                  {renderPagination(totalNoticePages)}
                </div>
              )}

              {selectedNotice && !isWritingNotice && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-h-full flex flex-col">
                  <button onClick={() => setSelectedNotice(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xs mb-4 flex items-center gap-1 shrink-0"><ArrowLeft size={14}/> 목록으로</button>
                  <h3 className="text-lg font-black text-slate-900 mb-1 leading-tight flex items-center gap-2">
                    {selectedNotice.title}
                    {isNew(selectedNotice.created_at) && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shrink-0">NEW</span>}
                  </h3>
                  <div className="text-xs text-slate-400 font-bold mb-5 pb-4 border-b border-slate-100">{formatDate(selectedNotice.created_at)}</div>
                  <div className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap flex-1">{selectedNotice.content}</div>
                  
                  {isAdmin && (
                    <div className="flex gap-2 mt-8 pt-4 border-t border-slate-100 shrink-0">
                      <button onClick={() => { setFormTitle(selectedNotice.title); setFormContent(selectedNotice.content); setIsWritingNotice(true); }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 flex justify-center items-center gap-1"><Edit3 size={14}/> 수정</button>
                      <button onClick={() => handleDeleteNotice(selectedNotice.id)} className="flex-1 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl text-xs hover:bg-rose-100 flex justify-center items-center gap-1"><Trash2 size={14}/> 삭제</button>
                    </div>
                  )}
                </div>
              )}

              {isWritingNotice && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="font-black text-slate-800">{selectedNotice ? '공지사항 수정' : '새 공지사항 작성'}</h3>
                    <button onClick={resetForms} className="text-slate-400 font-bold text-xs">취소</button>
                  </div>
                  <input type="text" placeholder="제목을 입력하세요" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 shrink-0" />
                  <textarea placeholder="공지 내용을 입력하세요" value={formContent} onChange={e => setFormContent(e.target.value)} className="w-full flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:border-indigo-500 mb-3" />
                  <button onClick={handleSaveNotice} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shrink-0">저장하기</button>
                </div>
              )}
            </>
          )}

          {/* ===================== 1:1 문의 탭 ===================== */}
          {activeTab === 'inquiry' && (
            <>
              {!isWritingInquiry && !selectedInquiry && (
                <div className="flex flex-col h-full">
                  <div className="space-y-3 flex-1">
                    {!isAdmin && (
                      <button onClick={() => setIsWritingInquiry(true)} className="w-full py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-bold text-sm mb-2 transition-colors flex items-center justify-center gap-2">
                        <MessageSquare size={16}/> 관리자에게 1:1 문의하기
                      </button>
                    )}
                    {inquiries.length === 0 ? (
                      <div className="text-center py-20 text-slate-400 font-bold text-sm">등록된 문의 내역이 없습니다.</div>
                    ) : (
                      currentInquiries.map(inq => {
                        const isNewReply = isNew(inq.replied_at) && inq.status === 'answered' && !isAdmin;
                        const isNewInq = isNew(inq.created_at) && inq.status === 'pending' && isAdmin;
                        const showNewBadge = isNewReply || isNewInq;

                        return (
                          <div key={inq.id} onClick={() => setSelectedInquiry(inq)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 cursor-pointer flex justify-between items-center transition-all">
                            <div className="overflow-hidden pr-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                {inq.status === 'answered' ? (
                                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><CheckCircle2 size={10}/> 답변완료</span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><AlertCircle size={10}/> 답변대기</span>
                                )}
                                <span className="text-[11px] font-bold text-slate-400">{formatDate(inq.created_at)}</span>
                              </div>
                              <h3 className="font-extrabold text-slate-800 text-[14px] truncate flex items-center gap-2">
                                {inq.title}
                                {showNewBadge && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shrink-0">N</span>}
                              </h3>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 shrink-0" />
                          </div>
                        )
                      })
                    )}
                  </div>
                  {renderPagination(totalInquiryPages)}
                </div>
              )}

              {selectedInquiry && !isWritingInquiry && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-h-full flex flex-col">
                  <button onClick={() => setSelectedInquiry(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xs mb-4 flex items-center gap-1 shrink-0"><ArrowLeft size={14}/> 목록으로</button>
                  
                  <div className="mb-6 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded">Q. 질문</span>
                      <span className="text-[11px] text-slate-400 font-bold">{formatDate(selectedInquiry.created_at)}</span>
                    </div>
                    <h3 className="text-[15px] font-black text-slate-900 mb-2">{selectedInquiry.title}</h3>
                    <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">{selectedInquiry.content}</div>
                  </div>

                  {selectedInquiry.status === 'answered' ? (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10}/> A. 관리자 답변</span>
                        <span className="text-[11px] text-slate-400 font-bold">{formatDate(selectedInquiry.replied_at)}</span>
                        {(!isAdmin && isNew(selectedInquiry.replied_at)) && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">NEW</span>}
                      </div>
                      <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">{selectedInquiry.reply}</div>
                    </div>
                  ) : (
                    isAdmin ? (
                      <div className="mt-auto pt-4 border-t border-slate-100 mb-4 shrink-0">
                        <label className="block text-[11px] font-bold text-emerald-700 mb-2">관리자 답변 작성</label>
                        <textarea placeholder="답변 내용을 입력하세요..." value={replyContent} onChange={e => setReplyContent(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 mb-2 h-24" />
                        <button onClick={() => handleSaveReply(selectedInquiry.id)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"><Send size={14}/> 답변 등록 완료</button>
                      </div>
                    ) : (
                      <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-slate-100 text-center mb-4 shrink-0">
                        <AlertCircle className="mx-auto text-amber-400 mb-2" size={24} />
                        <p className="text-xs text-slate-500 font-bold">관리자가 아직 내용을 확인 중입니다.<br/>답변이 등록될 때까지 잠시만 기다려주세요.</p>
                      </div>
                    )
                  )}

                  {(isAdmin || selectedInquiry.user_id === currentUser?.id) && (
                    <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 shrink-0">
                      <button onClick={() => { 
                        setFormTitle(selectedInquiry.title); 
                        setFormContent(selectedInquiry.content); 
                        setReplyContent(selectedInquiry.reply || ''); 
                        setIsWritingInquiry(true); 
                      }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 flex justify-center items-center gap-1"><Edit3 size={14}/> 수정</button>
                      <button onClick={() => handleDeleteInquiry(selectedInquiry.id)} className="flex-1 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl text-xs hover:bg-rose-100 flex justify-center items-center gap-1"><Trash2 size={14}/> 삭제</button>
                    </div>
                  )}
                </div>
              )}

              {isWritingInquiry && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="font-black text-slate-800">{selectedInquiry ? '문의글 수정' : '1:1 문의하기'}</h3>
                    <button onClick={resetForms} className="text-slate-400 font-bold text-xs">취소</button>
                  </div>
                  
                  <input type="text" placeholder="문의 제목을 입력하세요" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 shrink-0" />
                  <textarea placeholder="궁금한 사항이나 건의할 내용을 자유롭게 남겨주세요." value={formContent} onChange={e => setFormContent(e.target.value)} className="w-full flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 mb-3" />
                  
                  {isAdmin && selectedInquiry && (
                    <>
                      <label className="text-xs font-bold text-emerald-700 mb-1 block shrink-0">관리자 답변 수정</label>
                      <textarea placeholder="답변 내용을 수정하세요." value={replyContent} onChange={e => setReplyContent(e.target.value)} className="w-full flex-1 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm outline-none resize-none focus:border-emerald-500 mb-3" />
                    </>
                  )}

                  <button onClick={handleSaveInquiry} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shrink-0">저장하기</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}