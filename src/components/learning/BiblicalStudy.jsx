import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { callGeminiAPI } from '../../utils/geminiAPI'; 
import { initialSentences, getParsingString } from '../../utils/learningData';
import { 
  UploadCloud, Search, BookMarked, Repeat, Play, Volume2, 
  EyeOff, Brain, Trash2, CheckCircle, XCircle, BookOpen, 
  Zap, RefreshCw, Globe, CheckSquare, Square, X, Plus, 
  Settings, Lightbulb, FileText, ArrowLeft
} from 'lucide-react';

const parseAIResponse = (text) => {
  let cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/"\s+(?="[a-zA-Z0-9_]+":)/g, '", ');
  cleaned = cleaned.replace(/}\s*(?={)/g, '}, ');
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try { return JSON.parse(`[${cleaned}]`); } catch (e2) {}
    }
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      try { return JSON.parse(cleaned.substring(startIdx, endIdx + 1)); } catch (e3) {}
    }
    console.error("AI 응답 JSON 파싱 실패 원본 텍스트:", cleaned);
    throw new Error("AI 응답 포맷이 올바르지 않습니다.");
  }
};

// 🚀 onNavigate props 추가
export default function BiblicalStudy({ onBack, onNavigate }) {
  const [biblicalTab, setBiblicalTab] = useState('upload'); 
  const [showPhonetics, setShowPhonetics] = useState(true);
  const [globalLang, setGlobalLang] = useState('all');
  const [toastMsg, setToastMsg] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [sentences, setSentences] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [reviewList, setReviewList] = useState([]);
  
  const [drillQueue, setDrillQueue] = useState([]);
  const [currentDrillMode, setCurrentDrillMode] = useState('lemma');

  useEffect(() => {
    fetchBiblicalData();
  }, []);

  const fetchBiblicalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [sentencesRes, vocabRes, reviewsRes] = await Promise.all([
      supabase.from('biblical_sentences').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('biblical_vocab').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('biblical_reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    if (sentencesRes.data && sentencesRes.data.length > 0) {
      setSentences(sentencesRes.data);
    } else {
      setSentences(initialSentences); 
    }

    if (vocabRes.data) {
      setVocabulary(vocabRes.data.map(v => ({
        ...v,
        sentenceContext: v.sentence_context,
        sentenceTranslation: v.sentence_translation
      })));
    }

    if (reviewsRes.data) {
      setReviewList(reviewsRes.data.map(r => ({
        id: r.id,
        wordObj: r.word_data,
        failedMode: r.failed_mode
      })));
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleBiblicalUpload = async (payload) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('로그인이 필요합니다.');
      return;
    }

    setIsAnalyzing(true);
    setBiblicalTab('sentences');

    try {
      const prompt = `
다음 성서 원어 텍스트를 분석하여 파싱 데이터를 생성해줘.
[최고 수준 경고 - JSON 문법 절대 엄수]
응답은 반드시 처음 시작을 '['로, 끝을 ']'로 닫는 완벽한 JSON 배열 포맷이어야 해.
1. 모든 문자열 값(Value)은 반드시 큰따옴표(")로 감싸야 해!
2. 속성(Key-Value)들 사이에는 반드시 쉼표(,)를 넣어!

[입력 자료]
${payload.type === 'text' ? payload.content : payload.fileContent}

[요구사항]
1. 문장 단위로 분리하여 객체 배열로 만들 것.
2. 'language'는 'greek' 또는 'hebrew'로 지정.
3. 'original'은 원어 문장, 'translation'은 한글 번역.
4. 'words' 배열에는 단어들을 파싱하여 담을 것.
5. 단어 객체의 공통 필수 속성: "id", "word", "lemma", "pos", "meaning", "pronunciation"
6. [매우 중요 - 세부 파싱] 품사에 따라 아래의 문법 속성을 추가할 것:
   - 동사(Verb)인 경우: "tense"(시제: 미완료, 현재, 부정과거 등), "voice"(태: 능동, 수동, 중간태 등), "mood"(법: 직설법, 가정법 등), "person"(인칭: 1인칭, 3인칭 등), "number"(수: 단수, 복수)
   - 명사/대명사/관사/형용사인 경우: "gender"(성: 남성, 여성, 중성), "number"(수: 단수, 복수), "case"(격: 주격, 소유격, 여격, 목적격 등)

[출력 예시 - 반드시 이 배열 형식 유지]
[
  {
    "language": "greek",
    "original": "Ἐν ἀρχῇ",
    "translation": "태초에",
    "words": [
      { "id": "w1", "word": "Ἐν", "lemma": "ἐν", "pos": "전치사", "meaning": "~안에", "pronunciation": "엔" },
      { "id": "w2", "word": "ἀρχῇ", "lemma": "ἀρχή", "pos": "명사", "meaning": "태초, 시작", "pronunciation": "아르케", "gender": "여성", "number": "단수", "case": "여격" }
    ]
  }
]
`;
      const responseText = await callGeminiAPI(prompt, "성서 원어 형태소 파싱"); 
      let parsedAI = parseAIResponse(responseText);

      let sentencesArray = [];
      if (Array.isArray(parsedAI)) {
        sentencesArray = parsedAI;
      } else if (parsedAI.sentences && Array.isArray(parsedAI.sentences)) {
        sentencesArray = parsedAI.sentences;
      } else if (parsedAI.data && Array.isArray(parsedAI.data)) {
        sentencesArray = parsedAI.data;
      } else {
        const arrVal = Object.values(parsedAI).find(val => Array.isArray(val));
        sentencesArray = arrVal || [parsedAI];
      }

      const newSentences = sentencesArray.map((item, idx) => ({
        id: `s_${Date.now()}_${idx}`,
        user_id: user.id,
        language: item.language || 'greek',
        original: item.original || '문장 분석 실패',
        translation: item.translation || '',
        words: Array.isArray(item.words) ? item.words.map((w, wIdx) => ({
          ...w,
          id: w.id || `w_${Date.now()}_${idx}_${wIdx}` 
        })) : [],
        is_exam_mode: payload.isExamMode || false
      }));

      const { error } = await supabase.from('biblical_sentences').insert(newSentences);
      if (error) {
        console.error("DB Insert 에러:", error);
        throw error;
      }

      setSentences(prev => [...newSentences, ...prev]);
      showToast(`AI 파싱 완료! ${newSentences.length}개의 원어 문장이 저장되었습니다.`);
    } catch (error) {
      console.error("AI 처리/저장 에러:", error);
      showToast(`분석 중 오류가 발생했습니다. 다시 시도해주세요.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddVocab = async (words) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newVocabs = words.filter(w => !vocabulary.some(existing => existing.word === w.word)).map(w => ({
      id: `v_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      user_id: user.id,
      language: w.language,
      word: w.word,
      lemma: w.lemma,
      pos: w.pos,
      meaning: w.meaning,
      pronunciation: w.pronunciation,
      sentence_context: w.sentenceContext,
      sentence_translation: w.sentenceTranslation
    }));

    if (newVocabs.length === 0) {
      showToast('이미 단어장에 있는 단어들입니다.');
      return;
    }

    const { error } = await supabase.from('biblical_vocab').insert(newVocabs);
    if (!error) {
      const stateVocabs = newVocabs.map(v => ({
        ...v, sentenceContext: v.sentence_context, sentenceTranslation: v.sentence_translation
      }));
      setVocabulary(prev => [...stateVocabs, ...prev]);
      showToast(`${newVocabs.length}개의 단어가 추가되었습니다.`);
    }
  };

  const handleRemoveVocab = async (id) => {
    await supabase.from('biblical_vocab').delete().eq('id', id);
    setVocabulary(prev => prev.filter(w => w.id !== id));
    showToast('단어장에서 삭제되었습니다.');
  };

  const handleAddReview = async (wordObj, mode) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    if (reviewList.some(item => item.wordObj.word === wordObj.word && item.failedMode === mode)) return;

    const reviewRecord = {
      id: `rev_${Date.now()}`,
      user_id: user.id,
      word_data: wordObj,
      failed_mode: mode
    };

    await supabase.from('biblical_reviews').insert(reviewRecord);
    setReviewList(prev => [...prev, { id: reviewRecord.id, wordObj, failedMode: mode }]);
  };

  const handleRemoveReview = async (id) => {
    await supabase.from('biblical_reviews').delete().eq('id', id);
    setReviewList(prev => prev.filter(r => r.id !== id));
    showToast('오답 노트에서 삭제되었습니다.');
  };

  const startDrill = (wordsToDrill, mode) => {
    if (wordsToDrill.length === 0) return;
    setDrillQueue([...wordsToDrill]);
    setCurrentDrillMode(mode);
    setBiblicalTab('drill');
  };

  const handleDeleteSentence = async (id) => {
    if (!window.confirm("이 문장을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from('biblical_sentences').delete().eq('id', id);
    if (!error) {
      setSentences(prev => prev.filter(s => s.id !== id));
      showToast('문장이 삭제되었습니다.');
    }
  };

  const filteredSentences = sentences.filter(s => globalLang === 'all' || s.language === globalLang);
  const filteredVocab = vocabulary.filter(v => globalLang === 'all' || v.language === globalLang);
  const filteredReview = reviewList.filter(r => globalLang === 'all' || r.wordObj.language === globalLang);

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
          <button 
            onClick={() => onNavigate && onNavigate('learning_general')}
            className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
          >
            일반 과목 학습
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all bg-white shadow text-indigo-700 pointer-events-none">
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

      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         
         <div className="flex overflow-x-auto no-scrollbar w-full md:w-auto gap-2 pb-1">
            <button onClick={() => setBiblicalTab('upload')} className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-black rounded-xl transition-all ${biblicalTab === 'upload' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              자료 등록
            </button>
            <button onClick={() => setBiblicalTab('sentences')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${biblicalTab === 'sentences' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              문장 학습 {filteredSentences.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredSentences.length}</span>}
            </button>
            <button onClick={() => setBiblicalTab('vocab')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${biblicalTab === 'vocab' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              단어장 {filteredVocab.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredVocab.length}</span>}
            </button>
            <button onClick={() => setBiblicalTab('review')} className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${biblicalTab === 'review' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              오답 노트 {filteredReview.length > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredReview.length}</span>}
            </button>
            {biblicalTab === 'drill' && (
              <button className="shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-black rounded-xl transition-all bg-indigo-600 text-white shadow-sm flex items-center justify-center gap-1.5"><Play size={14}/> 훈련 진행</button>
            )}
         </div>
         
         <div className="flex overflow-x-auto no-scrollbar w-full md:w-auto gap-2 pb-1 shrink-0">
            <div className="flex shrink-0 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button onClick={() => setGlobalLang('all')} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${globalLang === 'all' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>전체</button>
              <button onClick={() => setGlobalLang('greek')} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${globalLang === 'greek' ? 'bg-blue-500 shadow text-white' : 'text-slate-500'}`}>헬라어</button>
              <button onClick={() => setGlobalLang('hebrew')} className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${globalLang === 'hebrew' ? 'bg-amber-500 shadow text-white' : 'text-slate-500'}`}>히브리어</button>
            </div>
            <button 
              onClick={() => setShowPhonetics(!showPhonetics)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${showPhonetics ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
            >
              {showPhonetics ? <Volume2 size={15}/> : <EyeOff size={15}/>} 음가
            </button>
         </div>
      </div>

      {biblicalTab === 'upload' && <BiblicalUploadTab onUpload={handleBiblicalUpload} />}
      
      {biblicalTab === 'sentences' && (
        isAnalyzing ? (
          <div className="bg-white p-10 md:p-20 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <RefreshCw className="animate-spin text-indigo-500 mb-5" size={48} />
            <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-2">AI가 원어 텍스트를 파싱하고 있습니다</h3>
            <p className="text-xs md:text-sm text-slate-500 mb-6 text-center leading-relaxed">
              입력하신 텍스트를 문장 단위로 분리하고 각 단어의 원형, 품사, 문법 속성을<br className="hidden md:block"/>완벽하게 분석 중입니다. (약 10~20초 소요)
            </p>
            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 w-1/2 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] origin-left"></div>
            </div>
          </div>
        ) : (
          <SentencesTab sentences={filteredSentences} showPhonetics={showPhonetics} onAddVocab={handleAddVocab} globalLang={globalLang} onDelete={handleDeleteSentence} />
        )
      )}
      
      {biblicalTab === 'vocab' && <VocabTab vocabulary={filteredVocab} showPhonetics={showPhonetics} onStartDrill={startDrill} onRemoveVocab={handleRemoveVocab} />}
      {biblicalTab === 'review' && <ReviewTab reviewList={filteredReview} onRemoveReview={handleRemoveReview} showPhonetics={showPhonetics} onStartDrill={startDrill} />}
      {biblicalTab === 'drill' && <DrillTab queue={drillQueue} mode={currentDrillMode} showPhonetics={showPhonetics} onComplete={() => setBiblicalTab('vocab')} onFail={handleAddReview} />}
    </div>
  );
}

function BiblicalUploadTab({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [textContent, setTextContent] = useState('');

  const handleTextSubmit = () => {
    if(!textContent) return;
    setIsParsing(true);
    setTimeout(() => { 
      setIsParsing(false); 
      onUpload({ type: 'text', content: textContent, isExamMode: false }); 
    }, 100);
  };

  const processFile = (file) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setIsParsing(false);
      onUpload({ type: 'file', fileContent: event.target.result, isExamMode: true });
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
    <div className="space-y-3 animate-in fade-in duration-300 pb-6">
      <div className="bg-slate-800 p-4 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Brain size={15} className="text-indigo-400" /> 성서 원어 AI 파서</h2>
          <p className="text-slate-300 text-xs leading-relaxed max-w-lg">그리스어(헬라어) 및 히브리어 텍스트를 입력하거나 파일을 첨부하면, AI가 단어 단위로 문법을 자동 분해(파싱)합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col space-y-2">
          <div className="flex items-center gap-1.5"><BookOpen className="text-indigo-500" size={13}/><h3 className="text-xs font-bold text-slate-800">텍스트 직접 입력</h3></div>
          <div className="flex-1 flex flex-col pt-1">
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-xl resize-none text-sm font-serif mb-2 flex-1 focus:border-indigo-500 outline-none leading-loose" 
              placeholder="원어 텍스트 입력... (예: Ἐν ἀρχῇ ἦν ὁ λόγος)"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
            <button onClick={handleTextSubmit} disabled={isParsing || !textContent} className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
              {isParsing ? '준비 중...' : '단일 문장 분석 시작'}
            </button>
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-3xl shadow-sm border-2 border-indigo-200 flex flex-col relative">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl shadow-sm z-10">AI PRO</div>
          <div className="mb-2 relative z-10">
            <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-0.5"><Zap className="text-amber-500 fill-amber-500" size={13}/> 시험 대비 대량 파일 스캔</h3>
            <p className="text-[11px] text-indigo-700">기출문제나 교재(.txt)를 드래그하여 다수의 문장을 한 번에 파싱합니다.</p>
          </div>
          
          <input type="file" id="biblical-file" className="hidden" accept=".txt,.md,.csv" onChange={handleFileInputChange} />
          
          <label 
             htmlFor="biblical-file"
             onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
             onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
             onDrop={handleFileDrop}
             className={`border-2 border-dashed rounded-3xl flex-1 flex flex-col items-center justify-center p-5 text-center transition-all cursor-pointer relative z-10 ${isDragging ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-300 bg-white/60 hover:bg-white'}`}
          >
            {isParsing ? (
               <div className="flex flex-col items-center"><RefreshCw className="animate-spin text-indigo-600 mb-1.5" size={26} /><p className="text-indigo-900 font-bold text-xs">문서를 읽는 중...</p></div>
             ) : (
               <div>
                 <FileText className="text-indigo-400 mx-auto mb-2" size={32} />
                 <p className="font-bold text-indigo-900 text-xs mb-1.5">원어 텍스트 문서 드래그</p>
                 <span className="text-[11px] text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-full border border-indigo-200 inline-block font-bold">클릭하여 파일 찾기 (.txt)</span>
               </div>
             )}
          </label>
        </div>
      </div>
    </div>
  );
}

function SentencesTab({ sentences, showPhonetics, onAddVocab, globalLang, onDelete }) {
  const [selectedWordIds, setSelectedWordIds] = useState(new Set());
  const [activePopupWord, setActivePopupWord] = useState(null); 

  useEffect(() => { 
    setSelectedWordIds(new Set());
    setActivePopupWord(null);
  }, [globalLang]);

  if (sentences.length === 0) {
    return (
      <div className="text-center py-8 animate-in fade-in">
        <Globe size={24} className="mx-auto mb-1.5 text-slate-300" />
        <p className="text-slate-500 font-bold text-xs">등록된 문장이 없습니다. 자료 등록 탭에서 추가해주세요.</p>
      </div>
    );
  }

  const toggleSelect = (id) => {
    const newSet = new Set(selectedWordIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedWordIds(newSet);
  };

  const handleAddSelected = () => {
    const allWords = sentences.flatMap(s => s.words.map(w => ({ ...w, language: s.language, sentenceContext: s.original, sentenceTranslation: s.translation })));
    const wordsToAdd = allWords.filter(w => selectedWordIds.has(w.id));
    onAddVocab(wordsToAdd);
    setSelectedWordIds(new Set()); 
  };

  return (
    <div className="relative pb-36 animate-in fade-in duration-300 space-y-4">
      {sentences.map((sentence, idx) => {
        const isRTL = sentence.language === 'hebrew';

        return (
          <div key={sentence.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative overflow-visible group">
            {sentence.is_exam_mode && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-tr-2xl rounded-bl-xl shadow-sm z-10">시험 핵심</div>}
            
            <button onClick={() => onDelete(sentence.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">문장 {idx + 1}</span>
              <LanguageBadge language={sentence.language} />
            </div>

            <div className={`flex flex-wrap gap-x-3 gap-y-2 mb-3 relative ${isRTL ? 'rtl' : 'ltr'}`}>
              {sentence.words.map((item, wordIdx) => {
                const isSelected = selectedWordIds.has(item.id);
                const isPopupOpen = activePopupWord?.sentenceId === sentence.id && activePopupWord?.wordId === item.id;
                let alignClass = 'left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0';
                if (wordIdx === 0) alignClass = 'left-0 md:left-0';

                return (
                  <div key={item.id} className="relative inline-block">
                    <span 
                      onClick={() => setActivePopupWord(isPopupOpen ? null : { sentenceId: sentence.id, wordId: item.id })} 
                      className={`cursor-pointer inline-block text-xl md:text-2xl font-serif px-2 py-0.5 rounded transition-all ${isPopupOpen ? 'bg-indigo-100 text-indigo-900 shadow-inner' : 'hover:bg-slate-100 text-slate-900'} ${isSelected && !isPopupOpen ? 'border-b-2 border-indigo-500' : ''}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {item.word}
                    </span>

                    {isPopupOpen && (
                      <div className={`absolute top-full mt-2 z-50 w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 animate-in slide-in-from-top-1 fade-in duration-200 ${alignClass}`} dir="ltr">
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
                          <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            {isSelected ? <CheckSquare size={13} className="text-indigo-500" /> : <Square size={13} className="text-slate-400" />}
                            <span>단어장 담기</span>
                          </button>
                          <button onClick={() => setActivePopupWord(null)} className="text-slate-400 hover:text-rose-500 p-1 rounded-full"><X size={13} /></button>
                        </div>

                        {showPhonetics && item.pronunciation && <div className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-center w-fit mb-2 border border-indigo-100">[{item.pronunciation}]</div>}
                        
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-bold">원형</span>
                            <span className="font-serif font-bold text-slate-900 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>{item.lemma}</span>
                          </div>
                          <div className="flex justify-between items-center px-1">
                            <span className="text-slate-400 font-bold">품사</span>
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{item.pos}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 px-1">
                            {['tension', 'tense', 'voice', 'mood', 'person', 'number', 'gender', 'case'].map(key => item[key] && <span key={key} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{item[key]}</span>)}
                          </div>
                          <div className="flex justify-between items-center pt-1.5 mt-1.5 px-1 border-t border-slate-100">
                            <span className="text-slate-400 font-bold">의미</span>
                            <span className="font-bold text-emerald-700 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{item.meaning}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 w-fit leading-relaxed">
              "{sentence.translation}"
            </div>
          </div>
        );
      })}

      {selectedWordIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-4 w-[90%] max-w-sm border border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">{selectedWordIds.size}</div>
            <span className="font-bold text-xs">단어 선택됨</span>
          </div>
          <button onClick={handleAddSelected} className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs shadow-sm">
            <Plus size={14} /> 단어장 추가
          </button>
        </div>
      )}
    </div>
  );
}

function VocabTab({ vocabulary, showPhonetics, onStartDrill, onRemoveVocab }) {
  const [drillMode, setDrillMode] = useState('lemma'); 
  
  if (vocabulary.length === 0) {
    return (
      <div className="text-center py-8 animate-in fade-in">
        <BookMarked size={24} className="mx-auto mb-1.5 text-slate-300" />
        <p className="text-slate-500 font-bold text-xs">단어장이 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-1.5 mb-2 text-slate-800 font-bold text-xs border-b border-slate-100 pb-1.5"><Settings size={13} className="text-indigo-500"/> 훈련 설정</div>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-end">
          <div className="w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase">훈련 모드</span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-1">
               {[{ id: 'lemma', label: '원형' }, { id: 'parsing', label: '파싱' }, { id: 'meaning', label: '의미' }].map(mode => (
                 <button key={mode.id} onClick={() => setDrillMode(mode.id)} className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${drillMode === mode.id ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>{mode.label}</button>
               ))}
            </div>
          </div>
          <button onClick={() => onStartDrill(vocabulary, drillMode)} className="w-full sm:w-auto px-4.5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-sm flex justify-center items-center gap-1.5 hover:bg-indigo-700 text-xs">
            <Play size={13} fill="currentColor" /> {vocabulary.length}개 훈련 시작
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {vocabulary.map(item => <WordCard key={item.id} item={item} showPhonetics={showPhonetics} onRemove={() => onRemoveVocab(item.id)} />)}
      </div>
    </div>
  );
}

function ReviewTab({ reviewList, onRemoveReview, showPhonetics, onStartDrill }) {
  if (reviewList.length === 0) {
    return (
      <div className="text-center py-8 animate-in fade-in">
        <CheckCircle size={24} className="mx-auto mb-1.5 text-emerald-300" />
        <p className="text-slate-500 font-bold text-xs">오답이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="bg-rose-50 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2 border border-rose-100">
        <div>
          <h2 className="text-xs font-bold text-rose-900 mb-0.5 flex items-center gap-1.5"><Brain className="text-rose-600" size={13}/> 스마트 오답 노트</h2>
          <p className="text-rose-700 text-xs">틀린 문항을 다시 훈련하여 장기 기억화하세요.</p>
        </div>
        <button onClick={() => onStartDrill(reviewList.map(r => r.wordObj), 'lemma')} className="w-full sm:w-auto px-4.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors">
          오답 재훈련
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {reviewList.map(record => (
          <div key={record.id} className="relative">
            <div className="absolute -top-2.5 left-3.5 z-10 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              {record.failedMode === 'lemma' ? '원형 틀림' : record.failedMode === 'parsing' ? '파싱 틀림' : '의미 틀림'}
            </div>
            <WordCard item={record.wordObj} showPhonetics={showPhonetics} onRemove={() => onRemoveReview(record.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguageBadge({ language }) {
  const isHebrew = language === 'hebrew';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase w-fit ${isHebrew ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{isHebrew ? '히브리어' : '헬라어'}</span>;
}

function WordCard({ item, showPhonetics, onRemove }) {
  const isRTL = item.language === 'hebrew';
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col relative h-full">
      <button onClick={onRemove} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-rose-500 bg-slate-50 p-1.5 rounded-full transition-colors"><Trash2 size={13} /></button>
      <LanguageBadge language={item.language} />
      
      <div className="text-xl font-serif text-indigo-900 mb-1 mt-1.5 text-center" dir={isRTL ? 'rtl' : 'ltr'}>{item.word}</div>
      {showPhonetics && item.pronunciation && <div className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2.5 py-0.5 rounded-lg text-center w-fit mx-auto mb-1.5">[{item.pronunciation}]</div>}
      
      <div className="space-y-1.5 text-xs mt-auto border-t border-slate-100 pt-2 mb-2" dir="ltr">
        <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
          <span className="text-slate-500 font-bold">원형</span>
          <span className="font-serif font-bold text-slate-900 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>{item.lemma}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-slate-400 font-bold">품사</span>
          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{item.pos}</span>
        </div>
        <div className="flex justify-between items-center pt-1.5 px-1 border-t border-slate-50">
          <span className="text-slate-400 font-bold">의미</span>
          <span className="font-bold text-emerald-700 text-xs">{item.meaning}</span>
        </div>
      </div>

      {item.sentenceContext && (
        <div className="mt-auto pt-1.5 border-t border-slate-100 flex flex-col">
          <div className="text-xs font-serif text-slate-500 bg-slate-50 p-1.5 rounded-t-xl truncate" dir={isRTL ? 'rtl' : 'ltr'}>{item.sentenceContext}</div>
          {item.sentenceTranslation && (
            <div className="text-xs font-medium text-slate-600 bg-slate-100 p-1.5 rounded-b-xl border-t border-slate-200/50 truncate" dir="ltr">"{item.sentenceTranslation}"</div>
          )}
        </div>
      )}
    </div>
  );
}

function DrillTab({ queue, mode, showPhonetics, onComplete, onFail }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('recall'); 
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);

  const currentItem = queue[currentIndex];
  if (!currentItem) return null;

  const isRTL = currentItem.language === 'hebrew';
  let recallPrompt = '', correctAnswer = '';
  
  if (mode === 'parsing') {
    recallPrompt = '정확한 문법(파싱)을 떠올려보세요.';
    correctAnswer = getParsingString(currentItem) || currentItem.pos;
  } else if (mode === 'meaning') {
    recallPrompt = '정확한 한글 의미를 떠올려보세요.';
    correctAnswer = currentItem.meaning;
  } else {
    recallPrompt = '단어의 원형(Lemma)을 떠올려보세요.';
    correctAnswer = currentItem.lemma;
  }

  const handleShowOptions = () => {
    let baseOptions = [correctAnswer, '오답1', '오답2', '오답3'];
    setShuffledOptions([...baseOptions].sort(() => Math.random() - 0.5));
    setPhase('options');
  };

  const handleSelectOption = (opt) => {
    if (phase === 'feedback') return;
    setSelectedOption(opt);
    if (opt !== correctAnswer) onFail(currentItem, mode);
    setPhase('feedback');
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) { 
      setCurrentIndex(currentIndex + 1); 
      setPhase('recall'); 
      setSelectedOption(null); 
    } else {
      onComplete();
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-300">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden pb-4">
        <div className="h-1.5 bg-slate-100 w-full"><div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(currentIndex / queue.length) * 100}%` }}></div></div>
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-600 flex items-center gap-1.5"><Brain size={13} className="text-indigo-500" /> 인출 훈련</span>
          <span className="font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-[11px]">{currentIndex + 1} / {queue.length}</span>
        </div>

        <div className="p-4 text-center flex flex-col justify-center">
          {phase === 'recall' && <div className="mb-3 inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3.5 py-1.5 rounded-full font-bold shadow-sm text-xs"><Lightbulb size={13} /> {recallPrompt}</div>}
          
          <div className="mb-4 w-full">
            <div className="text-3xl font-serif text-slate-900 mb-1.5" dir={isRTL ? 'rtl' : 'ltr'}>{currentItem.word}</div>
            {showPhonetics && currentItem.pronunciation && <div className="text-xs font-bold text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-lg mb-3">[{currentItem.pronunciation}]</div>}
            
            <div className="mt-2 text-xs font-serif text-slate-500 bg-slate-50 p-2 rounded-t-xl" dir={isRTL ? 'rtl' : 'ltr'}>{currentItem.sentenceContext}</div>
            {currentItem.sentenceTranslation && <div className="text-xs font-medium text-slate-600 bg-slate-100 p-2 rounded-b-xl border-t border-slate-200" dir="ltr">"{currentItem.sentenceTranslation}"</div>}
          </div>

          <div className="w-full">
            {phase === 'recall' && <button onClick={handleShowOptions} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs shadow-sm flex justify-center items-center gap-1.5"><CheckSquare size={14} /> 보기 확인</button>}
            
            {(phase === 'options' || phase === 'feedback') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {shuffledOptions.map((opt, i) => {
                  let btnStyle = "bg-white border border-slate-200 hover:bg-indigo-50";
                  if (phase === 'feedback') {
                    if (opt === correctAnswer) btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-extrabold";
                    else if (opt === selectedOption) btnStyle = "bg-rose-50 border-rose-400 text-rose-800";
                    else btnStyle = "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
                  }
                  return <button key={i} onClick={() => handleSelectOption(opt)} disabled={phase === 'feedback'} className={`px-4 py-2 rounded-xl transition-all text-xs font-medium ${btnStyle}`}>{opt}</button>;
                })}
              </div>
            )}

            {phase === 'feedback' && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 animate-in slide-in-from-bottom-2">
                <div className="flex flex-col items-center gap-1.5 mb-2">
                  {selectedOption === correctAnswer ? <><CheckCircle size={20} className="text-emerald-500" /><span className="font-bold text-emerald-700 text-xs">정답!</span></> : <><XCircle size={20} className="text-rose-500" /><span className="font-bold text-rose-700 text-xs">오답 노트 저장됨</span></>}
                </div>
                <button onClick={handleNext} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-xs">{currentIndex < queue.length - 1 ? '다음 문제' : '훈련 종료'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}