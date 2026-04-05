import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
} from "../common/dto/forum.dto";
import {
  ForumPost,
  ForumPostWithAuthor,
  ForumPostRaw,
  ForumPostDetail,
  ForumComment,
  ForumBoardItem,
} from "../common/types";

type ProfileAuthorEmbed = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

@Injectable()
export class ForumService {
  constructor(private supabase: SupabaseService) {}
  private readonly logger = new Logger(ForumService.name);

  /** 포럼 노출용 닉네임: display_name 우선, 없으면 내부용 google_xxx 등은 숨김 */
  private authorForResponse(author: ProfileAuthorEmbed | null | undefined): {
    username: string;
    avatar_url: string | null;
  } {
    const avatar_url = author?.avatar_url ?? null;
    const display = author?.display_name?.trim();
    if (display) {
      return { username: display, avatar_url };
    }
    const handle = author?.username?.trim() ?? "";
    if (/^(google|apple|kakao|naver)_/i.test(handle)) {
      return { username: "회원", avatar_url };
    }
    if (handle) {
      return { username: handle, avatar_url };
    }
    return { username: "익명", avatar_url };
  }

  /** embed에서 display_name 제외(일부 PostgREST/스키마에서 500 유발) → 배치 조회로 보강 */
  private async fetchAuthorsMap(
    ids: string[]
  ): Promise<Map<string, ProfileAuthorEmbed>> {
    const map = new Map<string, ProfileAuthorEmbed>();
    const uniq = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (uniq.length === 0) return map;

    const client = this.supabase.getClient();
    const withDisplay = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", uniq);

    const res =
      withDisplay.error || !withDisplay.data
        ? await (() => {
            this.logger.warn(
              `profiles batch (display_name): ${withDisplay.error?.message ?? "no data"} — retry without display_name`
            );
            return client
              .from("profiles")
              .select("id, username, avatar_url")
              .in("id", uniq);
          })()
        : withDisplay;

    if (res.error || !res.data) {
      if (res.error) {
        this.logger.error("profiles batch select failed:", res.error);
      }
      return map;
    }

    for (const row of res.data as Array<{
      id: string;
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    }>) {
      map.set(row.id, {
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      });
    }
    return map;
  }

  private mergeAuthorForResponse(
    authorId: string | undefined,
    embed: ProfileAuthorEmbed | null | undefined,
    profileMap: Map<string, ProfileAuthorEmbed>
  ): { username: string; avatar_url: string | null } {
    const prof = authorId ? profileMap.get(authorId) : undefined;
    return this.authorForResponse({
      username: embed?.username ?? prof?.username,
      display_name: prof?.display_name ?? embed?.display_name,
      avatar_url: embed?.avatar_url ?? prof?.avatar_url,
    });
  }

  async createPost(
    createPostDto: CreatePostDto,
    authorId: string
  ): Promise<ForumPost> {
    // question_id가 있으면: 존재하고 서비스 중(is_active)인 문제에만 글 허용
    if (createPostDto.question_id) {
      const { data: questionData, error: questionError } = await this.supabase
        .getClient()
        .from("questions")
        .select("id, is_active")
        .eq("id", createPostDto.question_id)
        .eq("is_active", true)
        .single();

      if (questionError || !questionData) {
        throw new BadRequestException(
          "해당 문제를 찾을 수 없거나 비활성화된 문제입니다."
        );
      }
    }

    const result = await this.supabase
      .getClient()
      .from("forum_posts")
      .insert({
        title: createPostDto.title,
        content: createPostDto.content,
        author_id: authorId,
        category: createPostDto.category || "free",
        question_id: createPostDto.question_id || null,
      })
      .select("*")
      .single();

    if (result.error) throw result.error;
    return result.data as ForumPost;
  }

  async getPosts(
    questionId?: number,
    sortBy: "recent" | "popular" | "all" = "all"
  ): Promise<ForumPostWithAuthor[]> {
    try {
      let query = this.supabase.getClient().from("forum_posts").select(`
        *,
        author:profiles!forum_posts_author_id_fkey(username, avatar_url),
        question:questions(title, description),
        comments_count:forum_comments(count)
      `);

      // questionId가 있으면 해당 문제 게시판만; 없으면 전체 포럼(자유글·문제 연동 글 모두)
      if (questionId) {
        query = query.eq("question_id", questionId);
      }

      switch (sortBy) {
        case "recent":
          query = query.order("created_at", { ascending: false });
          break;
        case "popular":
          query = query.order("likes_count", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        this.logger.error("Forum posts query error:", error);
        throw error;
      }

      type SupabaseForumPost = Array<{
        id: number;
        title: string;
        content: string;
        author_id: string;
        category: string;
        views_count: number;
        likes_count: number;
        created_at: string;
        updated_at: string;
        author?: ProfileAuthorEmbed;
        comments_count?: Array<{ count: number }>;
        question?: { title: string; description: string };
      }>;

      const typedData = data as SupabaseForumPost;
      const rows = typedData || [];
      const authorMap = await this.fetchAuthorsMap(
        rows
          .map((p) => (p as { author_id?: string }).author_id)
          .filter(Boolean) as string[]
      );

      return rows.map((post: ForumPostRaw) => ({
        ...post,
        author: this.mergeAuthorForResponse(
          (post as { author_id?: string }).author_id,
          post.author,
          authorMap
        ),
        comments_count: post.comments_count?.[0]?.count || 0,
      })) as ForumPostWithAuthor[];
    } catch (error) {
      this.logger.error("getPosts error:", error);
      throw error;
    }
  }

  async getPostById(id: number): Promise<ForumPostDetail> {
    const client = this.supabase.getClient();

    const { error: rpcError } = await client.rpc("increment_views", {
      post_id: id,
    });

    if (rpcError) {
      this.logger.warn(
        `increment_views RPC unavailable or failed for post ${id}: ${rpcError.message}`
      );
      const { data: raw } = await client
        .from("forum_posts")
        .select("views_count")
        .eq("id", id)
        .maybeSingle();
      const cur = raw as { views_count?: number | null } | null;
      if (cur) {
        const nextViews = (cur.views_count ?? 0) + 1;
        await client
          .from("forum_posts")
          .update({ views_count: nextViews })
          .eq("id", id);
      }
    }

    const result = await client
      .from("forum_posts")
      .select(
        `
        *,
        author:profiles!forum_posts_author_id_fkey(username, avatar_url),
        question:questions(title, description),
        comments_count:forum_comments(count)
      `
      )
      .eq("id", id)
      .single();

    if (result.error) throw result.error;

    const row = result.data as ForumPostRaw & {
      comments_count?: Array<{ count: number }>;
    };

    const comments_count = row.comments_count?.[0]?.count ?? 0;

    const aid = (row as { author_id?: string }).author_id;
    const authorMap = await this.fetchAuthorsMap(aid ? [aid] : []);

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      author_id: row.author_id,
      category: row.category,
      views_count: row.views_count,
      likes_count: row.likes_count,
      comments_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      question_id: (row as { question_id?: number }).question_id,
      question: row.question,
      author: this.mergeAuthorForResponse(aid, row.author, authorMap),
      comments: [],
    };
  }

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    authorId: string
  ): Promise<ForumPost> {
    const result = await this.supabase
      .getClient()
      .from("forum_posts")
      .update(updatePostDto)
      .eq("id", id)
      .eq("author_id", authorId)
      .select("*")
      .single();

    if (result.error) throw result.error;
    return result.data as ForumPost;
  }

  async deletePost(
    id: number,
    authorId: string
  ): Promise<{ success: boolean }> {
    const { error } = await this.supabase
      .getClient()
      .from("forum_posts")
      .delete()
      .eq("id", id)
      .eq("author_id", authorId);

    if (error) throw error;
    return { success: true };
  }

  async createComment(
    createCommentDto: CreateCommentDto,
    authorId: string
  ): Promise<ForumComment> {
    const result = await this.supabase
      .getClient()
      .from("forum_comments")
      .insert({
        post_id: createCommentDto.post_id,
        content: createCommentDto.content,
        author_id: authorId,
      })
      .select(
        `
        *,
        author:profiles!forum_comments_author_id_fkey(username, avatar_url)
      `
      )
      .single();

    if (result.error) throw result.error;
    const row = result.data as ForumComment & { author?: ProfileAuthorEmbed };
    const cid = row.author_id;
    const authorMap = await this.fetchAuthorsMap(cid ? [cid] : []);
    return {
      ...row,
      author: this.mergeAuthorForResponse(cid, row.author, authorMap),
    } as ForumComment;
  }

  async getCommentsByPostId(postId: number): Promise<ForumComment[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from("forum_comments")
      .select(
        `
        *,
        author:profiles!forum_comments_author_id_fkey(username, avatar_url)
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const rows = (data || []) as Array<
      ForumComment & { author?: ProfileAuthorEmbed }
    >;
    const authorMap = await this.fetchAuthorsMap(
      rows.map((c) => c.author_id).filter(Boolean)
    );
    return rows.map((c) => ({
      ...c,
      author: this.mergeAuthorForResponse(c.author_id, c.author, authorMap),
    })) as ForumComment[];
  }

  async toggleLike(
    postId: number,
    userId: string
  ): Promise<{ liked: boolean }> {
    // Check if user already liked this post
    const result = await this.supabase
      .getClient()
      .from("forum_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (result.data) {
      // Unlike
      await this.supabase
        .getClient()
        .from("forum_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      // Decrement likes count
      await this.supabase
        .getClient()
        .rpc("decrement_likes", { post_id: postId });

      return { liked: false };
    } else {
      // Like
      await this.supabase
        .getClient()
        .from("forum_likes")
        .insert({ post_id: postId, user_id: userId });

      // Increment likes count
      await this.supabase
        .getClient()
        .rpc("increment_likes", { post_id: postId });

      return { liked: true };
    }
  }

  async getLikeStatus(
    postId: number,
    userId: string
  ): Promise<{ liked: boolean }> {
    const result = await this.supabase
      .getClient()
      .from("forum_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    return { liked: !!result.data };
  }

  async deleteComment(
    commentId: number,
    userId: string
  ): Promise<{ success: boolean }> {
    // 댓글 작성자 확인
    const { data: comment, error: fetchError } = await this.supabase
      .getClient()
      .from("forum_comments")
      .select("author_id")
      .eq("id", commentId)
      .single();

    if (fetchError) throw new NotFoundException("댓글을 찾을 수 없습니다.");
    if (comment?.author_id !== userId) {
      throw new ForbiddenException("본인이 작성한 댓글만 삭제할 수 있습니다.");
    }

    const { error } = await this.supabase
      .getClient()
      .from("forum_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    return { success: true };
  }

  async checkAdminStatus(userId: string): Promise<{ isAdmin: boolean }> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

      if (error) {
        this.logger.error("Admin status check error:", error);
        return { isAdmin: false };
      }

      const row = data as { is_admin?: boolean } | null;
      return { isAdmin: row?.is_admin || false };
    } catch (error) {
      this.logger.error("checkAdminStatus error:", error);
      return { isAdmin: false };
    }
  }

  async adminDeletePost(
    postId: number,
    adminUserId: string
  ): Promise<{ success: boolean }> {
    // 관리자 권한 확인
    const adminStatus = await this.checkAdminStatus(adminUserId);
    if (!adminStatus.isAdmin) {
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    // 게시글 삭제 (작성자 확인 없이)
    const { error } = await this.supabase
      .getClient()
      .from("forum_posts")
      .delete()
      .eq("id", postId);

    if (error) throw error;
    return { success: true };
  }

  async debugConnection(): Promise<{
    connection?: boolean;
    tableQuery?: { data: unknown; error: unknown };
    basicQuery?: { data: unknown; error: unknown };
    error?: string;
  }> {
    try {
      this.logger.debug("=== Forum Debug Connection Start ===");

      // Test basic connection
      const client = this.supabase.getClient();
      this.logger.debug(`Supabase client: ${!!client}`);

      // Test simple query
      const { data: tableData, error: tableError } = await client
        .from("forum_posts")
        .select("count")
        .limit(1);

      this.logger.debug(
        `Table query result: ${JSON.stringify({ data: tableData, error: tableError })}`
      );

      // Test with specific columns
      const { data: basicData, error: basicError } = await client
        .from("forum_posts")
        .select("id, title, created_at")
        .limit(1);

      this.logger.debug(
        `Basic columns result: ${JSON.stringify({ data: basicData, error: basicError })}`
      );

      this.logger.debug("=== Forum Debug Connection End ===");

      return {
        connection: !!client,
        tableQuery: { data: tableData, error: tableError },
        basicQuery: { data: basicData, error: basicError },
      };
    } catch (error) {
      this.logger.error("Debug connection error:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAvailableBoards(): Promise<ForumBoardItem[]> {
    try {
      // 서비스 중인 문제 = 문제별 게시판 (is_active 기준)
      const { data: questions, error } = await this.supabase
        .getClient()
        .from("questions")
        .select("id, title, description, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false });

      if (error) {
        this.logger.error("Questions query error:", error);
        throw error;
      }

      // 전체 포럼을 첫 번째로, 그 다음 문제별 게시판들
      const boards = [
        {
          id: null,
          name: "전체 포럼",
          type: "general",
          description: "모든 주제에 대해 자유롭게 토론하세요",
          published_at: null,
        },
        ...(questions || []).map(
          (question: {
            id: number;
            title: string;
            description: string;
            published_at: string;
          }) => ({
            id: question.id,
            name: question.title,
            type: "question" as const,
            description: question.description,
            published_at: question.published_at,
          })
        ),
      ];

      return boards as ForumBoardItem[];
    } catch (error) {
      this.logger.error("getAvailableBoards error:", error);
      throw error;
    }
  }
}
