// 1. 유틸리티 헬퍼 함수
export function getParsingString(item) {
  const parts = [];
  if (item.tension || item.tense) parts.push(item.tense || item.tension);
  if (item.voice) parts.push(item.voice);
  if (item.mood) parts.push(item.mood);
  if (item.number) parts.push(item.number);
  if (item.person) parts.push(item.person);
  if (item.stem) parts.push(item.stem);
  if (item.gender) parts.push(item.gender);
  if (item.case) parts.push(item.case);
  return parts.join(', ');
}

export function getChoseong(str) {
  const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let result = "";
  for(let i=0; i<str.length; i++) {
    let code = str.charCodeAt(i) - 44032;
    if(code > -1 && code < 11172) result += cho[Math.floor(code/588)];
    else result += str.charAt(i);
  }
  return result;
}

// 2. 더미 데이터 (추후 Supabase 연동 시 삭제 또는 초기값으로 사용)
export const initialSentences = [
  {
    id: 's_g1', language: 'greek', original: 'Ἐν ἀρχῇ ἦν ὁ λόγος', translation: '태초에 말씀이 계셨다',
    words: [
      { id: 'w_g1', word: 'Ἐν', lemma: 'ἐν', pos: '전치사', meaning: '~안에', pronunciation: '엔' },
      { id: 'w_g2', word: 'ἀρχῇ', lemma: 'ἀρχή', pos: '명사', gender: '여성', number: '단수', case: '여격', meaning: '시작, 태초', pronunciation: '아르케' }
    ]
  }
];

export const examSentences = [
  {
     id: 'ex_1', language: 'greek', original: 'Οὕτως γὰρ ἠγάπησεν ὁ θεὸς τὸν κόσμον', translation: '하나님이 세상을 이처럼 사랑하사',
     words: [
       { id: 'ew1', word: 'Οὕτως', lemma: 'οὕτως', pos: '부사', meaning: '이처럼', pronunciation: '후토스'}
     ]
  }
];

export const generalMockData = [
  {
    id: 'g_1', subject: '구약개론 / 중간고사', question: '프랑스 혁명의 원인과 결과를 서술하시오.',
    parsedStructure: {
      intro: { title: '서론', content: '구체제의 모순과 계몽사상의 확산으로 인해 혁명의 배경이 형성됨.', keywords: ['구체제의 모순', '계몽사상', '재정 파탄'] },
      body: { title: '본론', content: '바스티유 감옥 습격으로 시작되어 인권 선언이 발표되고 공화정이 수립됨.', keywords: ['바스티유', '인권 선언', '공화정'] },
      conclusion: { title: '결론', content: '봉건제 폐지와 민주주의 이념의 확산으로 근대 사회의 기틀을 마련함.', keywords: ['봉건제 폐지', '민주주의 확산', '근대 사회'] }
    },
    blanks: [
      { isBlank: false, text: '프랑스 혁명은 ' }, { isBlank: true, text: '구체제의 모순' }, { isBlank: false, text: '과 ' }, { isBlank: true, text: '계몽사상' }, { isBlank: false, text: '의 영향을 받아 발생했다.' }
    ]
  }
];

export const quizMockData = [
  {
    id: 'q_1', subject: '구약개론 / 중간고사', type: 'multiple', question: '다음 중 프랑스 혁명의 직접적인 원인으로 가장 알맞은 것은?',
    options: ['산업 혁명으로 인한 자본가 계급 성장', '구체제의 모순과 심각한 재정 적자', '영국의 식민지 과세 정책', '나폴레옹의 쿠데타'], answer: '구체제의 모순과 심각한 재정 적자', explanation: '구체제의 모순과 재정 파탄이 원인입니다.'
  }
];