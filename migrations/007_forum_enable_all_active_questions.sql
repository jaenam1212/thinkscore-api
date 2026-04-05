-- 활성 문제는 모두 문제별 포럼 사용 가능 (기존 DB 일괄 정렬)
-- Supabase SQL Editor 또는 psql에서 한 번 실행

UPDATE questions
SET
  forum_enabled = true,
  updated_at = now()
WHERE is_active = true;
