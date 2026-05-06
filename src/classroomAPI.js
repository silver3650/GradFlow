// src/classroomAPI.js
import { supabase } from './supabaseClient';

export const fetchGoogleClassroomAssignments = async () => {
  try {
    // 1. 현재 로그인한 유저의 세션 정보 가져오기
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) throw new Error("로그인 세션이 없습니다.");
    
    // 🔥 Supabase가 구글 로그인 시 받아온 구글 전용 Access Token
    const providerToken = session.provider_token; 
    
    if (!providerToken) {
      throw new Error("구글 제공자 토큰(Provider Token)이 없습니다. 구글로 다시 로그인해주세요.");
    }

    // 2. 사용자가 속한 '활성화된(ACTIVE)' 수업(Course) 목록 가져오기
    const coursesRes = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    const coursesData = await coursesRes.json();

    if (!coursesData.courses) return []; // 수업이 없으면 빈 배열 반환

    let allAssignments = [];

    // 3. 각 수업을 순회하며 과제(CourseWork) 목록 가져오기
    for (const course of coursesData.courses) {
      const courseworkRes = await fetch(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork`, {
        headers: { Authorization: `Bearer ${providerToken}` }
      });
      const courseworkData = await courseworkRes.json();

      if (courseworkData.courseWork) {
        // 우리가 쓰기 편한 형태로 데이터 가공
        const formattedWork = courseworkData.courseWork.map(work => {
          
          // 구글 클래스룸은 마감일을 {year, month, day}, {hours, minutes} 객체로 분리해서 줍니다.
          let dueDateStr = null;
          if (work.dueDate) {
            const year = work.dueDate.year;
            const month = String(work.dueDate.month).padStart(2, '0');
            const day = String(work.dueDate.day).padStart(2, '0');
            const hours = work.dueTime?.hours ? String(work.dueTime.hours).padStart(2, '0') : '23';
            const minutes = work.dueTime?.minutes ? String(work.dueTime.minutes).padStart(2, '0') : '59';
            
            // UTC 기준으로 ISO String 생성 (구글은 기본적으로 UTC 기준 시간을 줌)
            dueDateStr = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00Z`).toISOString();
          }

          return {
            source: 'google_classroom',
            classroomId: work.id,
            courseName: course.name, // 구글 클래스룸의 수업명
            title: work.title,       // 과제 제목
            description: work.description || '상세 내용 없음', // 과제 내용
            dueDate: dueDateStr,     // 가공된 마감일
            link: work.alternateLink // 구글 클래스룸 바로가기 링크
          };
        });
        
        allAssignments = [...allAssignments, ...formattedWork];
      }
    }

    return allAssignments;

  } catch (error) {
    console.error("클래스룸 데이터 연동 실패:", error);
    return { error: error.message };
  }
};