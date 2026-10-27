import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { callGeminiAPI } from '../../utils/geminiAPI'; 
import { initialSentences, getParsingString } from '../../utils/learningData';
import { 
  UploadCloud, Search, BookMarked, Repeat, Play, Volume2, 
  EyeOff, Brain, Trash2, CheckCircle, XCircle, BookOpen, 
  Zap, RefreshCw, Globe, CheckSquare, Square, X, Plus, 
  Settings, Lightbulb, FileText, ArrowLeft, AlignLeft, AlertCircle, Loader2, Edit3, Save, ChevronUp
} from 'lucide-react';

// 🚀 [궁극의 AI 복구 파서] 잘린 JSON 꼬리, 쓰레기 문자, 쉼표 누락을 모두 잡아냅니다.
const parseAIResponse = (text) => {
  let cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ');

  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  let startIdx = -1;
  if (firstBracket !== -1 && firstBrace !== -1) startIdx = Math.min(firstBracket, firstBrace);
  else if (firstBracket !== -1) startIdx = firstBracket;
  else if (firstBrace !== -1) startIdx = firstBrace;

  if (startIdx !== -1) cleaned = cleaned.substring(startIdx);

  if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
     const lastBrace = cleaned.lastIndexOf('}');
     if (lastBrace !== -1) cleaned = cleaned.substring(0, lastBrace + 1) + ']';
  } else if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
     const lastBracket = cleaned.lastIndexOf(']');
     const lastBrace = cleaned.lastIndexOf('}');
     const lastValid = Math.max(lastBracket, lastBrace);
     if (lastValid !== -1) cleaned = cleaned.substring(0, lastValid + 1) + '}';
  }

  cleaned = cleaned.replace(/"\s+(?="[a-zA-Z0-9_]+":)/g, '", ');
  cleaned = cleaned.replace(/}\s*(?={)/g, '}, ');
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    let endChar = cleaned.startsWith('[') ? ']' : '}';
    let end = cleaned.lastIndexOf(endChar);
    while (end !== -1) {
      try {
        return JSON.parse(cleaned.substring(0, end + 1));
      } catch(e2) {
        end = cleaned.lastIndexOf(endChar, end - 1);
      }
    }
    console.error("AI 응답 JSON 파싱 실패 원본 텍스트:", text);
    throw new Error("AI 응답 포맷이 올바르지 않습니다.");
  }
};

const cleanGrammarText = (text) => {
  if (!text) return '';
  return text.replace(/[a-zA-Z\(\)]/g, '').trim(); 
};

export default function BiblicalStudy({ onBack, onNavigate }) {
  const [biblicalTab, setBiblicalTab] = useState('upload'); 
  const [showPhonetics, setShowPhonetics] = useState(true);
  const [globalLang, setGlobalLang] = useState('all');
  const [toastMsg, setToastMsg] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reparsingId, setReparsingId] = useState(null); 

  const [sentences, setSentences] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [reviewList, setReviewList] = useState([]);
  
  const [drillQueue, setDrillQueue] = useState([]);
  const [currentDrillMode, setCurrentDrillMode] = useState('lemma');

  // 🚀 플로팅 상단 이동 버튼 상태 추가
  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    fetchBiblicalData();

    // 🚀 스크롤 이벤트 감지
    const handleScroll = () => {
      const currentScrollY = document.documentElement.scrollTop || document.body.scrollTop || document.querySelector('main')?.scrollTop || 0;
      if (currentScrollY > 300) {
        setShowTopBtn(true);
      } else {
        setShowTopBtn(false);
      }
    };

    const mainContainer = document.querySelector('main');
    if(mainContainer) mainContainer.addEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);

    return () => {
      if(mainContainer) mainContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const mainContainer = document.querySelector('main');
    if(mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const fetchBiblicalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [sentencesRes, vocabRes, reviewsRes] = await Promise.all([
      // 🚀 역순 정렬 확실히 보장 (가장 최근 등록된 단어가 맨 앞으로)
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
다음 입력된 자료에서 '성서 원어(헬라어/히브리어)' 문장만을 추출하여 파싱 데이터를 생성해.
[최고 수준 경고 - JSON 문법 절대 엄수]
응답은 반드시 처음 시작을 '['로, 끝을 ']'로 닫는 완벽한 JSON 배열 포맷이어야 해.

[입력 자료]
${payload.type === 'text' ? payload.content : payload.fileContent}

[요구사항]
1. 텍스트에 섞여 있는 한글 지시문(예: 연습문제, 파싱하라), 숫자(예: 1), 2., 3), 기호 등은 전부 무시하고 완벽하게 삭제해.
2. 오직 '헬라어' 또는 '히브리어'로 이루어진 원어 문장만 순수하게 추출하여 문장 단위로 객체 배열을 만들어.
3. 데이터가 방대하여 출력이 끊기는 것을 막기 위해, 아무리 문장이 많아도 **최대 10개의 문장까지만 추출하여 완벽하게 JSON을 닫고 종료해.**
4. 'language'는 'greek' 또는 'hebrew'로 지정.
5. 'original'은 원어 문장(숫자/한글 제거됨), 'translation'은 자연스러운 한글 번역.
6. 'words' 배열에는 문장 안의 단어들을 순서대로 파싱하여 담을 것.
7. [매우 중요 - 세부 파싱 한글 출력] 
   문법 속성의 값(Value)에는 영어나 괄호(예: Present, Active)를 절대로 넣지 마! 오직 '순수 한글'(예: 현재, 능동태, 3인칭, 복수, 남성)로만 작성해.

[출력 예시]
[
  {
    "language": "greek",
    "original": "Ἐν ἀρχῇ ἦν ὁ λόγος",
    "translation": "태초에 말씀이 계셨다",
    "words": [
      { "id": "w1", "word": "Ἐν", "lemma": "ἐν", "pos": "전치사", "meaning": "~안에", "pronunciation": "엔" },
      { "id": "w2", "word": "ἀρχῇ", "lemma": "ἀρχή", "pos": "명사", "meaning": "태초, 시작", "pronunciation": "아르케", "gender": "여성", "number": "단수", "case": "여격" }
    ]
  }
]
`;
      const responseText = await callGeminiAPI(prompt, "성서 원어 형태소 대량 파싱"); 
      let parsedAI = parseAIResponse(responseText);

      let sentencesArray = [];
      if (Array.isArray(parsedAI)) {
        if (parsedAI.length === 1 && parsedAI[0].sentences) {
          sentencesArray = parsedAI[0].sentences;
        } else {
          sentencesArray = parsedAI;
        }
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
      showToast(`AI 파싱 완료! 성공적으로 ${newSentences.length}개의 원어 문장을 분석했습니다.`);
    } catch (error) {
      console.error("AI 처리/저장 에러:", error);
      showToast(`분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReparseSentence = async (sentence, newOriginalText = null) => {
    setReparsingId(sentence.id);
    const targetText = newOriginalText || sentence.original;
    
    try {
      if (newOriginalText && newOriginalText !== sentence.original) {
        // 문장을 직접 수정했을 경우 DB에 원문 텍스트 선반영
        const { error: updateErr } = await supabase
          .from('biblical_sentences')
          .update({ original: targetText })
          .eq('id', sentence.id);
        if (updateErr) throw updateErr;
      }

      const prompt = `
다음 성서 원어 단일 문장을 분석하여 단어별 파싱 데이터만 JSON 배열로 반환해.
[최고 수준 경고] 
1. 배열 '[ ]' 안에 객체를 담아야 하며, 문자열은 모두 쌍따옴표로 묶어라.
2. 문법 속성의 값(Value)에는 영어나 괄호(예: Present, Active)를 절대 포함하지 말고 오직 '한글'로만 작성할 것. (예: 3인칭, 단수, 남성, 현재, 직설법)

[원본 문장]
${targetText}

[요구사항]
1. 문장 내의 모든 단어를 순서대로 객체화하여 배열에 담을 것.
2. 필수 속성: "id", "word", "lemma", "pos", "meaning", "pronunciation"
3. 세부 속성 (해당될 경우 한글로만): "tense", "voice", "mood", "person", "number", "gender", "case"

[출력 예시]
[
  { "id": "w1", "word": "단어", "lemma": "원형", "pos": "품사", "meaning": "의미", "pronunciation": "발음", "person": "3인칭", "number": "단수" }
]
`;
      const responseText = await callGeminiAPI(prompt, "단일 문장 강제 파싱");
      let parsedWords = parseAIResponse(responseText);
      
      if (Array.isArray(parsedWords) && parsedWords.length === 1 && parsedWords[0].words) {
        parsedWords = parsedWords[0].words;
      } else if (!Array.isArray(parsedWords)) {
        if (parsedWords.words && Array.isArray(parsedWords.words)) {
          parsedWords = parsedWords.words;
        } else {
          parsedWords = [parsedWords];
        }
      }

      const newWords = parsedWords.map((w, idx) => ({
        ...w,
        id: `w_${Date.now()}_re_${idx}`
      }));

      const { error } = await supabase
        .from('biblical_sentences')
        .update({ original: targetText, words: newWords }) 
        .eq('id', sentence.id);

      if (error) throw error;

      setSentences(prev => prev.map(s => s.id === sentence.id ? { ...s, original: targetText, words: newWords } : s));
      showToast('문장 파싱이 완료되었습니다.');
    } catch (error) {
      console.error("재분석 에러:", error);
      showToast('재분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setReparsingId(null);
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
      sentence_translation: w.sentenceTranslation,
      // 🚀 세부 속성도 누락 없이 DB에 저장
      tense: w.tense,
      voice: w.voice,
      mood: w.mood,
      person: w.person,
      number: w.number,
      gender: w.gender,
      case: w.case
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
      // 🚀 새 단어를 배열의 '맨 앞'에 추가하여 최신순 정렬 유지
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
    setReviewList(prev => [{ id: reviewRecord.id, wordObj, failedMode: mode }, ...prev]); // 오답노트도 최신순
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

  const handleBulkDeleteSentences = async (ids) => {
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}개의 문장을 정말 삭제하시겠습니까?`)) return;
    
    const { error } = await supabase.from('biblical_sentences').delete().in('id', ids);
    if (!error) {
      setSentences(prev => prev.filter(s => !ids.includes(s.id)));
      showToast(`${ids.length}개의 문장이 삭제되었습니다.`);
    } else {
      showToast('삭제 중 오류가 발생했습니다.');
    }
  };

  const filteredSentences = sentences.filter(s => globalLang === 'all' || s.language === globalLang);
  const filteredVocab = vocabulary.filter(v => globalLang === 'all' || v.language === globalLang);
  const filteredReview = reviewList.filter(r => globalLang === 'all' || r.wordObj.language === globalLang);

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-right-4 duration-300 relative pb-32">
      
      <div className="flex items-center justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-4 gap-2">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center justify-center p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
            title="대시보드로 돌아가기"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex flex-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => onNavigate && onNavigate('learning_general')}
            className="flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-slate-500 hover:bg-slate-200/50"
          >
            일반 과목
          </button>
          <button className="flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all bg-white shadow text-indigo-700 pointer-events-none">
            성서 원어
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[999] bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in text-xs whitespace-nowrap">
          <CheckCircle size={14} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      <div className="flex overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-5 gap-1">
        <button onClick={() => setBiblicalTab('upload')} className={`shrink-0 flex-1 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'upload' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
          자료 등록
        </button>
        <button onClick={() => setBiblicalTab('sentences')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'sentences' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
          문장 학습 {filteredSentences.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredSentences.length}</span>}
        </button>
        <button onClick={() => setBiblicalTab('vocab')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'vocab' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
          단어장 {filteredVocab.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredVocab.length}</span>}
        </button>
        <button onClick={() => setBiblicalTab('review')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'review' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
          오답 노트 {filteredReview.length > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredReview.length}</span>}
        </button>
      </div>
      
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setGlobalLang('all')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'all' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>전체</button>
            <button onClick={() => setGlobalLang('greek')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'greek' ? 'bg-blue-500 shadow text-white' : 'text-slate-500'}`}>헬라어</button>
            <button onClick={() => setGlobalLang('hebrew')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'hebrew' ? 'bg-amber-500 shadow text-white' : 'text-slate-500'}`}>히브리어</button>
          </div>
          <button 
            onClick={() => setShowPhonetics(!showPhonetics)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors border ${showPhonetics ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            {showPhonetics ? <Volume2 size={14}/> : <EyeOff size={14}/>} 음가
          </button>
        </div>
      </div>

      {biblicalTab === 'upload' && <BiblicalUploadTab onUpload={handleBiblicalUpload} />}
      
      {biblicalTab === 'sentences' && (
        isAnalyzing ? (
          <div className="bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center animate-in fade-in duration-300 mt-2">
            <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
            <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-2">AI가 원어 텍스트를 파싱하고 있습니다</h3>
            <p className="text-xs md:text-sm text-slate-500 text-center leading-relaxed">
              불필요한 텍스트를 걸러내고 순수 원어 문장만 분석 중입니다.<br/>
              (텍스트가 방대할 경우 상위 10문장씩 안전하게 처리됩니다.)
            </p>
          </div>
        ) : (
          <SentencesTab 
            sentences={filteredSentences} 
            showPhonetics={showPhonetics} 
            onAddVocab={handleAddVocab} 
            globalLang={globalLang} 
            onDelete={handleDeleteSentence}
            onBulkDelete={handleBulkDeleteSentences} 
            onReparse={handleReparseSentence}     
            reparsingId={reparsingId}             
          />
        )
      )}
      
      {biblicalTab === 'vocab' && <VocabTab vocabulary={filteredVocab} showPhonetics={showPhonetics} onStartDrill={startDrill} onRemoveVocab={handleRemoveVocab} />}
      {biblicalTab === 'review' && <ReviewTab reviewList={filteredReview} onRemoveReview={handleRemoveReview} showPhonetics={showPhonetics} onStartDrill={startDrill} />}
      {biblicalTab === 'drill' && <DrillTab queue={drillQueue} mode={currentDrillMode} showPhonetics={showPhonetics} onComplete={() => setBiblicalTab('vocab')} onFail={handleAddReview} />}

      {/* 🚀 플로팅 위로 가기 버튼 */}
      {showTopBtn && (
        <button 
          onClick={scrollToTop}
          className="fixed bottom-24 right-5 bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-full shadow-xl transition-all z-50 animate-in fade-in slide-in-from-bottom-5 hover:-translate-y-1"
          aria-label="위로 가기"
        >
          <ChevronUp size={24} strokeWidth={3} />
        </button>
      )}
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
    if (file) {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        alert("PDF 파일은 직접 읽을 수 없습니다.\n\n해결방법: PDF 파일을 열어서 텍스트를 드래그 복사한 뒤, 왼쪽의 '텍스트 직접 입력' 창에 붙여넣기 해주세요!");
        return;
      }
      processFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        alert("PDF 파일은 직접 첨부할 수 없습니다.\n\n해결방법: PDF 파일을 열어서 텍스트를 복사한 뒤, 왼쪽의 '텍스트 직접 입력' 창에 붙여넣기 해주세요!");
        e.target.value = ''; 
        return;
      }
      processFile(file);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="bg-slate-800 p-4 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Brain size={15} className="text-indigo-400" /> 성서 원어 AI 파서</h2>
          <p className="text-slate-300 text-[11px] leading-relaxed max-w-lg">그리스어(헬라어) 및 히브리어 텍스트를 입력하면 단어 단위로 문법을 자동 파싱합니다. <span className="text-indigo-300 font-bold">대량의 문장이나 복사해온 문제지 내용도 알아서 원어만 필터링합니다.</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col space-y-2">
          <div className="flex items-center gap-1.5"><BookOpen className="text-indigo-500" size={13}/><h3 className="text-xs font-bold text-slate-800">텍스트 직접 입력</h3></div>
          <div className="flex-1 flex flex-col pt-1">
            <textarea 
              className="w-full p-3 border border-slate-200 rounded-xl resize-none text-[13px] font-serif mb-2 flex-1 focus:border-indigo-500 outline-none leading-loose" 
              placeholder="여기에 원어 텍스트나 PDF 내용을 복사해서 붙여넣으세요. (한글, 숫자, 문제 번호가 섞여 있어도 AI가 알아서 제거합니다)"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
            <button onClick={handleTextSubmit} disabled={isParsing || !textContent} className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
              {isParsing ? '준비 중...' : '텍스트 AI 분석 시작'}
            </button>
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-3xl shadow-sm border-2 border-indigo-200 flex flex-col relative">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl shadow-sm z-10">AI PRO</div>
          <div className="mb-2 relative z-10">
            <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-0.5"><Zap className="text-amber-500 fill-amber-500" size={13}/> 텍스트 문서(.txt) 스캔</h3>
            <p className="text-[10px] text-indigo-700">PDF 파일은 직접 첨부할 수 없습니다. 텍스트로 변환 후 올려주세요.</p>
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
                 <p className="font-bold text-indigo-900 text-xs mb-1.5">텍스트 파일(.txt) 드래그</p>
                 <span className="text-[10px] text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-full border border-indigo-200 inline-block font-bold">클릭하여 파일 찾기 (.txt)</span>
               </div>
             )}
          </label>
        </div>
      </div>
    </div>
  );
}

function SentencesTab({ sentences, showPhonetics, onAddVocab, globalLang, onDelete, onBulkDelete, onReparse, reparsingId }) {
  const [selectedWordIds, setSelectedWordIds] = useState(new Set());
  const [activePopupWord, setActivePopupWord] = useState(null); 
  
  const [selectedSentenceIds, setSelectedSentenceIds] = useState(new Set());
  const [editingSentenceId, setEditingSentenceId] = useState(null);
  const [editingSentenceText, setEditingSentenceText] = useState('');

  useEffect(() => { 
    setSelectedWordIds(new Set());
    setActivePopupWord(null);
    setSelectedSentenceIds(new Set());
    setEditingSentenceId(null);
  }, [globalLang]);

  if (sentences.length === 0) {
    return (
      <div className="text-center py-10 animate-in fade-in">
        <Globe size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-slate-500 font-bold text-sm">등록된 문장이 없습니다. 자료 등록 탭에서 추가해주세요.</p>
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

  const toggleSentenceSelect = (id) => {
    const newSet = new Set(selectedSentenceIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedSentenceIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSentenceIds.size === sentences.length) {
      setSelectedSentenceIds(new Set());
    } else {
      setSelectedSentenceIds(new Set(sentences.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors pl-1">
          <input 
            type="checkbox" 
            checked={sentences.length > 0 && selectedSentenceIds.size === sentences.length} 
            onChange={toggleSelectAll} 
            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" 
          />
          전체 선택
        </label>
        {selectedSentenceIds.size > 0 && (
          <button 
            onClick={() => {
              onBulkDelete(Array.from(selectedSentenceIds));
              setSelectedSentenceIds(new Set());
            }} 
            className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} /> 선택 삭제 ({selectedSentenceIds.size})
          </button>
        )}
      </div>

      {sentences.map((sentence, idx) => {
        const isRTL = sentence.language === 'hebrew';
        const activeWord = sentence.words?.find(w => activePopupWord?.sentenceId === sentence.id && activePopupWord?.wordId === w.id);
        const isEmptyWords = !sentence.words || sentence.words.length === 0;

        return (
          <div key={sentence.id} className={`bg-white p-4 rounded-2xl shadow-sm border relative group transition-colors ${selectedSentenceIds.has(sentence.id) ? 'border-indigo-300 bg-indigo-50/10' : 'border-slate-200'}`}>
            {sentence.is_exam_mode && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-tr-2xl rounded-bl-xl shadow-sm z-10">시험 핵심</div>}
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <input 
                  type="checkbox" 
                  checked={selectedSentenceIds.has(sentence.id)} 
                  onChange={() => toggleSentenceSelect(sentence.id)} 
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                />
                <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">문장 {idx + 1}</span>
                <LanguageBadge language={sentence.language} />
              </div>
              
              {editingSentenceId === sentence.id ? (
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => { onReparse(sentence, editingSentenceText); setEditingSentenceId(null); }} 
                    disabled={reparsingId === sentence.id || !editingSentenceText.trim()}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {reparsingId === sentence.id ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} 저장 및 분석
                  </button>
                  <button 
                    onClick={() => setEditingSentenceId(null)} 
                    className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors font-bold text-[11px] px-2.5"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setEditingSentenceId(sentence.id); setEditingSentenceText(sentence.original); }} 
                    className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                    title="문장 텍스트 직접 수정"
                  >
                    <Edit3 size={14}/>
                  </button>
                  <button 
                    onClick={() => onReparse(sentence)} 
                    disabled={reparsingId === sentence.id}
                    className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                    title="문장 재분석"
                  >
                    {reparsingId === sentence.id ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} 
                  </button>
                  <button 
                    onClick={() => onDelete(sentence.id)} 
                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              )}
            </div>

            {editingSentenceId === sentence.id ? (
              <div className="mb-3">
                <textarea 
                  value={editingSentenceText}
                  onChange={(e) => setEditingSentenceText(e.target.value)}
                  className="w-full p-3 border-2 border-indigo-200 rounded-xl text-sm font-serif outline-none focus:border-indigo-500 bg-indigo-50/30 text-slate-800"
                  rows={3}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  placeholder="분석할 원어 텍스트를 정확하게 수정해주세요."
                />
                <p className="text-[10px] text-indigo-500 font-bold mt-1 ml-1">수정한 문구로 AI가 다시 문법을 파싱합니다.</p>
              </div>
            ) : isEmptyWords ? (
              <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl flex flex-col items-center justify-center mb-3">
                <AlertCircle className="text-rose-400 mb-2" size={24} />
                <p className="text-xs text-rose-700 font-bold mb-3">단어 파싱 정보가 누락되었거나 엉뚱한 문자입니다.</p>
                <div className="text-sm font-serif text-slate-700 mb-4" dir={isRTL ? 'rtl' : 'ltr'}>{sentence.original}</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setEditingSentenceId(sentence.id); setEditingSentenceText(sentence.original); }} 
                    className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Edit3 size={14}/> 텍스트 직접 수정
                  </button>
                  <button 
                    onClick={() => onReparse(sentence)} 
                    disabled={reparsingId === sentence.id}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {reparsingId === sentence.id ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>} AI 재분석
                  </button>
                </div>
              </div>
            ) : (
              <div className={`flex flex-wrap gap-x-3 gap-y-2 mb-3 ${isRTL ? 'rtl' : 'ltr'}`}>
                {sentence.words.map((item) => {
                  const isSelected = selectedWordIds.has(item.id);
                  const isActive = activePopupWord?.sentenceId === sentence.id && activePopupWord?.wordId === item.id;

                  return (
                    <span 
                      key={item.id}
                      onClick={() => setActivePopupWord(isActive ? null : { sentenceId: sentence.id, wordId: item.id })} 
                      className={`cursor-pointer inline-block text-xl md:text-2xl font-serif px-2 py-0.5 rounded transition-all ${isActive ? 'bg-indigo-100 text-indigo-900 border-b-2 border-indigo-500 font-bold shadow-sm' : 'hover:bg-slate-100 text-slate-900'} ${isSelected && !isActive ? 'bg-emerald-50 border-b-2 border-emerald-400' : ''}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {item.word}
                    </span>
                  );
                })}
              </div>
            )}

            {!editingSentenceId && (
              <div className="text-[13px] font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 w-fit leading-relaxed">
                "{sentence.translation}"
              </div>
            )}

            {activeWord && !isEmptyWords && !editingSentenceId && (
              <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl md:text-2xl font-serif text-indigo-900 font-bold" dir={isRTL ? 'rtl' : 'ltr'}>{activeWord.word}</span>
                        {showPhonetics && activeWord.pronunciation && <span className="text-[11px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg">[{activeWord.pronunciation}]</span>}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleSelect(activeWord.id); }} 
                      className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${selectedWordIds.has(activeWord.id) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {selectedWordIds.has(activeWord.id) ? <CheckSquare size={13}/> : <Square size={13}/>} 단어장 담기
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 font-bold text-[10px]">원형</span>
                      <span className="font-serif font-bold text-slate-800 text-[13px]">{activeWord.lemma}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 font-bold text-[10px]">품사</span>
                      <span className="font-bold text-indigo-600 text-[11px] bg-indigo-50 px-2 py-0.5 rounded">{activeWord.pos}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100 col-span-2 flex items-center justify-between">
                      <span className="text-slate-400 font-bold text-[10px]">의미</span>
                      <span className="font-bold text-emerald-700">{activeWord.meaning}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                    <AlignLeft size={12} className="text-slate-400 mt-1 mr-1" />
                    {['tense', 'voice', 'mood', 'person', 'number', 'gender', 'case'].map(key => {
                      if (!activeWord[key]) return null;
                      const cleanVal = cleanGrammarText(activeWord[key]);
                      if (!cleanVal) return null; 
                      return (
                        <span key={key} className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                          {cleanVal}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
      <div className="text-center py-10 animate-in fade-in">
        <BookMarked size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-slate-500 font-bold text-sm">단어장이 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
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
          <button onClick={() => onStartDrill(vocabulary, drillMode)} className="w-full sm:w-auto px-4.5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-sm flex justify-center items-center gap-1.5 hover:bg-indigo-700 text-xs mt-2 sm:mt-0">
            <Play size={13} fill="currentColor" /> {vocabulary.length}개 훈련 시작
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vocabulary.map(item => <WordCard key={item.id} item={item} showPhonetics={showPhonetics} onRemove={() => onRemoveVocab(item.id)} />)}
      </div>
    </div>
  );
}

function ReviewTab({ reviewList, onRemoveReview, showPhonetics, onStartDrill }) {
  if (reviewList.length === 0) {
    return (
      <div className="text-center py-10 animate-in fade-in">
        <CheckCircle size={32} className="mx-auto mb-2 text-emerald-300" />
        <p className="text-slate-500 font-bold text-sm">오답이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-rose-50 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-rose-100">
        <div>
          <h2 className="text-sm font-bold text-rose-900 mb-0.5 flex items-center gap-1.5"><Brain className="text-rose-600" size={15}/> 스마트 오답 노트</h2>
          <p className="text-rose-700 text-xs">틀린 문항을 다시 훈련하여 장기 기억화하세요.</p>
        </div>
        <button onClick={() => onStartDrill(reviewList.map(r => r.wordObj), 'lemma')} className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors">
          오답 재훈련
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reviewList.map(record => (
          <div key={record.id} className="relative">
            <div className="absolute -top-2 left-4 z-10 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
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
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col relative h-full transition-colors hover:border-indigo-300">
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
        
        {/* 🚀 단어장/오답노트 하단에 상세 파싱(배지) 노출 추가 */}
        <div className="flex flex-wrap gap-1.5 pt-1.5 px-1 border-t border-slate-50">
          <AlignLeft size={12} className="text-slate-400 mt-0.5 mr-0.5" />
          {['tense', 'voice', 'mood', 'person', 'number', 'gender', 'case'].map(key => {
            if (!item[key]) return null;
            // 🚀 영어 필터링 적용
            const cleanVal = cleanGrammarText(item[key]);
            if (!cleanVal) return null;
            return (
              <span key={key} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">
                {cleanVal}
              </span>
            );
          })}
        </div>
      </div>

      {item.sentenceContext && (
        <div className="mt-auto pt-1.5 border-t border-slate-100 flex flex-col">
          <div className="text-[11px] font-serif text-slate-500 bg-slate-50 p-1.5 rounded-t-xl truncate" dir={isRTL ? 'rtl' : 'ltr'}>{item.sentenceContext}</div>
          {item.sentenceTranslation && (
            <div className="text-[11px] font-medium text-slate-600 bg-slate-100 p-1.5 rounded-b-xl border-t border-slate-200/50 truncate" dir="ltr">"{item.sentenceTranslation}"</div>
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