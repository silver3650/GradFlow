// src/geminiAPI.js
const GEMINI_API_KEY = "본인의_API_키_입력"; // Google AI Studio에서 발급받은 키
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const analyzeAssignmentWithAI = async (courseName, title, description) => {
  const prompt = `
    당신은 대학원생의 학업을 돕는 스마트 비서입니다. 
    아래 구글 클래스룸 과제 내용을 분석하여, 과제를 수행하기 위한 세부 일정(sub_tasks)을 시간 순서대로 3~5단계로 쪼개주세요.

    [과제 정보]
    과목: ${courseName}
    과제명: ${title}
    내용: ${description}

    [출력 형식 (반드시 아래 구조의 JSON 포맷으로만 응답할 것)]
    {
      "summary": "과제에 대한 1~2줄 핵심 요약",
      "sub_tasks": ["단계 1 내용", "단계 2 내용", "단계 3 내용"]
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" } // JSON 응답 강제
      })
    });

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Gemini API 분석 실패:", error);
    return {
      summary: "AI 분석에 실패했습니다. 내용을 직접 확인해 주세요.",
      sub_tasks: ["과제 내용 확인하기"]
    };
  }
};