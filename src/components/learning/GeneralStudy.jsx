import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { callGeminiAPI } from '../../utils/geminiAPI'; 
import { getChoseong } from '../../utils/learningData';
import { 
  UploadCloud, List, Repeat, PenTool, Brain, CheckSquare, 
  ArrowLeft, Lightbulb, ChevronRight, CheckCircle, XCircle,
  FileText, RefreshCw, Trash2
} from 'lucide-react';

const parseAIResponse = (text) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("AI 응답 JSON 파싱 실패:", text);
    throw new Error("AI 응답 포맷이 올바르지 않습니다.");
  }
};

const highlightText = (text, keywords) => {
  if (!text) return '';
  if (!keywords || keywords.length === 0) return text;
  
  const validKeywords = keywords.filter(k => k && k.trim() !== '');
  if (validKeywords.length === 0) return text;
  
  const escaped = validKeywords
    .map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
    
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    if (escaped.some(k => new RegExp(`^${k}$`, 'i').test(part))) {
      return (
        <mark key={i} className="bg-amber-200 text-amber-900 px-1 rounded-sm font-extrabold shadow-sm">
          {part}
        </mark>
      );
    }
    return part;
  });
};

const generateBlanksLocally = (text, keywords) => {
  if (!text) return [];
  const validKeywords = (keywords || []).filter(k => k && k.trim() !== '');
  if (validKeywords.length === 0) return [{ isBlank: false, text }];
  
  const escaped = validKeywords
    .map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
    
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map(part => {
    if (part === '') return null;
    if (escaped.some(k => new RegExp(`^${k}$`, 'i').test(part))) {
      return { isBlank: true, text: part };
    }
    return { isBlank: false, text: part };
  }).filter(Boolean);
};

const sortKeywordsByText = (keywords, text) => {
  if (!text) return keywords;
  return [...keywords].sort((a, b) => {
    const indexA = text.indexOf(a);
    const indexB = text.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  });
};

// 🚀 onNavigate props 추가
export default function GeneralStudy({ onBack, onNavigate }) {
  const [generalTab, setGeneralTab] = useState('study'); 
  const [toastMsg, setToastMsg] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [generalData, setGeneralData] = useState([]); 
  const [quizData, setQuizData] = useState([]); 
  const [generalReviewList, setGeneralReviewList] = useState([]); 

  useEffect(() => {
    fetchMyData();
  }, []);

  const fetchMyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [essaysRes, quizzesRes, reviewsRes] = await Promise.all([
      supabase.from('general_essays').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('general_quizzes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('general_reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    if (essaysRes.data) {
      setGeneralData(essaysRes.data.map(d => ({
        id: d.id,
        subject: d.subject,
        question: d.question,
        parsedStructure: d.parsed_structure,
        blanks: d.blanks
      })));
    }
    if (quizzesRes.data) setQuizData(quizzesRes.data);
    if (reviewsRes.data) {
      setGeneralReviewList(reviewsRes.data.map(d => ({
        reviewId: d.id,
        ...d.quiz_data
      })));
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleGeneralUpload = async (payload) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('로그인이 필요합니다.');
      return;
    }

    setIsAnalyzing(true);
    setGeneralTab('study'); 

    try {
      const prompt = `
다음 입력된 자료를 분석하여 서술형 학습 데이터를 생성해줘.
입력 자료 안에 여러 개의 문제가 포함되어 있다면, 반드시 문제별로 분리해서 배열(Array) 형태로 반환해야 해.
응답은 반드시 마크다운(\`\`\`)을 제외한 순수 JSON 배열([ {...}, {...} ]) 포맷만 반환해.

[입력 자료]
${payload.type === 'text' 
  ? `문제: ${payload.question}\n모범답안: ${payload.answer}` 
  : `문서 내용: ${payload.fileContent}`}

[요구사항]
1. 자료 안에 여러 문제가 있다면 완벽히 분리하여 각각 객체로 만들 것.
2. 'question' 항목에는 번호(예: 1., 2.)를 포함하여 명확한 문제 문장을 작성할 것.
3. 문서 내에 모범 답안이 명확하지 않거나 없다면, AI가 해당 문제에 대한 가장 훌륭한 모범 답안('original_answer')을 스스로 작성해 줄 것.
4. 그 답안을 바탕으로 서론, 본론, 결론의 뼈대(parsedStructure)를 나누고 핵심 키워드를 추출할 것. 
   **주의: 'content'에는 내용을 임의로 요약/축약하지 말고, 원본 텍스트(또는 생성한 답안 텍스트)를 분할해서 전체를 그대로 다 넣을 것.**
5. 문장들을 분석하여 핵심 단어들에 빈칸(isBlank: true)을 뚫어 훈련용 객체(blanks)로 만들 것. (서론, 본론, 결론으로 분리된 구조 유지)

[출력 JSON 포맷 예시 - 반드시 배열([]) 객체로 반환할 것]
[
  {
    "question": "1. 첫 번째 문제 문장",
    "original_answer": "첫 번째 문제에 대한 모범 답안 전체 텍스트",
    "parsedStructure": {
      "intro": { "title": "서론", "content": "서론 텍스트 전체 그대로", "keywords": ["키워드1", "키워드2"] },
      "body": { "title": "본론", "content": "본론 텍스트 전체 그대로", "keywords": ["키워드3"] },
      "conclusion": { "title": "결론", "content": "결론 텍스트 전체 그대로", "keywords": ["키워드4"] }
    },
    "blanks": {
      "intro": [ { "isBlank": false, "text": "일반 텍스트 " }, { "isBlank": true, "text": "키워드1" } ],
      "body": [ { "isBlank": false, "text": "일반 텍스트 " }, { "isBlank": true, "text": "키워드3" } ],
      "conclusion": [ { "isBlank": false, "text": "일반 텍스트 " }, { "isBlank": true, "text": "키워드4" } ]
    }
  }
]
`;
      const responseText = await callGeminiAPI(prompt); 
      let parsedAI = parseAIResponse(responseText);

      if (!Array.isArray(parsedAI)) {
        if (parsedAI.questions && Array.isArray(parsedAI.questions)) parsedAI = parsedAI.questions;
        else parsedAI = [parsedAI];
      }

      const newItems = parsedAI.map((item, idx) => ({
        id: `t_${Date.now()}_${idx}`,
        user_id: user.id,
        subject: payload.subject || '일반과목 / 과제',
        question: item.question,
        original_answer: item.original_answer,
        parsed_structure: item.parsedStructure,
        blanks: item.blanks
      }));

      const { error } = await supabase.from('general_essays').insert(newItems);
      if (error) throw error;

      const formattedItems = newItems.map(item => ({ ...item, parsedStructure: item.parsed_structure }));
      setGeneralData(prev => [...formattedItems, ...prev]);
      
      showToast(`AI 분석 완료! ${newItems.length}개의 문제가 분류되어 저장되었습니다.`);
    } catch (error) {
      console.error("AI 연동/저장 에러:", error);
      showToast(`분석 중 오류가 발생했습니다. AI 서버 상태를 확인해 주세요.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateData = async (updatedItem) => {
    const { error } = await supabase
      .from('general_essays')
      .update({
        question: updatedItem.question,
        parsed_structure: updatedItem.parsedStructure,
        blanks: updatedItem.blanks 
      })
      .eq('id', updatedItem.id);

    if (!error) {
      setGeneralData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      showToast('수정된 내용과 빈칸 데이터가 성공적으로 저장되었습니다.');
    } else {
      showToast('수정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteData = async (id, mode) => {
    if (!window.confirm("정말 이 문제를 삭제하시겠습니까?")) return;

    if (mode === 'essay') {
      const { error } = await supabase.from('general_essays').delete().eq('id', id);
      if (!error) {
        setGeneralData(prev => prev.filter(item => item.id !== id));
        showToast('문제가 삭제되었습니다.');
      }
    } else {
      const { error } = await supabase.from('general_quizzes').delete().eq('id', id);
      if (!error) {
        setQuizData(prev => prev.filter(item => item.id !== id));
        showToast('퀴즈가 삭제되었습니다.');
      }
    }
  };

  const handleGeneralFail = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (generalReviewList.some(r => r.id === item.id)) return;

    const reviewRecord = {
      id: `rev_${Date.now()}`,
      user_id: user.id,
      quiz_data: item
    };

    await supabase.from('general_reviews').insert(reviewRecord);
    setGeneralReviewList(prev => [...prev, { reviewId: reviewRecord.id, ...item }]);
  };

  const handleGeneralSuccess = async (id) => {
    const targetReview = generalReviewList.find(r => r.id === id);
    if (!targetReview) return;

    await supabase.from('general_reviews').delete().eq('id', targetReview.reviewId);
    setGeneralReviewList(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-right-4 duration-300 relative">
      
      {/* 🚀 통합 상단 네비게이션 바 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        {onBack ? (
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold px-3 py-2 rounded-xl transition-colors text-xs hover:bg-slate-50"
          >
            <ArrowLeft size={15} /> 대시보드로 돌아가기
          </button>
        ) : <div />}
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto shrink-0">
          <button className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all bg-white shadow text-emerald-700 pointer-events-none">
            일반 과목 학습
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('learning_biblical')}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
          >
            성서 원어 훈련
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[999] bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in text-xs whitespace-nowrap">
          <CheckCircle size={14} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-x-auto no-scrollbar">
         <button onClick={() => setGeneralTab('upload')} className={`flex-1 px-4 py-3 text-xs font-black rounded-xl transition-all ${generalTab === 'upload' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>문제/답안 등록</button>
         <button onClick={() => setGeneralTab('study')} className={`flex-1 px-4 py-3 text-xs font-black rounded-xl transition-all ${generalTab === 'study' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
           문제 목록 및 학습 {(generalData.length > 0 || quizData.length > 0) && <span className="ml-1 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{generalData.length + quizData.length}</span>}
         </button>
         <button onClick={() => setGeneralTab('review')} className={`flex-1 px-4 py-3 text-xs font-black rounded-xl transition-all ${generalTab === 'review' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
           오답 노트 {generalReviewList.length > 0 && <span className="ml-1 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{generalReviewList.length}</span>}
         </button>
      </div>

      {generalTab === 'upload' && <GeneralUploadTab onUpload={handleGeneralUpload} />}
      
      {generalTab === 'study' && (
        isAnalyzing ? (
          <div className="bg-white p-10 md:p-20 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <RefreshCw className="animate-spin text-emerald-500 mb-5" size={48} />
            <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-2">AI가 학습 데이터를 분석하고 있습니다</h3>
            <p className="text-xs md:text-sm text-slate-500 mb-6 text-center leading-relaxed">
              입력하신 파일 내의 복수 문제를 분리하고, 필요한 답안을 자동 작성하며<br className="hidden md:block"/>단락별 뼈대 구조화 및 빈칸 훈련 세트를 생성 중입니다. (약 10~20초 소요)
            </p>
            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 w-1/2 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] origin-left"></div>
            </div>
          </div>
        ) : (
          <GeneralStudyTab 
            dataList={generalData} 
            quizList={quizData}
            onUpdateData={handleUpdateData}
            onDeleteData={handleDeleteData}
            onFail={handleGeneralFail}
            onSuccess={handleGeneralSuccess}
          />
        )
      )}
      
      {generalTab === 'review' && (
        <GeneralReviewTab 
          reviewList={generalReviewList}
          onFail={handleGeneralFail}
          onSuccess={handleGeneralSuccess}
        />
      )}
    </div>
  );
}

function GeneralUploadTab({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [fileSubject, setFileSubject] = useState('구약개론 / 중간고사');

  const handleTextSubmit = () => {
    if(!subject || !question) return;
    setIsParsing(true);
    setTimeout(() => { 
      setIsParsing(false); 
      onUpload({ type: 'text', subject, question, answer }); 
    }, 100);
  };

  const processFile = (file) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setIsParsing(false);
      onUpload({ type: 'file', subject: fileSubject || '기본 과목', fileContent: event.target.result });
    };
    reader.onerror = () => {
      setIsParsing(false);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3 animate-in fade-in duration-300 pb-6">
      <div className="bg-emerald-900 text-white p-4 rounded-3xl shadow-md">
         <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Brain size={15} className="text-emerald-400" /> 일반 과목 AI 논술 분석기</h2>
         <p className="text-emerald-100 text-xs leading-relaxed max-w-lg">문제(다수 가능)가 포함된 교재 텍스트 파일을 통째로 넣어도 AI가 문항별로 분리하고 답안을 작성하여 구조화합니다.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col space-y-2">
           <div className="flex items-center gap-1.5"><PenTool className="text-emerald-500" size={13}/><h3 className="text-xs font-bold text-slate-800">텍스트 직접 입력</h3></div>
           <div><label className="block text-[11px] font-bold text-slate-700 mb-1">과목/분류명</label><input type="text" placeholder="예) 구약개론 / 중간고사" className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500" value={subject} onChange={e => setSubject(e.target.value)} /></div>
           <div><label className="block text-[11px] font-bold text-slate-700 mb-1">문제 (필수)</label><textarea rows={2} placeholder="출제될 문제를 입력하세요." className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none resize-none focus:border-emerald-500" value={question} onChange={e => setQuestion(e.target.value)} /></div>
           <div className="flex-1 flex flex-col"><label className="block text-[11px] font-bold text-slate-700 mb-1">모범 답안 (선택)</label><textarea rows={3} placeholder="비워두시면 AI가 모범답안을 스스로 작성합니다." className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none resize-none flex-1 focus:border-emerald-500" value={answer} onChange={e => setAnswer(e.target.value)} /></div>
           <button onClick={handleTextSubmit} disabled={isParsing || !subject || !question} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-transform active:scale-95 disabled:opacity-70">
              {isParsing ? '준비 중...' : '입력 내용 AI 분석 시작'}
           </button>
        </div>

        <div className="bg-emerald-50 p-4 rounded-3xl shadow-sm border-2 border-emerald-200 flex flex-col relative">
           <div className="mb-2 flex items-center gap-1.5"><UploadCloud className="text-emerald-600" size={13}/><h3 className="text-xs font-bold text-emerald-900">파일 첨부 / 다중 문제 인식</h3></div>
           <div className="mb-2"><label className="block text-[11px] font-bold text-emerald-800 mb-1">과목/분류명 지정</label><input type="text" placeholder="예) 구약개론 / 기말과제" className="w-full p-2.5 text-xs border border-emerald-200 rounded-xl outline-none bg-white font-bold text-emerald-900 focus:border-emerald-500" value={fileSubject} onChange={e => setFileSubject(e.target.value)} /></div>
           
           <input type="file" id="file-upload" className="hidden" accept=".txt,.md,.csv" onChange={handleFileInputChange} />
           
           <label 
             htmlFor="file-upload"
             onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
             onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
             onDrop={handleFileDrop}
             className={`border-2 border-dashed rounded-3xl flex-1 flex flex-col items-center justify-center p-5 text-center transition-all cursor-pointer ${isDragging ? 'border-emerald-500 bg-emerald-100' : 'border-emerald-300 bg-white/60 hover:bg-white'}`}
           >
             {isParsing ? (
               <div className="flex flex-col items-center"><RefreshCw className="animate-spin text-emerald-600 mb-1.5" size={26} /><p className="text-emerald-900 font-bold text-xs">문서를 읽는 중...</p></div>
             ) : (
               <div>
                 <FileText className="text-emerald-400 mx-auto mb-2" size={32} />
                 <p className="font-bold text-emerald-900 text-xs mb-1.5">다중 문제 텍스트 파일 드래그</p>
                 <span className="text-[11px] text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-200 inline-block font-bold">클릭하여 파일 찾기 (.txt)</span>
               </div>
             )}
           </label>
        </div>
      </div>
    </div>
  );
}

function GeneralStudyTab({ dataList, quizList, onUpdateData, onDeleteData, onFail, onSuccess }) {
  const [selectedId, setSelectedId] = useState(null);
  const [studyMode, setStudyMode] = useState('essay'); 

  if(dataList.length === 0 && quizList.length === 0) return (
    <div className="text-center py-8 animate-in fade-in">
      <UploadCloud size={24} className="mx-auto mb-1.5 text-slate-300" />
      <div className="text-slate-500 font-bold text-xs">등록된 문제가 없습니다. 새로운 문제를 등록해 보세요.</div>
    </div>
  );

  const groupedData = (studyMode === 'essay' ? dataList : quizList).reduce((acc, item) => {
    const subj = item.subject || '미분류';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(item);
    return acc;
  }, {});

  if (!selectedId) {
    return (
      <div className="max-w-4xl mx-auto space-y-3 animate-in fade-in duration-300">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-fit mx-auto mb-3">
           <button onClick={() => setStudyMode('essay')} className={`flex-1 sm:flex-none px-6 py-2 text-xs font-bold rounded-xl transition-all ${studyMode === 'essay' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}><PenTool size={13} className="inline mr-1"/> 서술형/논술형</button>
           <button onClick={() => setStudyMode('quiz')} className={`flex-1 sm:flex-none px-6 py-2 text-xs font-bold rounded-xl transition-all ${studyMode === 'quiz' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}><CheckSquare size={13} className="inline mr-1"/> 객관식/단답형</button>
        </div>
        <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
          <List size={14} className={studyMode === 'essay' ? "text-emerald-500" : "text-indigo-500"} /> 
          {studyMode === 'essay' ? '서술형 과목별 목록' : '객관식/단답형 과목별 목록'}
        </h2>
        {Object.entries(groupedData).map(([subjectName, items]) => (
          <div key={subjectName} className="mb-3.5">
            <h3 className={`text-xs font-extrabold px-3.5 py-1.5 rounded-t-2xl inline-block border-t border-l border-r ${studyMode === 'essay' ? 'text-emerald-800 bg-emerald-100 border-emerald-200' : 'text-indigo-800 bg-indigo-100 border-indigo-200'}`}>
              📁 {subjectName} <span className="font-normal">({items.length})</span>
            </h3>
            <div className={`p-3 rounded-b-3xl rounded-tr-3xl border space-y-2.5 ${studyMode === 'essay' ? 'bg-emerald-50/20 border-emerald-100' : 'bg-indigo-50/20 border-indigo-100'}`}>
              {items.map(item => (
                <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm transition-all group flex items-start justify-between gap-3 hover:border-emerald-400 hover:shadow-md">
                  <div onClick={() => setSelectedId(item.id)} className="flex-1 flex items-start gap-2.5 cursor-pointer min-w-0">
                    {studyMode === 'quiz' && <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 mt-0.5 ${item.type === 'multiple' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{item.type === 'multiple' ? '객관식' : '단답형'}</span>}
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors leading-relaxed break-keep whitespace-normal">{item.question}</h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <button onClick={() => setSelectedId(item.id)} className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 flex items-center gap-1">학습하기 <ChevronRight size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteData(item.id, studyMode === 'essay' ? 'essay' : 'quiz'); }} className="p-1.5 text-gray-300 hover:text-rose-500 rounded-lg transition-colors" title="문제 삭제">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (studyMode === 'essay') {
    const data = dataList.find(d => d.id === selectedId);
    return <GeneralStudyDetail data={data} onBack={() => setSelectedId(null)} onUpdateData={onUpdateData} onDeleteData={onDeleteData} />;
  } else {
    const data = quizList.find(d => d.id === selectedId);
    return <QuizDetailView data={data} onBack={() => setSelectedId(null)} onFail={onFail} onSuccess={onSuccess} />;
  }
}

function QuizDetailView({ data, onBack, onFail, onSuccess }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showChoseong, setShowChoseong] = useState(false);

  const handleSubmit = () => {
    let correct = false;
    if (data.type === 'multiple') correct = (selectedOption === data.answer);
    else correct = (shortAnswerInput.replace(/\s+/g, '') === data.answer.replace(/\s+/g, ''));
    
    setIsCorrect(correct);
    setIsSubmitted(true);
    if (correct) { if (onSuccess) onSuccess(data.id); } 
    else { if (onFail) onFail(data); }
  };

  const handleGiveUp = () => {
    setIsCorrect(false);
    setIsSubmitted(true);
    if(data.type === 'short') setShortAnswerInput(data.answer);
    if (onFail) onFail(data);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 animate-in slide-in-from-bottom-3 duration-300 pb-6">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"><ArrowLeft size={13} /> 목록으로 돌아가기</button>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
          <span className="font-bold text-indigo-800 text-xs flex items-center gap-1.5"><Brain size={13} /> {data.subject} - {data.type === 'multiple' ? '객관식' : '단답형'}</span>
        </div>
        <div className="p-5">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-4 leading-relaxed"><span className="text-indigo-500 mr-1.5">Q.</span>{data.question}</h3>
          {data.type === 'multiple' && (
            <div className="space-y-2 mb-5">
              {data.options.map((opt, i) => {
                let btnClass = "w-full text-left p-3 rounded-2xl border text-xs font-medium transition-all ";
                if (isSubmitted) {
                  if (opt === data.answer) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold";
                  else if (opt === selectedOption) btnClass += "bg-rose-50 border-rose-400 text-rose-800";
                  else btnClass += "bg-slate-50 border-slate-200 text-slate-400";
                } else {
                  btnClass += selectedOption === opt ? "bg-indigo-50 border-indigo-500 text-indigo-900" : "bg-white border-slate-200 hover:border-indigo-300 text-slate-700";
                }
                return <button key={i} disabled={isSubmitted} onClick={() => setSelectedOption(opt)} className={btnClass}><span className="opacity-50 mr-2">{i+1}.</span>{opt}</button>;
              })}
            </div>
          )}
          {data.type === 'short' && (
            <div className="mb-5">
              {!isSubmitted && (
                 <div className="flex justify-end mb-1.5">
                    <button onClick={() => setShowChoseong(!showChoseong)} className={`text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 ${showChoseong ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                      <Lightbulb size={12}/> 초성 힌트 {showChoseong ? '끄기' : '켜기'}
                    </button>
                 </div>
              )}
              <div className="relative">
                {showChoseong && !isSubmitted && (
                  <div className="absolute -top-7 left-0 right-0 flex justify-center">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200 tracking-widest">{getChoseong(data.answer)}</span>
                  </div>
                )}
                <input type="text" disabled={isSubmitted} value={shortAnswerInput} onChange={(e) => setShortAnswerInput(e.target.value)} placeholder="정답 입력..." className={`w-full p-3 text-xs font-bold text-center border rounded-2xl outline-none ${isSubmitted && isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : isSubmitted && !isCorrect ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500'}`} />
              </div>
            </div>
          )}
          {!isSubmitted ? (
            <div className="flex gap-2.5">
              <button onClick={handleGiveUp} className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs">모르겠습니다</button>
              <button onClick={handleSubmit} disabled={(data.type === 'multiple' && !selectedOption) || (data.type === 'short' && !shortAnswerInput)} className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-sm text-xs disabled:opacity-50">정답 확인</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                {isCorrect ? <CheckCircle size={15} /> : <XCircle size={15} />}
                {isCorrect ? '정답입니다!' : `오답입니다. 정답: [${data.answer}]`}
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-500 uppercase block mb-1">해설</span>
                <p className="text-slate-700 leading-relaxed">{data.explanation}</p>
              </div>
              <button onClick={onBack} className="w-full py-2.5 bg-slate-800 text-white font-bold rounded-2xl text-xs">목록으로</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralStudyDetail({ data, onBack, onUpdateData, onDeleteData }) {
  const [step, setStep] = useState(1);
  const [solvedBlanks, setSolvedBlanks] = useState(new Set());
  const [blankInputs, setBlankInputs] = useState({});
  const [showChoseong, setShowChoseong] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [showHints, setShowHints] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const handleEditStart = () => {
    setEditData({
      question: data.question,
      introContent: data.parsedStructure?.intro?.content || '',
      introKeywords: (data.parsedStructure?.intro?.keywords || []).join(', '),
      bodyContent: data.parsedStructure?.body?.content || '',
      bodyKeywords: (data.parsedStructure?.body?.keywords || []).join(', '),
      conclusionContent: data.parsedStructure?.conclusion?.content || '',
      conclusionKeywords: (data.parsedStructure?.conclusion?.keywords || []).join(', ')
    });
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const introKws = sortKeywordsByText(editData.introKeywords.split(',').map(k => k.trim()).filter(k => k), editData.introContent);
    const bodyKws = sortKeywordsByText(editData.bodyKeywords.split(',').map(k => k.trim()).filter(k => k), editData.bodyContent);
    const concKws = sortKeywordsByText(editData.conclusionKeywords.split(',').map(k => k.trim()).filter(k => k), editData.conclusionContent);

    const updatedData = {
      ...data,
      question: editData.question,
      parsedStructure: {
        intro: { title: '서론', content: editData.introContent, keywords: introKws },
        body: { title: '본론', content: editData.bodyContent, keywords: bodyKws },
        conclusion: { title: '결론', content: editData.conclusionContent, keywords: concKws }
      },
      blanks: {
        intro: generateBlanksLocally(editData.introContent, introKws),
        body: generateBlanksLocally(editData.bodyContent, bodyKws),
        conclusion: generateBlanksLocally(editData.conclusionContent, concKws)
      }
    };
    
    onUpdateData(updatedData);
    setIsEditing(false);
  };

  const handleInputChange = (uniqueKey, val, correctAnswer) => {
    setBlankInputs(prev => ({ ...prev, [uniqueKey]: val }));
    if (val.replace(/\s+/g, '') === correctAnswer.replace(/\s+/g, '')) {
      setSolvedBlanks(prev => new Set(prev).add(uniqueKey));
    }
  };

  const handleTextSelection = (e, sectionKey) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedText = textarea.value.substring(start, end).trim();
      if (selectedText) {
        const keywordKey = `${sectionKey}Keywords`;
        const contentKey = `${sectionKey}Content`;
        
        let currentKeywords = editData[keywordKey].split(',').map(k => k.trim()).filter(k => k);
        
        if (!currentKeywords.includes(selectedText)) {
          const updatedKeywords = [...currentKeywords, selectedText];
          const sortedKeywords = sortKeywordsByText(updatedKeywords, editData[contentKey]);
          
          setEditData(prev => ({
            ...prev,
            [keywordKey]: sortedKeywords.join(', ')
          }));
        }
      }
    }
  };

  const renderStructureBox = (section, sectionKey) => {
    if (isEditing && editData) {
      const contentKey = `${sectionKey}Content`;
      const keywordKey = `${sectionKey}Keywords`;
      
      const currentText = editData[contentKey];
      const currentKeywords = editData[keywordKey].split(',').map(k => k.trim()).filter(k => k);
      
      return (
         <div className="bg-emerald-50/50 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm mb-3">
             <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg mb-2 inline-block">{section.title}</span>
             
             <textarea 
               value={currentText} 
               onChange={(e) => setEditData({...editData, [contentKey]: e.target.value})} 
               onMouseUp={(e) => handleTextSelection(e, sectionKey)}
               onTouchEnd={(e) => handleTextSelection(e, sectionKey)}
               className="w-full text-xs text-slate-700 mb-3 p-3 border border-emerald-200 focus:border-emerald-500 outline-none rounded-xl bg-white" 
               rows={4} 
               placeholder="본문 내용을 수정하세요. 마우스로 단어를 드래그하여 선택하면 추출 키워드로 자동 등록됩니다." 
             />
             
             <div className="mb-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <Lightbulb size={12}/> 추출 키워드 편집 <span className="text-slate-400 font-medium">(마우스 드래그 시 자동 추가 및 본문 순서대로 정렬됩니다)</span>
             </div>
             <input type="text" value={editData[keywordKey]} onChange={(e) => setEditData({...editData, [keywordKey]: e.target.value})} className="w-full bg-white border border-emerald-200 focus:border-emerald-500 outline-none text-xs p-2.5 rounded-xl mb-2" placeholder="쉼표로 구분 (예: 타낙, 구약성서)" />
             
             {currentKeywords.length > 0 && (
               <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-white rounded-xl border border-emerald-100">
                 {currentKeywords.map((kw, i) => {
                   const isFound = currentText.includes(kw);
                   return (
                     <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-md border ${isFound ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-200 line-through'}`}>
                       {kw} {isFound ? '✓' : '(본문 없음)'}
                     </span>
                   )
                 })}
               </div>
             )}
         </div>
      );
    }
    return (
       <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-3">
           <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg mb-2 inline-block">{section.title}</span>
           <div className="text-xs sm:text-sm text-slate-700 mb-4 leading-loose break-keep whitespace-pre-wrap">
             {highlightText(section.content, section.keywords)}
           </div>
           <div className="flex flex-wrap gap-1.5 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500"><Lightbulb size={12} className="inline text-amber-500"/> 추출 키워드:</span>
              {(section.keywords || []).map((kw, i) => <span key={i} className="bg-white border text-[11px] font-bold px-2.5 py-0.5 rounded-lg shadow-sm text-emerald-700">{kw}</span>)}
           </div>
       </div>
    );
  };

  const handleShowAnswers = () => {
    const allSolved = new Set();
    if (Array.isArray(data.blanks)) {
      data.blanks.forEach((_, i) => allSolved.add(i));
    } else if (data.blanks) {
      ['intro', 'body', 'conclusion'].forEach(sec => {
        if (data.blanks[sec]) {
          data.blanks[sec].forEach((_, i) => allSolved.add(`${sec}_${i}`));
        }
      });
    }
    setSolvedBlanks(allSolved);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3 animate-in fade-in duration-300 pb-6">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"><ArrowLeft size={13} /> 목록으로</button>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button onClick={handleEditStart} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-200"><PenTool size={12} /> 답안 수정</button>
              <button onClick={() => { onDeleteData(data.id, 'essay'); onBack(); }} className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-xl border border-rose-200"><Trash2 size={12} /> 삭제</button>
            </>
          ) : (
            <button onClick={handleEditSave} className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-xl shadow-sm"><CheckCircle size={13} /> 저장 완료</button>
          )}
        </div>
      </div>

      <div className="bg-slate-800 text-white p-4 rounded-3xl shadow-sm border-l-4 border-l-emerald-500">
        <span className="text-emerald-400 font-bold text-[11px] mb-1 block">과목: {data.subject}</span>
        {isEditing ? (
          <textarea value={editData.question} onChange={(e) => setEditData({...editData, question: e.target.value})} className="w-full text-xs font-bold bg-slate-700 text-white p-2 rounded-xl" rows={2} />
        ) : (
          <h3 className="text-xs sm:text-sm font-bold leading-relaxed">{data.question}</h3>
        )}
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-3xl border border-slate-200">
        {[{ id: 1, title: '1. 뼈대 구조화' }, { id: 2, title: '2. 빈칸 인출' }, { id: 3, title: '3. 백지 논술' }].map(s => (
          <button key={s.id} onClick={() => setStep(s.id)} className={`flex-1 p-2.5 rounded-2xl text-center transition-colors border text-xs font-bold ${step === s.id ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' : 'border-transparent text-slate-500'}`}>{s.title}</button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3 animate-in slide-in-from-bottom-2 bg-slate-50 p-4 rounded-3xl border border-slate-200">
           {renderStructureBox(data.parsedStructure?.intro || { title: '서론', content: '', keywords: [] }, 'intro')}
           {renderStructureBox(data.parsedStructure?.body || { title: '본론', content: '', keywords: [] }, 'body')}
           {renderStructureBox(data.parsedStructure?.conclusion || { title: '결론', content: '', keywords: [] }, 'conclusion')}
        </div>
      )}

      {step === 2 && (
         <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4 text-xs font-bold text-slate-500">
              <span>빈칸에 알맞은 키워드를 타이핑하세요.</span>
              <div className="space-x-1.5">
                <button onClick={() => setShowChoseong(!showChoseong)} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-xl text-[11px]">초성 힌트</button>
                <button onClick={handleShowAnswers} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[11px]">정답 보기</button>
              </div>
            </div>
            
            <div className="space-y-4">
              {Array.isArray(data.blanks) ? (
                <div className="leading-loose text-xs sm:text-sm text-slate-700 font-medium bg-slate-50 p-4 rounded-2xl border">
                  {data.blanks.map((part, i) => {
                    if (!part.isBlank) return <span key={i}>{part.text}</span>;
                    const isSolved = solvedBlanks.has(i);
                    return isSolved ? (
                      <span key={i} className="inline-block mx-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs shadow-sm">{part.text}</span>
                    ) : (
                      <div key={i} className="inline-flex flex-col items-center mx-1.5 relative translate-y-1">
                        {showChoseong && <span className="absolute -top-6 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">{getChoseong(part.text)}</span>}
                        <input type="text" value={blankInputs[i] || ''} onChange={(e) => handleInputChange(i, e.target.value, part.text)} placeholder="입력" className="px-2 py-1 text-center text-xs font-bold border-b-2 border-slate-400 focus:border-emerald-500 bg-white outline-none w-24 text-indigo-700" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                ['intro', 'body', 'conclusion'].map((secKey) => {
                  if (!data.blanks || !data.blanks[secKey] || data.blanks[secKey].length === 0) return null;
                  const sectionTitle = secKey === 'intro' ? '서론' : secKey === 'body' ? '본론' : '결론';

                  return (
                    <div key={secKey} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg mb-2 inline-block">{sectionTitle}</span>
                      <div className="leading-loose text-xs sm:text-sm text-slate-700 font-medium break-keep">
                        {data.blanks[secKey].map((part, i) => {
                          const uniqueKey = `${secKey}_${i}`;
                          if (!part.isBlank) return <span key={uniqueKey}>{part.text}</span>;
                          const isSolved = solvedBlanks.has(uniqueKey);
                          return isSolved ? (
                            <span key={uniqueKey} className="inline-block mx-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs shadow-sm">{part.text}</span>
                          ) : (
                            <div key={uniqueKey} className="inline-flex flex-col items-center mx-1.5 relative translate-y-1">
                              {showChoseong && <span className="absolute -top-6 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">{getChoseong(part.text)}</span>}
                              <input type="text" value={blankInputs[uniqueKey] || ''} onChange={(e) => handleInputChange(uniqueKey, e.target.value, part.text)} placeholder="입력" className="px-2 py-1 text-center text-xs font-bold border-b-2 border-slate-400 focus:border-emerald-500 bg-white outline-none w-24 text-indigo-700" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
         </div>
      )}

      {step === 3 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500">백지 논술 작성</span>
            <button onClick={() => setShowHints(!showHints)} className="text-[11px] font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-xl">뼈대 힌트 {showHints ? '끄기' : '켜기'}</button>
          </div>
          {showHints && data.parsedStructure && (
            <div className="mb-3 bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs space-y-2">
              {[data.parsedStructure.intro, data.parsedStructure.body, data.parsedStructure.conclusion].map((sec, idx) => {
                 if(!sec) return null;
                 return (
                 <div key={idx} className="flex gap-2 items-center">
                    <span className="text-[11px] font-bold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-lg">{sec.title}</span>
                    <span className="text-xs text-amber-800 font-medium">{(sec.keywords || []).join(', ')}</span>
                 </div>
                 )
              })}
            </div>
          )}
          <textarea value={typedAnswer} onChange={(e) => setTypedAnswer(e.target.value)} placeholder="뼈대 힌트를 참고하여 답안을 작성해보세요." className="w-full min-h-[140px] p-3.5 border rounded-2xl text-xs focus:outline-none focus:border-emerald-500 bg-slate-50 leading-relaxed" />
        </div>
      )}
    </div>
  );
}

function GeneralReviewTab({ reviewList, onFail, onSuccess }) {
  const [selectedId, setSelectedId] = useState(null);

  if (reviewList.length === 0) {
    return (
      <div className="text-center py-8 animate-in fade-in">
        <CheckCircle size={24} className="mx-auto mb-1.5 text-emerald-300" />
        <div className="text-slate-500 font-bold text-xs">일반 과목 오답이 없습니다.</div>
      </div>
    );
  }

  if (selectedId) {
    const data = reviewList.find(d => d.id === selectedId);
    return <QuizDetailView data={data} onBack={() => setSelectedId(null)} onFail={onFail} onSuccess={onSuccess} />;
  }

  const groupedData = reviewList.reduce((acc, item) => {
    const subj = item.subject || '미분류';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-3 animate-in fade-in duration-300 pb-6">
      <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 mb-2">
        <h2 className="text-xs font-bold text-rose-900 mb-1 flex items-center gap-1.5"><Repeat size={13}/> 과목별 오답 노트</h2>
        <p className="text-rose-700 text-xs">틀린 문제를 맞히면 오답 노트에서 자동 제외됩니다.</p>
      </div>

      {Object.entries(groupedData).map(([subjectName, items]) => (
        <div key={subjectName} className="mb-3.5">
          <h3 className="text-xs font-extrabold px-3.5 py-1.5 rounded-t-2xl inline-block text-rose-800 bg-rose-100 border border-rose-200">
            📁 {subjectName} ({items.length})
          </h3>
          <div className="p-3 rounded-b-3xl rounded-tr-3xl border space-y-2.5 bg-rose-50/20 border-rose-100">
            {items.map(item => (
              <div key={item.id} onClick={() => setSelectedId(item.id)} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer flex justify-between items-start gap-3 hover:border-rose-400">
                <span className="text-xs font-bold text-slate-800 flex-1 leading-relaxed break-keep whitespace-normal">{item.question}</span>
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1 shrink-0 mt-0.5">다시 풀기 <ChevronRight size={14}/></span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}