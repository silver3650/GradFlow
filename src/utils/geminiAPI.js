import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// 🚀 courses 매개변수 추가
export const analyzeAssignmentWithAI = async (task, courses = []) => {
  if (!API_KEY) {
    console.error("Gemini API Key가 설정되지 않았습니다.");
    return null;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const modelsToTry = [
    "gemini-3.7-flash", 
    "gemini-3.6-flash", 
    "gemini-3.5-flash"  
  ];

  // 🚀 사용자 과목 목록을 문자열로 변환하여 AI에게 제공
  const courseListStr = courses.length > 0 
    ? courses.map(c => `{id: "${c.id}", name: "${c.name}"}`).join('\n')
    : '등록된 과목 없음';

  const prompt = `
    다음은 구글 클래스룸에 등록된 과제입니다. 이 과제를 분석하여 JSON 형식으로 반환해주세요.
    
    [과제 정보]
    제목: ${task.title}
    설명: ${task.description || '내용 없음'}
    마감일: ${task.dueDate || '없음'}
    
    [사용자 등록 과목 목록]
    ${courseListStr}

    [요구사항]
    반드시 아래의 키값을 가지는 순수 JSON 객체 하나만 반환하세요:
    - title: 과제 제목
    - category: 분류 ('assignment', 'exam', 'schedule', 'cancellation' 중 1개 선택)
    - due_date: 마감일 (YYYY-MM-DDTHH:mm 형식, 알 수 없으면 비워둘 것)
    - description: 과제의 핵심 내용을 요약한 설명
    - sub_tasks: 이 과제를 수행하기 위한 세부 단계 (문자열 배열 형태, 3~5개로 분할)
    - course_id: 과제 제목과 설명을 바탕으로 [사용자 등록 과목 목록] 중 가장 연관성 높은 과목의 id를 찾아 적어주세요. 매칭되는 과목이 없다면 null로 설정하세요.
  `;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI 분석] ${modelName} 모델로 분석 시도 중...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*}/);
      const parsedData = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : JSON.parse(responseText);
      
      console.log(`✅ [AI 분석 성공] ${modelName} 모델이 적용되었습니다.`);
      return parsedData;
      
    } catch (error) {
      console.warn(`⚠️ [AI 분석 실패] ${modelName} 적용 불가, 다음 버전으로 넘어갑니다. (사유: ${error.message})`);
    }
  }
  
  alert("모든 AI 모델 분석에 실패했습니다. API 키 설정 및 할당량을 확인해주세요.");
  return null;
};