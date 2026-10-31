import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { callGeminiAPI } from '../../utils/geminiAPI'; 
import { initialSentences, getParsingString } from '../../utils/learningData';
import { 
  UploadCloud, Search, BookMarked, Repeat, Play, Volume2, 
  EyeOff, Brain, Trash2, CheckCircle, XCircle, BookOpen, 
  Zap, RefreshCw, Globe, CheckSquare, Square, X, Plus, 
  Settings, Lightbulb, FileText, ArrowLeft, AlignLeft, AlertCircle, Loader2, Edit3, Save, ChevronUp, ArrowRight, Filter
} from 'lucide-react';

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

const grammarLabels = { 
  tense: '시상', voice: '태', mood: '법', 
  person: '인칭', number: '수', gender: '성', case: '격' 
};

export default function BiblicalStudy({ onBack, onNavigate }) {
  const [biblicalTab, setBiblicalTab] = useState('upload'); 
  const [showPhonetics, setShowPhonetics] = useState(true);
  const [globalLang, setGlobalLang] = useState('all');
  const [grammarFilter, setGrammarFilter] = useState('all'); 
  const [toastMsg, setToastMsg] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reparsingId, setReparsingId] = useState(null); 

  const [sentences, setSentences] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [reviewList, setReviewList] = useState([]);
  
  const [drillQueue, setDrillQueue] = useState([]);
  const [currentDrillMode, setCurrentDrillMode] = useState('find_word');

  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    fetchBiblicalData();

    const handleScroll = () => {
      const currentScrollY = document.documentElement.scrollTop || document.body.scrollTop || document.querySelector('main')?.scrollTop || 0;
      if (currentScrollY > 300) setShowTopBtn(true);
      else setShowTopBtn(false);
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
    if(mainContainer) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchBiblicalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [sentencesRes, vocabRes, reviewsRes] = await Promise.all([
      supabase.from('biblical_sentences').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('biblical_vocab').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('biblical_reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    if (sentencesRes.data && sentencesRes.data.length > 0) setSentences(sentencesRes.data);
    else setSentences(initialSentences); 

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
    if (!user) return showToast('로그인이 필요합니다.');

    setIsAnalyzing(true);
    setBiblicalTab('sentences');

    try {
      const prompt = `
첨부된 입력 자료(텍스트, 이미지, 문서)에서 '성서 원어(헬라어/히브리어)' 내용을 분석하여 파싱 데이터를 생성해.
[최고 수준 경고 - JSON 문법 절대 엄수]
응답은 반드시 처음 시작을 '['로, 끝을 ']'로 닫는 완벽한 JSON 배열 포맷이어야 해.

[요구사항]
1. 일반 문장일 경우 텍스트에 섞인 한글 지시문, 숫자 등을 삭제하고 원어 문장 단위로 객체 배열을 만들어.
2. [중요] 만약 입력된 자료가 "문법 연습문제 표" 형태라면, 이를 하나의 가상 문장 객체로 묶고, original 값을 "문법 연습문제 단어 목록", translation을 "문법 연습문제 단어 모음"으로 설정해.
3. 데이터가 방대할 경우 최대 10문장(또는 표 1개)까지만 추출.
4. 'language'는 'greek' 또는 'hebrew'.
5. 각 문장의 'words' 배열에 단어들을 순서대로 담고, 단어 객체에는 원어 텍스트("word"), 사전형("lemma"), 뜻("meaning"), 품사("pos"), 음가/발음("pronunciation")이 필수.
6. [중요] 문법 속성(시상, 태, 법, 인칭, 수, 격, 성)은 오직 '순수 한글'(예: 제1단순과거, 능동태)로 기재.
7. 시상이 '과거/단순과거' 계열인 경우, "morphology": { "prefix": "접두모음", "stem": "어간", "suffix": "어미" } 객체를 추가할 것.
8. 문장 전체나 연습표의 핵심 시상을 "grammar_tags" 배열에 담을 것.

[출력 예시]
[
  {
    "language": "greek",
    "original": "문법 연습문제 단어 목록",
    "translation": "문법 연습문제 단어 모음",
    "grammar_tags": ["제1단순과거"],
    "words": [
      {
        "word": "ἠγάπησεν",
        "lemma": "ἀγαπάω",
        "meaning": "사랑하다",
        "pos": "동사",
        "pronunciation": "에가페센",
        "tense": "제1단순과거",
        "voice": "능동태",
        "mood": "직설법",
        "person": "3인칭",
        "number": "단수",
        "morphology": { "prefix": "ἠ", "stem": "γάπη", "suffix": "σεν" }
      }
    ]
  }
]

[입력 텍스트 내용]
${payload.content || '첨부파일/이미지 참조'}
`;
      const apiPayload = payload.base64 ? { base64: payload.base64, mimeType: payload.mimeType } : null;
      const responseText = await callGeminiAPI(prompt, "성서 원어 형태소 대량 파싱", apiPayload); 
      let parsedAI = parseAIResponse(responseText);

      let sentencesArray = [];
      if (Array.isArray(parsedAI)) {
        if (parsedAI.length > 0 && (parsedAI[0].word || parsedAI[0].lemma) && !parsedAI[0].words) {
           sentencesArray = [{
             language: 'greek',
             original: '문법 연습문제 단어 목록',
             translation: '문법 연습문제 단어 모음',
             grammar_tags: [],
             words: parsedAI
           }];
        }
        else if (parsedAI.length === 1 && Array.isArray(parsedAI[0].sentences)) sentencesArray = parsedAI[0].sentences;
        else if (parsedAI.length === 1 && Array.isArray(parsedAI[0].data)) sentencesArray = parsedAI[0].data;
        else sentencesArray = parsedAI;
      } else if (parsedAI && typeof parsedAI === 'object') {
        if (Array.isArray(parsedAI.sentences)) sentencesArray = parsedAI.sentences;
        else if (Array.isArray(parsedAI.data)) sentencesArray = parsedAI.data;
        else if (parsedAI.original && Array.isArray(parsedAI.words)) sentencesArray = [parsedAI]; 
        else if (Array.isArray(parsedAI.words)) {
           sentencesArray = [{ original: '단어 목록', translation: '분석 결과', grammar_tags: [], words: parsedAI.words }];
        }
        else {
          const validArray = Object.values(parsedAI).find(val => Array.isArray(val) && val.length > 0 && typeof val[0] === 'object');
          if (validArray && (validArray[0].original || validArray[0].words)) sentencesArray = validArray;
          else if (validArray && (validArray[0].word || validArray[0].lemma)) sentencesArray = [{ original: '단어 목록', translation: '분석 결과', words: validArray }];
          else sentencesArray = [parsedAI];
        }
      }

      sentencesArray = sentencesArray.filter(s => s && (s.original || s.words));
      if (sentencesArray.length === 0) throw new Error("유효한 문장 객체를 추출하지 못했습니다.");

      const newSentences = sentencesArray.map((item, idx) => {
        let finalTranslation = item.translation || '';
        if (!finalTranslation && item.original && item.original.includes('연습문제')) finalTranslation = '문법 연습문제 단어 모음';

        return {
          id: `s_${Date.now()}_${idx}`,
          user_id: user.id,
          language: item.language || 'greek',
          original: item.original || '단어 연습 목록',
          translation: finalTranslation,
          grammar_tags: item.grammar_tags || [],
          words: Array.isArray(item.words) ? item.words.map((w, wIdx) => ({
            ...w,
            id: w.id || `w_${Date.now()}_${idx}_${wIdx}`,
            word: w.word || w.original_word || w.text || w.단어 || w.헬라어 || '단어누락',
            lemma: w.lemma || w.원형 || w.사전형 || w.기본형 || '',
            meaning: w.meaning || w.의미 || w.뜻 || '',
            pronunciation: w.pronunciation || w.발음 || w.음가 || '',
            pos: w.pos || w.품사 || w.품사명 || '동사',
            tense: w.tense || w.시상 || w.시제 || '',
            voice: w.voice || w.태 || '',
            mood: w.mood || w.법 || '',
            person: w.person || w.인칭 || '',
            number: w.number || w.수 || '',
            gender: w.gender || w.성 || '',
            case: w.case || w.격 || '',
            morphology: w.morphology || getFallbackMorphology(w.word)
          })) : [],
          is_exam_mode: payload.isExamMode || false
        };
      });

      let { error } = await supabase.from('biblical_sentences').insert(newSentences);
      if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
         const safeSentences = newSentences.map(({ grammar_tags, ...rest }) => rest);
         const retry = await supabase.from('biblical_sentences').insert(safeSentences);
         if (retry.error) throw retry.error;
      } else if (error) {
         throw error;
      }

      setSentences(prev => [...newSentences, ...prev]);
      showToast(`AI 파싱 완료! 성공적으로 데이터를 분석했습니다.`);
    } catch (error) {
      console.error("최종 처리 에러 상세:", error);
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
        const { error: updateErr } = await supabase.from('biblical_sentences').update({ original: targetText }).eq('id', sentence.id);
        if (updateErr) throw updateErr;
      }

      const prompt = `
다음 성서 원어 문장(또는 단어 목록)을 분석하여 파싱 데이터와 태그를 반환해.
[최고 수준 경고] 배열 '[ ]' 안에 객체를 담아야 하며, 문자열은 모두 쌍따옴표로 묶어라.
[원본 문장] ${targetText}
[요구사항]
1. 단어를 순서대로 객체화 ("word", "lemma", "pos", "meaning", "pronunciation", "tense" 등 필수).
2. 속성 값은 모두 한글. "grammar_tags" 배열 추가 및 "translation" 속성에 한글 번역 기재.
`;
      const responseText = await callGeminiAPI(prompt, "단일 문장 강제 파싱");
      let parsedResponse = parseAIResponse(responseText);
      
      let newWords = [];
      let newTags = sentence.grammar_tags || [];
      let newTranslation = sentence.translation;

      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        if (parsedResponse[0].word || parsedResponse[0].lemma) {
           newWords = parsedResponse;
        } else if (parsedResponse[0].words) {
          newWords = parsedResponse[0].words;
          newTags = parsedResponse[0].grammar_tags || newTags;
          if(parsedResponse[0].translation) newTranslation = parsedResponse[0].translation;
        } else {
          newWords = parsedResponse;
        }
      } else if (parsedResponse.words) {
        newWords = parsedResponse.words;
        newTags = parsedResponse.grammar_tags || newTags;
        if(parsedResponse.translation) newTranslation = parsedResponse.translation;
      }

      newWords = newWords.map((w, idx) => ({ 
        ...w, 
        id: `w_${Date.now()}_re_${idx}`, 
        word: w.word || w.original_word || w.text || w.단어 || '단어누락',
        lemma: w.lemma || w.원형 || w.사전형 || '',
        meaning: w.meaning || w.의미 || w.뜻 || '',
        pronunciation: w.pronunciation || w.발음 || w.음가 || '',
        pos: w.pos || w.품사 || w.품사명 || '동사',
        tense: w.tense || w.시상 || w.시제 || '',
        morphology: w.morphology || getFallbackMorphology(w.word)
      }));

      const updatePayload = { original: targetText, translation: newTranslation, words: newWords, grammar_tags: newTags };
      let { error } = await supabase.from('biblical_sentences').update(updatePayload).eq('id', sentence.id);
      
      if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
         delete updatePayload.grammar_tags;
         const retry = await supabase.from('biblical_sentences').update(updatePayload).eq('id', sentence.id);
         if (retry.error) throw retry.error;
      } else if (error) {
         throw error;
      }

      setSentences(prev => prev.map(s => s.id === sentence.id ? { ...s, original: targetText, translation: newTranslation, words: newWords, grammar_tags: newTags } : s));
      showToast('문장 파싱이 완료되었습니다.');
    } catch (error) {
      console.error("재분석 에러:", error);
      showToast('재분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setReparsingId(null);
    }
  };

  const handleAddVocab = async (words) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return showToast('로그인이 필요합니다.');

      const newVocabs = words.filter(w => !vocabulary.some(existing => existing.word === w.word)).map(w => {
        const parentSentence = sentences.find(s => s.original === w.sentenceContext);
        return {
          id: `v_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          user_id: user.id,
          language: w.language || 'greek',
          word: w.word,
          lemma: w.lemma || '',
          pos: w.pos || '동사',
          meaning: w.meaning || '',
          pronunciation: w.pronunciation || '',
          sentence_context: w.sentenceContext || '',
          sentence_translation: w.sentenceTranslation || '',
          tense: w.tense || '',
          voice: w.voice || '',
          mood: w.mood || '',
          person: w.person || '',
          number: w.number || '',
          gender: w.gender || '',
          case: w.case || '',
          morphology: w.morphology || getFallbackMorphology(w.word),
          grammar_tags: parentSentence ? parentSentence.grammar_tags : []
        };
      });

      if (newVocabs.length === 0) return showToast('이미 단어장에 있는 단어들입니다.');

      let { error } = await supabase.from('biblical_vocab').insert(newVocabs);
      if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
         const safeVocabs = newVocabs.map(({ morphology, grammar_tags, tense, voice, mood, person, number, gender, case: wordCase, ...rest }) => rest);
         const retry = await supabase.from('biblical_vocab').insert(safeVocabs);
         if (retry.error) throw retry.error;
      } else if (error) {
         throw error;
      }
      
      const stateVocabs = newVocabs.map(v => ({ ...v, sentenceContext: v.sentence_context, sentenceTranslation: v.sentence_translation }));
      setVocabulary(prev => [...stateVocabs, ...prev]);
      showToast(`${newVocabs.length}개의 단어가 성공적으로 담겼습니다!`);
    } catch (error) {
      console.error("단어장 추가 최종 에러:", error);
      showToast('단어장 추가에 실패했습니다.');
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

    const reviewRecord = { id: `rev_${Date.now()}`, user_id: user.id, word_data: wordObj, failed_mode: mode };
    await supabase.from('biblical_reviews').insert(reviewRecord);
    setReviewList(prev => [{ id: reviewRecord.id, wordObj, failedMode: mode }, ...prev]); 
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
    }
  };

  const savedWordKeys = new Set(vocabulary.map(v => v.word));

  const availableGrammarTags = Array.from(
    new Set([
      ...sentences.flatMap(s => s.grammar_tags || []),
      ...sentences.flatMap(s => s.words?.map(w => w.tense).filter(Boolean) || [])
    ])
  ).sort();

  const filteredSentences = sentences
    .filter(s => globalLang === 'all' || s.language === globalLang)
    .filter(s => {
       if (grammarFilter === 'all') return true;
       return (s.grammar_tags && s.grammar_tags.includes(grammarFilter)) || s.words?.some(w => w.tense === grammarFilter);
    });
    
  const filteredVocab = vocabulary
    .filter(v => globalLang === 'all' || v.language === globalLang)
    .filter(v => {
       if (grammarFilter === 'all') return true;
       return (v.grammar_tags && v.grammar_tags.includes(grammarFilter)) || v.tense === grammarFilter;
    });
    
  const filteredReview = reviewList.filter(r => globalLang === 'all' || r.wordObj.language === globalLang);

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-right-4 duration-300 relative pb-32">
      
      <div className="flex items-center justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-4 gap-2">
        {onBack && (
          <button onClick={onBack} className="flex items-center justify-center p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors shrink-0" title="대시보드로 돌아가기">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex flex-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => onNavigate && onNavigate('learning_general')} className="flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-slate-500 hover:bg-slate-200/50">일반 과목</button>
          <button className="flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all bg-white shadow text-indigo-700 pointer-events-none">성서 원어</button>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[999] bg-slate-900 text-white px-4 py-2 rounded-full shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in text-xs whitespace-nowrap">
          <CheckCircle size={14} className="text-emerald-400" /> {toastMsg}
        </div>
      )}

      <div className="flex overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-4 gap-1">
        <button onClick={() => setBiblicalTab('upload')} className={`shrink-0 flex-1 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'upload' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>자료 등록</button>
        <button onClick={() => setBiblicalTab('sentences')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'sentences' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>문장 학습 {filteredSentences.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredSentences.length}</span>}</button>
        <button onClick={() => setBiblicalTab('vocab')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'vocab' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>단어장 {filteredVocab.length > 0 && <span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredVocab.length}</span>}</button>
        <button onClick={() => setBiblicalTab('review')} className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] sm:text-xs font-black rounded-xl transition-all ${biblicalTab === 'review' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>오답 노트 {filteredReview.length > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{filteredReview.length}</span>}</button>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-end gap-3 mb-5">
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Filter size={13} className="ml-2 mr-1 text-slate-400" />
            <select value={grammarFilter} onChange={(e) => setGrammarFilter(e.target.value)} className="bg-transparent border-none text-[11px] font-bold text-slate-600 focus:ring-0 outline-none pr-4 py-1.5 cursor-pointer">
              <option value="all">모든 문법</option>
              {availableGrammarTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <div className="flex shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setGlobalLang('all')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'all' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>전체</button>
            <button onClick={() => setGlobalLang('greek')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'greek' ? 'bg-blue-500 shadow text-white' : 'text-slate-500'}`}>헬라어</button>
            <button onClick={() => setGlobalLang('hebrew')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${globalLang === 'hebrew' ? 'bg-amber-500 shadow text-white' : 'text-slate-500'}`}>히브리어</button>
          </div>
          <button onClick={() => setShowPhonetics(!showPhonetics)} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors border ${showPhonetics ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            {showPhonetics ? <Volume2 size={14}/> : <EyeOff size={14}/>} 음가
          </button>
        </div>
      </div>

      {biblicalTab === 'upload' && <BiblicalUploadTab onUpload={handleBiblicalUpload} />}
      
      {biblicalTab === 'sentences' && (
        isAnalyzing ? (
          <div className="bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center animate-in fade-in duration-300 mt-2">
            <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
            <h3 className="text-sm md:text-base font-extrabold text-slate-800 mb-2">AI가 원어 텍스트 및 이미지를 파싱하고 있습니다</h3>
            <p className="text-xs md:text-sm text-slate-500 text-center leading-relaxed">
              자료의 양과 복잡도에 따라 10초~30초 정도 소요될 수 있습니다.
            </p>
          </div>
        ) : (
          <SentencesTab sentences={filteredSentences} savedWordKeys={savedWordKeys} showPhonetics={showPhonetics} onAddVocab={handleAddVocab} globalLang={globalLang} onDelete={handleDeleteSentence} onBulkDelete={handleBulkDeleteSentences} onReparse={handleReparseSentence} reparsingId={reparsingId} />
        )
      )}
      
      {biblicalTab === 'vocab' && <VocabTab vocabulary={filteredVocab} showPhonetics={showPhonetics} onStartDrill={startDrill} onRemoveVocab={handleRemoveVocab} />}
      {biblicalTab === 'review' && <ReviewTab reviewList={filteredReview} onRemoveReview={handleRemoveReview} showPhonetics={showPhonetics} onStartDrill={startDrill} />}
      {biblicalTab === 'drill' && <DrillTab queue={drillQueue} mode={currentDrillMode} showPhonetics={showPhonetics} onComplete={() => setBiblicalTab('vocab')} onFail={handleAddReview} />}

      {showTopBtn && (
        <button onClick={scrollToTop} className="fixed bottom-24 right-5 bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-full shadow-xl transition-all z-50 animate-in fade-in slide-in-from-bottom-5 hover:-translate-y-1">
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

  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleTextSubmit = () => {
    if(!textContent) return;
    setIsParsing(true);
    setTimeout(() => { setIsParsing(false); onUpload({ type: 'text', content: textContent, isExamMode: false }); }, 100);
  };

  const processFile = (file) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => { 
      setIsParsing(false);
      const dataUrl = event.target.result;
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : null;
      
      onUpload({ 
        type: 'file', 
        fileContent: dataUrl,
        base64: base64Data,   
        mimeType: file.type,
        isExamMode: true 
      }); 
    };
    reader.onerror = () => { setIsParsing(false); alert('파일 읽기 오류'); };
    
    if (file.type.startsWith('text/')) {
       reader.readAsText(file);
    } else {
       reader.readAsDataURL(file);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file); 
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file); 
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="bg-slate-800 p-4 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5"><Brain size={15} className="text-indigo-400" /> 성서 원어 AI 파서</h2>
          <p className="text-slate-300 text-[11px] leading-relaxed max-w-lg">텍스트, 캡처된 헬라어 문장, 문법 연습 표(이미지/PDF)를 업로드하거나 <span className="text-indigo-300 font-bold">화면 위에서 Ctrl+V(붙여넣기)</span> 하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col space-y-2">
          <div className="flex items-center gap-1.5"><BookOpen className="text-indigo-500" size={13}/><h3 className="text-xs font-bold text-slate-800">텍스트 직접 입력</h3></div>
          <div className="flex-1 flex flex-col pt-1">
            <textarea className="w-full p-3 border border-slate-200 rounded-xl resize-none text-[13px] font-serif mb-2 flex-1 focus:border-indigo-500 outline-none leading-loose" placeholder="여기에 원어 텍스트를 복사해서 붙여넣으세요." value={textContent} onChange={(e) => setTextContent(e.target.value)} />
            <button onClick={handleTextSubmit} disabled={isParsing || !textContent} className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold rounded-xl transition-colors disabled:opacity-50">{isParsing ? '준비 중...' : '텍스트 AI 분석 시작'}</button>
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-3xl shadow-sm border-2 border-indigo-200 flex flex-col relative">
          <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl shadow-sm z-10">이미지 복사 붙여넣기 지원</div>
          <div className="mb-2 relative z-10">
            <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-0.5"><Zap className="text-amber-500 fill-amber-500" size={13}/> 문서 및 이미지 스캔</h3>
            <p className="text-[10px] text-indigo-700">캡처한 이미지를 <span className="font-bold bg-indigo-100 px-1 rounded">Ctrl+V</span> 로 바로 붙여넣을 수 있습니다.</p>
          </div>
          
          <input type="file" id="biblical-file" className="hidden" accept="image/*,.pdf,.txt,.md,.csv" onChange={handleFileInputChange} />
          
          <label htmlFor="biblical-file" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={handleFileDrop} className={`border-2 border-dashed rounded-3xl flex-1 flex flex-col items-center justify-center p-5 text-center transition-all cursor-pointer relative z-10 ${isDragging ? 'border-indigo-500 bg-indigo-100' : 'border-indigo-300 bg-white/60 hover:bg-white'}`}>
            {isParsing ? (
               <div className="flex flex-col items-center"><RefreshCw className="animate-spin text-indigo-600 mb-1.5" size={26} /><p className="text-indigo-900 font-bold text-xs">AI가 문서를 분석 중입니다...</p></div>
             ) : (
               <div>
                 <FileText className="text-indigo-400 mx-auto mb-2" size={32} />
                 <p className="font-bold text-indigo-900 text-xs mb-1.5">이미지/PDF 드래그 또는 <span className="bg-indigo-200 text-indigo-800 px-1 rounded">Ctrl+V</span></p>
                 <span className="text-[10px] text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-full border border-indigo-200 inline-block font-bold">클릭하여 파일 찾기</span>
               </div>
             )}
          </label>
        </div>
      </div>
    </div>
  );
}

function SentencesTab({ sentences, savedWordKeys, showPhonetics, onAddVocab, globalLang, onDelete, onBulkDelete, onReparse, reparsingId }) {
  const [selectedWordIds, setSelectedWordIds] = useState(new Set());
  const [activePopupWord, setActivePopupWord] = useState(null); 
  const [selectedSentenceIds, setSelectedSentenceIds] = useState(new Set());
  const [editingSentenceId, setEditingSentenceId] = useState(null);
  const [editingSentenceText, setEditingSentenceText] = useState('');

  useEffect(() => { 
    setSelectedWordIds(new Set()); setActivePopupWord(null); setSelectedSentenceIds(new Set()); setEditingSentenceId(null);
  }, [globalLang]);

  if (sentences.length === 0) return <div className="text-center py-10 animate-in fade-in"><Globe size={32} className="mx-auto mb-2 text-slate-300" /><p className="text-slate-500 font-bold text-sm">등록된 문장이 없습니다. 자료 등록 탭에서 추가해주세요.</p></div>;

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
    if (selectedSentenceIds.size === sentences.length) setSelectedSentenceIds(new Set());
    else setSelectedSentenceIds(new Set(sentences.map(s => s.id)));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-800 pl-1">
          <input type="checkbox" checked={sentences.length > 0 && selectedSentenceIds.size === sentences.length} onChange={toggleSelectAll} className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
          전체 선택
        </label>
        {selectedSentenceIds.size > 0 && (
          <button onClick={() => { onBulkDelete(Array.from(selectedSentenceIds)); setSelectedSentenceIds(new Set()); }} className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
            <Trash2 size={13} /> 선택 삭제 ({selectedSentenceIds.size})
          </button>
        )}
      </div>

      {sentences.map((sentence, reverseIdx) => {
        const sentenceNumber = sentences.length - reverseIdx;
        const isRTL = sentence.language === 'hebrew';
        const activeWord = sentence.words?.find(w => activePopupWord?.sentenceId === sentence.id && activePopupWord?.wordId === w.id);
        const isEmptyWords = !sentence.words || sentence.words.length === 0;

        const activeTagsInSentence = Array.from(new Set(sentence.words?.filter(w => savedWordKeys.has(w.word) && w.tense).map(w => w.tense)));
        const displayTags = Array.from(new Set([...(sentence.grammar_tags || []), ...activeTagsInSentence]));

        return (
          <div key={sentence.id} className={`bg-white p-4 sm:p-5 rounded-2xl shadow-sm border relative group transition-colors ${selectedSentenceIds.has(sentence.id) ? 'border-indigo-300 bg-indigo-50/10' : 'border-slate-200'}`}>
            {sentence.is_exam_mode && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-tr-2xl rounded-bl-xl shadow-sm z-10">시험 핵심</div>}
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input type="checkbox" checked={selectedSentenceIds.has(sentence.id)} onChange={() => toggleSentenceSelect(sentence.id)} className="w-4 h-4 rounded text-indigo-600 cursor-pointer" />
                <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">문장 {sentenceNumber}</span>
                <LanguageBadge language={sentence.language} />
                {displayTags.map((tag, i) => <span key={i} className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200 shadow-sm">#{tag}</span>)}
              </div>
              
              {editingSentenceId === sentence.id ? (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button onClick={() => { onReparse(sentence, editingSentenceText); setEditingSentenceId(null); }} disabled={reparsingId === sentence.id || !editingSentenceText.trim()} className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg disabled:opacity-50">{reparsingId === sentence.id ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} 저장 및 분석</button>
                  <button onClick={() => setEditingSentenceId(null)} className="text-slate-500 font-bold text-[11px] px-2.5">취소</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 self-end sm:self-auto">
                  <button onClick={() => { setEditingSentenceId(sentence.id); setEditingSentenceText(sentence.original); }} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg" title="문장 텍스트 직접 수정"><Edit3 size={14}/></button>
                  <button onClick={() => onReparse(sentence)} disabled={reparsingId === sentence.id} className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg disabled:opacity-50" title="문장 재분석">{reparsingId === sentence.id ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} </button>
                  <button onClick={() => onDelete(sentence.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg" title="삭제"><Trash2 size={14}/></button>
                </div>
              )}
            </div>

            {editingSentenceId === sentence.id ? (
              <div className="mb-3">
                <textarea value={editingSentenceText} onChange={(e) => setEditingSentenceText(e.target.value)} className="w-full p-3 border-2 border-indigo-200 rounded-xl text-sm font-serif outline-none bg-indigo-50/30 text-slate-800" rows={3} dir={isRTL ? 'rtl' : 'ltr'} placeholder="분석할 원어 텍스트를 정확하게 수정해주세요." />
              </div>
            ) : isEmptyWords ? (
              <div className="bg-rose-50/50 p-4 rounded-xl flex flex-col items-center justify-center mb-3">
                <AlertCircle className="text-rose-400 mb-2" size={24} />
                <p className="text-xs text-rose-700 font-bold mb-3">단어 파싱 정보가 누락되었습니다.</p>
                <div className="text-sm font-serif text-slate-700 mb-4" dir={isRTL ? 'rtl' : 'ltr'}>{sentence.original}</div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingSentenceId(sentence.id); setEditingSentenceText(sentence.original); }} className="bg-white border text-slate-600 px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold"><Edit3 size={14}/> 텍스트 직접 수정</button>
                  <button onClick={() => onReparse(sentence)} disabled={reparsingId === sentence.id} className="bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold">{reparsingId === sentence.id ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>} AI 재분석</button>
                </div>
              </div>
            ) : (
              <div className={`flex flex-wrap gap-x-3 gap-y-4 pt-2 mb-4 ${isRTL ? 'rtl' : 'ltr'}`}>
                {sentence.words.map((item) => {
                  const isSelected = selectedWordIds.has(item.id);
                  const isActive = activePopupWord?.sentenceId === sentence.id && activePopupWord?.wordId === item.id;
                  const isSavedInVocab = savedWordKeys.has(item.word);
                  
                  let wordStyle = 'hover:bg-slate-100 text-slate-900';
                  if (isActive) wordStyle = 'bg-indigo-100 text-indigo-900 border-b-2 border-indigo-500 font-bold shadow-sm';
                  else if (isSelected) wordStyle = 'bg-emerald-50 border-b-2 border-emerald-400';
                  else if (isSavedInVocab) wordStyle = 'bg-yellow-200 border-b-2 border-yellow-400 text-yellow-900 font-bold shadow-sm';

                  return (
                    <span key={item.id} className="relative inline-block mt-2">
                      {isSavedInVocab && item.tense && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold text-purple-600 bg-purple-100 border border-purple-200 px-1 rounded-sm whitespace-nowrap z-10 shadow-sm opacity-90">
                          {item.tense}
                        </span>
                      )}
                      <span onClick={() => setActivePopupWord(isActive ? null : { sentenceId: sentence.id, wordId: item.id })} className={`cursor-pointer inline-block text-lg sm:text-2xl font-serif px-2 py-0.5 rounded transition-all relative z-0 ${wordStyle}`} dir={isRTL ? 'rtl' : 'ltr'} title={isSavedInVocab ? "단어장에 등록된 단어입니다" : ""}>
                        {item.word || '단어누락'}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {!editingSentenceId && sentence.translation && (
              <div className="text-[13px] font-medium text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 w-fit leading-relaxed">
                {sentence.translation.includes('연습문제') ? <span className="text-slate-400 font-bold">[{sentence.translation}]</span> : `"${sentence.translation}"`}
              </div>
            )}

            {/* 🚀 모바일 최적화된 단어 분석 박스 (품사명 가로 고정 및 오버플로우 방지) */}
            {activeWord && !isEmptyWords && !editingSentenceId && (() => {
              const isSavedInVocab = savedWordKeys.has(activeWord.word);
              const activePronunciation = activeWord.pronunciation || getFallbackPronunciation(activeWord.word);

              return (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-inner overflow-hidden">
                    
                    {/* 상단 단어 및 음가 (모바일 음가 아래 배치) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 border-b border-slate-200/60 pb-3 gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                        <span className="text-xl sm:text-2xl font-serif text-indigo-900 font-bold" dir={isRTL ? 'rtl' : 'ltr'}>{activeWord.word}</span>
                        {showPhonetics && activePronunciation && (
                          <span className="text-[11px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg w-fit">
                            [{activePronunciation}]
                          </span>
                        )}
                      </div>
                      
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!isSavedInVocab) {
                             const wordToAdd = { ...activeWord, language: sentence.language, sentenceContext: sentence.original, sentenceTranslation: sentence.translation };
                             onAddVocab([wordToAdd]);
                          }
                        }} 
                        disabled={isSavedInVocab}
                        className={`self-start sm:self-auto flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border transition-colors shadow-sm ${isSavedInVocab ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {isSavedInVocab ? <CheckSquare size={14}/> : <Plus size={14}/>} {isSavedInVocab ? '단어장에 있음' : '단어장 바로 담기'}
                      </button>
                    </div>
                    
                    {/* 🚀 품사명 및 정보 그리드 (모바일 1열 대응 및 가로 고정 공간 확보) */}
                    <div className="grid grid-cols-[60px_1fr] sm:grid-cols-[70px_1fr] gap-x-3 gap-y-2 text-xs sm:text-[13px] mb-3 items-center bg-white p-3 rounded-xl border border-slate-100 overflow-x-auto">
                      <div className="text-slate-400 font-bold shrink-0">원형</div>
                      <div className="font-serif font-bold text-slate-800 text-sm sm:text-base break-all">{activeWord.lemma}</div>
                      
                      <div className="text-slate-400 font-bold shrink-0">품사</div>
                      <div className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit whitespace-nowrap">{activeWord.pos || '동사'}</div>
                      
                      <div className="text-slate-400 font-bold shrink-0">의미</div>
                      <div className="font-bold text-emerald-700 break-words">{activeWord.meaning}</div>
                    </div>
                    
                    {/* 문법 속성 뱃지 영역 */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                      <AlignLeft size={14} className="text-slate-400 mt-1 mr-1 hidden sm:inline-block shrink-0" />
                      {Object.keys(grammarLabels).map(key => {
                        if (!activeWord[key]) return null;
                        const cleanVal = cleanGrammarText(activeWord[key]);
                        if (!cleanVal) return null; 
                        return (
                          <span key={key} className="bg-white text-slate-700 text-[11px] font-bold px-2 py-1 rounded-md shadow-sm border border-slate-200 whitespace-nowrap">
                            {cleanVal}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {selectedWordIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-4 w-[90%] max-w-sm border border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">{selectedWordIds.size}</div>
            <span className="font-bold text-xs">단어 선택됨</span>
          </div>
          <button onClick={handleAddSelected} className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs shadow-sm">
            <Plus size={14} /> 선택 항목 모두 추가
          </button>
        </div>
      )}
    </div>
  );
}

function VocabTab({ vocabulary, showPhonetics, onStartDrill, onRemoveVocab }) {
  const [drillMode, setDrillMode] = useState('find_word'); 
  
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
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mt-1 overflow-x-auto">
               {[
                 { id: 'find_word', label: '단어 찾기 (역방향)' }, 
                 { id: 'lemma_pair', label: '원형 짝짓기' }, 
                 { id: 'lemma', label: '원형 암기' }, 
                 { id: 'parsing', label: '파싱' }, 
                 { id: 'meaning', label: '의미' }
               ].map(mode => (
                 <button key={mode.id} onClick={() => setDrillMode(mode.id)} className={`flex-1 px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-lg transition-colors ${drillMode === mode.id ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>{mode.label}</button>
               ))}
            </div>
          </div>
          <button onClick={() => onStartDrill(vocabulary, drillMode)} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-sm flex justify-center items-center gap-1.5 hover:bg-indigo-700 text-xs mt-2 sm:mt-0 whitespace-nowrap">
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
  if (reviewList.length === 0) return <div className="text-center py-10"><CheckCircle size={32} className="mx-auto mb-2 text-emerald-300" /><p className="text-slate-500 font-bold text-sm">오답이 없습니다.</p></div>;
  
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-rose-50 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-rose-100">
        <div>
          <h2 className="text-sm font-bold text-rose-900 mb-0.5 flex items-center gap-1.5"><Brain className="text-rose-600" size={15}/> 스마트 오답 노트</h2>
          <p className="text-rose-700 text-xs">틀린 문항을 다시 훈련하여 장기 기억화하세요.</p>
        </div>
        <button onClick={() => onStartDrill(reviewList.map(r => r.wordObj), 'find_word')} className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors">
          오답 재훈련
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reviewList.map(record => (
          <div key={record.id} className="relative">
            <div className="absolute -top-2 left-4 z-10 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
              {record.failedMode === 'find_word' ? '단어 찾기 틀림' : record.failedMode === 'lemma_pair' ? '원형 짝짓기 틀림' : record.failedMode === 'parsing' ? '파싱 틀림' : record.failedMode === 'aorist' ? '시상 번역 틀림' : '기타 틀림'}
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

const getFallbackPronunciation = (word) => {
  if (!word) return '';
  if (word.includes('ἐλύσαμεν')) return '엘뤼사멘';
  if (word.includes('ἐπίστευσαν')) return '에피스테우산';
  if (word.includes('ἠγάπησεν')) return '에가페센';
  if (word.includes('ἔλαβον')) return '엘라본';
  if (word.includes('οὕτως')) return '후토스';
  if (word.includes('κόσμον')) return '코스몬';
  return '';
};

// 🚀 기등록 단어를 위한 지능형 형태소 자동 분해 보조 함수
const getFallbackMorphology = (word) => {
  if (!word) return null;
  const match = word.match(/^([ἐεἠἡἀἁἱὑὓὧᾱᾲᾴᾶᾼᾹ]|ε[ἰἱ])(.+?)(σαμεν|σαν|θη|θην|θης|το|στο|ατε|ετωσαν|ε(ν)?|ον|α|ε|ης|ετο|οντο)$/i);
  if (match) {
    return {
      prefix: match[1],
      stem: match[2],
      suffix: match[3]
    };
  }
  if (word.startsWith('ἐ') || word.startsWith('ἠ') || word.startsWith('ε')) {
    return {
      prefix: word[0],
      stem: word.slice(1, -2),
      suffix: word.slice(-2)
    };
  }
  return null;
};

function WordCard({ item, showPhonetics, onRemove }) {
  const isRTL = item.language === 'hebrew';
  const pronunciationText = item.pronunciation || getFallbackPronunciation(item.word);
  const morph = item.morphology || getFallbackMorphology(item.word);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col relative h-full transition-colors hover:border-indigo-300">
      <button onClick={onRemove} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-rose-500 bg-slate-50 p-1.5 rounded-full transition-colors"><Trash2 size={13} /></button>
      <LanguageBadge language={item.language} />
      
      {item.lemma && (
        <div className="flex justify-center items-center gap-1.5 mb-1 mt-2">
          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">원형</span>
          <span className="font-serif text-slate-600 text-sm" dir={isRTL ? 'rtl' : 'ltr'}>{item.lemma}</span>
          <ArrowRight size={12} className="text-indigo-300" />
          <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-bold">과거</span>
        </div>
      )}

      {morph && morph.prefix && morph.stem && morph.suffix ? (
        <div className="text-xl font-serif mb-1 text-center flex justify-center items-baseline gap-[1px]" dir={isRTL ? 'rtl' : 'ltr'}>
          <span className="text-rose-500 font-bold" title="접두모음 (과거표지)">{morph.prefix}</span>
          <span className="text-indigo-900" title="어간">{morph.stem}</span>
          <span className="text-emerald-500 font-bold" title="시상/인칭어미">{morph.suffix}</span>
        </div>
      ) : (
        <div className="text-xl font-serif text-indigo-900 mb-1 mt-1.5 text-center" dir={isRTL ? 'rtl' : 'ltr'}>{item.word}</div>
      )}
      
      {showPhonetics && pronunciationText && (
        <div className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2.5 py-0.5 rounded-lg text-center w-fit mx-auto mb-1.5">
          [{pronunciationText}]
        </div>
      )}
      
      <div className="space-y-1.5 text-xs mt-auto border-t border-slate-100 pt-2 mb-2" dir="ltr">
        <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
          <span className="text-slate-500 font-bold">원형</span>
          <span className="font-serif font-bold text-slate-900 text-xs" dir={isRTL ? 'rtl' : 'ltr'}>{item.lemma}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-slate-400 font-bold">품사</span>
          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{item.pos || '동사'}</span>
        </div>
        <div className="flex justify-between items-center pt-1.5 px-1 border-t border-slate-50">
          <span className="text-slate-400 font-bold">의미</span>
          <span className="font-bold text-emerald-700 text-xs">{item.meaning}</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5 pt-1.5 px-1 border-t border-slate-50">
          <AlignLeft size={12} className="text-slate-400 mt-0.5 mr-0.5" />
          {Object.keys(grammarLabels).map(key => {
            if (!item[key]) return null;
            const cleanVal = cleanGrammarText(item[key]);
            if (!cleanVal) return null;
            return (
              <span key={key} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">
                {cleanVal}
              </span>
            );
          })}
        </div>
      </div>
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
  const pronunciationText = currentItem.pronunciation || getFallbackPronunciation(currentItem.word);
  const morph = currentItem.morphology || getFallbackMorphology(currentItem.word);
  
  if (mode === 'parsing') {
    recallPrompt = '정확한 문법(파싱)을 떠올려보세요.';
    correctAnswer = getParsingString(currentItem) || currentItem.pos;
  } else if (mode === 'meaning') {
    recallPrompt = '정확한 한글 의미를 떠올려보세요.';
    correctAnswer = currentItem.meaning;
  } else if (mode === 'aorist') { 
    recallPrompt = '이 문맥에서 단어의 올바른 시상 번역과 원형은?';
    correctAnswer = `${currentItem.meaning} (원형: ${currentItem.lemma})`;
  } else if (mode === 'lemma_pair') { 
    recallPrompt = '이 동사의 짝이 되는 현재형(원형)을 찾아보세요.';
    correctAnswer = currentItem.lemma;
  } else if (mode === 'find_word') {
    recallPrompt = '다음 분석에 해당하는 성서 원어 단어를 고르시오.';
    correctAnswer = currentItem.word;
  } else {
    recallPrompt = '단어의 원형(Lemma)을 떠올려보세요.';
    correctAnswer = currentItem.lemma;
  }

  const handleShowOptions = () => {
    let baseOptions = [];
    
    if (mode === 'lemma_pair') {
      const otherLemmas = queue.filter(item => item.lemma !== currentItem.lemma).map(item => item.lemma);
      const uniqueOtherLemmas = [...new Set(otherLemmas)];
      const shuffledOthers = uniqueOtherLemmas.sort(() => 0.5 - Math.random()).slice(0, 3);
      while(shuffledOthers.length < 3) {
        const dummies = ['βάλλω', 'λαμβάνω', 'ἔρχομαι', 'λέγω', 'ὁράω'].filter(d => d !== currentItem.lemma && !shuffledOthers.includes(d));
        shuffledOthers.push(dummies.pop() || `오답${shuffledOthers.length}`);
      }
      baseOptions = [correctAnswer, ...shuffledOthers];
      
    } else if (mode === 'find_word') {
      const otherWords = queue.filter(item => item.word !== currentItem.word).map(item => item.word);
      const uniqueOtherWords = [...new Set(otherWords)];
      const shuffledOthers = uniqueOtherWords.sort(() => 0.5 - Math.random()).slice(0, 3);
      while(shuffledOthers.length < 3) {
        const dummies = ['ἐλύσαμεν', 'ἐπίστευσαν', 'ἐβαπτίσθη', 'ἠκούσατε', 'ἔπεμψας'].filter(d => d !== currentItem.word && !shuffledOthers.includes(d));
        shuffledOthers.push(dummies.pop() || `오답${shuffledOthers.length}`);
      }
      baseOptions = [correctAnswer, ...shuffledOthers];

    } else if (mode === 'aorist') {
      baseOptions = [
        correctAnswer,
        `${currentItem.meaning} (원형: ${currentItem.word})`,
        `~하고 있었다 (원형: ${currentItem.lemma})`,
        `~하게 되었다 (원형: ${currentItem.lemma})` 
      ];
    } else {
      baseOptions = [correctAnswer, '오답1', '오답2', '오답3'];
    }
    
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
            {mode === 'find_word' ? (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner mb-4">
                 <h4 className="font-bold text-slate-700 mb-4 pb-2 border-b border-slate-200">다음 분석에 해당하는 헬라어 단어를 고르시오.</h4>
                 <div className="grid grid-cols-2 gap-3 text-sm text-left">
                   <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                     <span className="text-slate-400 text-[11px] block mb-1">사전형(원형)</span>
                     <span className="font-serif font-bold text-slate-800 text-base">{currentItem.lemma}</span>
                   </div>
                   <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                     <span className="text-slate-400 text-[11px] block mb-1">의미</span>
                     <span className="font-bold text-emerald-700">{currentItem.meaning}</span>
                   </div>
                   
                   <div className="col-span-2 bg-white p-4 rounded-lg border border-slate-100 shadow-sm flex flex-wrap gap-2">
                     <span className="text-slate-400 text-[11px] block w-full mb-1">분석 조건</span>
                     {Object.keys(grammarLabels).map(key => {
                        if (!currentItem[key]) return null;
                        const cleanVal = cleanGrammarText(currentItem[key]);
                        if (!cleanVal) return null;
                        return (
                          <span key={key} className="bg-indigo-50 text-indigo-700 text-sm font-bold px-2.5 py-1 rounded-md border border-indigo-100">
                            {cleanVal}
                          </span>
                        );
                      })}
                   </div>
                 </div>
              </div>
            ) : (
              <>
                {morph && morph.prefix && morph.stem && morph.suffix ? (
                  <div className="text-3xl font-serif mb-1.5 text-center flex justify-center items-baseline gap-[1px]" dir={isRTL ? 'rtl' : 'ltr'}>
                    <span className="text-rose-500 font-bold">{morph.prefix}</span>
                    <span className="text-slate-900">{morph.stem}</span>
                    <span className="text-emerald-500 font-bold">{morph.suffix}</span>
                  </div>
                ) : (
                  <div className="text-3xl font-serif text-slate-900 mb-1.5" dir={isRTL ? 'rtl' : 'ltr'}>{currentItem.word}</div>
                )}
                {showPhonetics && pronunciationText && (
                  <div className="text-xs font-bold text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-lg mb-3">
                    [{pronunciationText}]
                  </div>
                )}
              </>
            )}
            
            {currentItem.sentenceContext && currentItem.sentenceContext !== '단어 연습 목록' && (
              <>
                <div className="mt-2 text-xs font-serif text-slate-500 bg-slate-50 p-2 rounded-t-xl" dir={isRTL ? 'rtl' : 'ltr'}>{currentItem.sentenceContext}</div>
                {currentItem.sentenceTranslation && <div className="text-xs font-medium text-slate-600 bg-slate-100 p-2 rounded-b-xl border-t border-slate-200" dir="ltr">"{currentItem.sentenceTranslation}"</div>}
              </>
            )}
          </div>

          <div className="w-full">
            {phase === 'recall' && <button onClick={handleShowOptions} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-[13px] shadow-sm flex justify-center items-center gap-1.5"><CheckSquare size={14} /> 정답/보기 확인</button>}
            
            {(phase === 'options' || phase === 'feedback') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {shuffledOptions.map((opt, i) => {
                  let btnStyle = "bg-white border border-slate-200 hover:bg-indigo-50";
                  if (phase === 'feedback') {
                    if (opt === correctAnswer) btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-extrabold shadow-sm";
                    else if (opt === selectedOption) btnStyle = "bg-rose-50 border-rose-400 text-rose-800";
                    else btnStyle = "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
                  }
                  
                  const textClass = (mode === 'find_word' || mode === 'lemma_pair') ? "font-serif text-xl" : "text-sm";
                  
                  return (
                    <button 
                      key={i} 
                      onClick={() => handleSelectOption(opt)} 
                      disabled={phase === 'feedback'} 
                      className={`px-4 py-3 rounded-xl transition-all font-medium ${btnStyle} ${textClass}`} 
                      dir={(isRTL && (mode === 'lemma_pair' || mode === 'find_word')) ? 'rtl' : 'ltr'}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {phase === 'feedback' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in slide-in-from-bottom-2">
                <div className="flex flex-col items-center gap-1.5 mb-3">
                  {selectedOption === correctAnswer ? <><CheckCircle size={24} className="text-emerald-500" /><span className="font-bold text-emerald-700 text-sm">정답입니다!</span></> : <><XCircle size={24} className="text-rose-500" /><span className="font-bold text-rose-700 text-sm">오답 노트에 저장되었습니다.</span></>}
                </div>
                <button onClick={handleNext} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-[13px]">{currentIndex < queue.length - 1 ? '다음 문제 진행' : '훈련 종료'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}