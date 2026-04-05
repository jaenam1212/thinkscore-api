-- 선택: 조회수 원자적 증가용 RPC (없으면 API가 일반 UPDATE로 대체함)
CREATE OR REPLACE FUNCTION increment_views(post_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_posts
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = post_id;
END;
$$;
