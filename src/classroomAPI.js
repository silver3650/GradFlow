/**
 * Google Classroom API 연동 유틸리티
 */

export const fetchGoogleClassroomAssignments = async (accessToken) => {
  if (!accessToken) {
    console.error("Google Access Token이 없습니다. 로그인을 확인해주세요.");
    return [];
  }

  try {
    // 1. 활성화된(ACTIVE) 코스(과목) 목록 가져오기
    const coursesResponse = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!coursesResponse.ok) {
      throw new Error(`코스 목록 Fetch 실패: ${coursesResponse.status}`);
    }

    const { courses } = await coursesResponse.json();

    if (!courses || courses.length === 0) {
      console.log("활성화된 클래스룸 과목이 없습니다.");
      return [];
    }

    // 2. 각 코스별 최신 과제(courseWork) 수집하기 (Promise.all로 병렬 처리)
    const allWorkPromises = courses.map(async (course) => {
      try {
        // 각 과목당 최근 업데이트된 과제 5개씩 호출
        const workResponse = await fetch(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?orderBy=updateTime desc&pageSize=5`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await workResponse.json();
        
        // 과목명(courseName)을 과제 데이터에 병합
        return (data.courseWork || []).map(work => ({
          ...work,
          courseId: course.id,
          courseName: course.name
        }));
      } catch (err) {
        console.error(`과제 Fetch 에러 (과목: ${course.name}):`, err);
        return [];
      }
    });

    const allWorkArrays = await Promise.all(allWorkPromises);
    const allWork = allWorkArrays.flat();

    // 3. 모든 과제를 최신 업데이트 시간(updateTime) 기준으로 내림차순 정렬
    return allWork.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));

  } catch (error) {
    console.error("Google Classroom 연동 중 에러 발생:", error);
    return [];
  }
};