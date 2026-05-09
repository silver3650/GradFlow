import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini API를 활용하여 과제 내용을 분석하고 세부 일정으로 쪼개는 유틸리티
 */

// 개발 환경변수에서 API 키를 가져옵니다. 
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "여기에_제미나이_API_키를_입력하세요"; 

export const analyzeAssignmentWithAI = async (taskRawData) => {
  // API 키가 설정되지 않은 경우 UI 테스트를 위한 가상(Mock) 데이터 반환
  if (!API_KEY || API_KEY === "여기에_제미나이_API_키를_입력하세요") {
    console.warn("Gemini API Key가 없습니다. 테스트용 더미 데이터를 반환합니다.");
    return {
      title: taskRawData.title || "분석된 과제명",
      description: "AI가 과제 내용을 요약한 결과입니다. (API 키를 연동하면 실제 분석 결과가 나옵니다.)",
      dueDate: "2026-06-15T23:59",
      subTasks: [
        "관련 논문 및 참고 문헌 3편 이상 조사하기",
        "초안 작성 및 아키텍처 다이어그램 구성하기",
        "최종 검토 및 맞춤법 검사 후 제출하기"
      ]
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // 가장 빠르고 가성비가 좋은 gemini-1.5-flash 모델 사용
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // AI에게 내릴 프롬프트(명령어) 세팅
    const prompt = `
      다음은 구글 클래스룸에서 가져온 대학원생의 과제 정보입니다.
      과목명: ${taskRawData.courseName || "미지정"}
      과제명: ${taskRawData.title || "제목 없음"}
      과제 설명: ${taskRawData.description || "설명 없음"}
      마감 기한(원본 데이터): ${JSON.stringify(taskRawData.dueDate || {})} ${JSON.stringify(taskRawData.dueTime || {})}

      이 정보를 바탕으로 대학원생이 체계적으로 일정을 관리할 수 있도록 다음 형식의 JSON으로만 정확하게 응답하세요. 
      코드 블록(\`\`\`json 등)이나 추가 설명 없이 순수한 JSON 텍스트만 출력해야 합니다.

      {
        "title": "과제명 (원본과 가급적 동일하게 유지)",
        "description": "과제 내용을 2~3줄로 명확하게 요약한 핵심 설명",
        "dueDate": "YYYY-MM-DDTHH:mm 형식의 마감일시 (주어진 기한이 없으면 현재 날짜 기준 일주일 뒤로 임의 설정)",
        "subTasks": [
          "실행 가능한 구체적인 세부 단계 1", 
          "실행 가능한 구체적인 세부 단계 2", 
          "실행 가능한 구체적인 세부 단계 3"
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // 마크다운 흔적(```json, ```)을 제거하여 순수 JSON 포맷으로 정제
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    // JSON 객체로 파싱
    const analyzedData = JSON.parse(cleanedText);
    
    return analyzedData;

  } catch (error) {
    console.error("Gemini AI 분석 중 오류 발생:", error);
    return null;
  }
};