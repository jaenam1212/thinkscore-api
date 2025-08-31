import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
} from "../common/dto/forum.dto";

interface ForumPostWithAuthor {
  id: number;
  title: string;
  content: string;
  author_id: string;
  category: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url: string | null;
  };
  comments_count: number;
}

interface ForumPostRaw {
  id: number;
  title: string;
  content: string;
  author_id: string;
  category: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url: string | null;
  };
  comments_count?: Array<{ count: number }>;
  question?: {
    title: string;
    description: string;
  };
}

interface ForumPost {
  id: number;
  title: string;
  content: string;
  author_id: string;
  category: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  updated_at: string;
  question_id?: number;
}

interface ForumComment {
  id: number;
  post_id: number;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url: string | null;
  };
}

interface ForumPostDetail extends ForumPost {
  author: {
    username: string;
    avatar_url: string | null;
  };
  comments: ForumComment[];
}

interface Board {
  id: number | null;
  name: string;
  type: "general" | "question";
  description: string;
  published_at: string | null;
}

@Injectable()
export class ForumService {
  constructor(private supabase: SupabaseService) {}

  async createPost(
    createPostDto: CreatePostDto,
    authorId: string
  ): Promise<ForumPost> {
    // question_id가 제공된 경우, 해당 문제가 포럼이 활성화된 문제인지 확인
    if (createPostDto.question_id) {
      const { data: questionData, error: questionError } = await this.supabase
        .getClient()
        .from("questions")
        .select("id, forum_enabled")
        .eq("id", createPostDto.question_id)
        .eq("forum_enabled", true)
        .single();

      if (questionError || !questionData) {
        throw new Error("해당 문제의 게시판이 활성화되지 않았습니다.");
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

      // questionId로 필터링
      if (questionId) {
        query = query.eq("question_id", questionId);
      } else {
        // questionId가 없으면 전체 포럼 (question_id가 null인 것만)
        query = query.is("question_id", null);
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
        console.error("Forum posts query error:", error);
        throw error;
      }

      console.log("Forum posts data:", data);

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
        author?: { username: string; avatar_url: string | null };
        comments_count?: Array<{ count: number }>;
        question?: { title: string; description: string };
      }>;

      const typedData = data as SupabaseForumPost;
      return (typedData?.map((post: ForumPostRaw) => ({
        ...post,
        author: post.author || { username: "익명", avatar_url: null },
        comments_count: post.comments_count?.[0]?.count || 0,
      })) || []) as ForumPostWithAuthor[];
    } catch (error) {
      console.error("getPosts error:", error);
      throw error;
    }
  }

  async getPostById(id: number): Promise<ForumPostDetail> {
    // Increment view count using RPC function
    await this.supabase.getClient().rpc("increment_views", { post_id: id });

    const result = await this.supabase
      .getClient()
      .from("forum_posts")
      .select(
        `
        *,
        author:profiles!forum_posts_author_id_fkey(username, avatar_url),
        comments:forum_comments(
          *,
          author:profiles!forum_comments_author_id_fkey(username, avatar_url)
        )
      `
      )
      .eq("id", id)
      .single();

    if (result.error) throw result.error;
    return result.data as ForumPostDetail;
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
    return result.data as ForumComment;
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
    return data as ForumComment[];
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

    if (fetchError) throw new Error("댓글을 찾을 수 없습니다.");
    if (comment?.author_id !== userId) {
      throw new Error("본인이 작성한 댓글만 삭제할 수 있습니다.");
    }

    const { error } = await this.supabase
      .getClient()
      .from("forum_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    return { success: true };
  }

  checkAdminStatus(): { isAdmin: boolean } {
    // 간단한 관리자 체크 로직 (실제로는 데이터베이스에서 확인)
    return { isAdmin: false };
  }

  async debugConnection(): Promise<{
    connection?: boolean;
    tableQuery?: { data: unknown; error: unknown };
    basicQuery?: { data: unknown; error: unknown };
    error?: string;
  }> {
    try {
      console.log("=== Forum Debug Connection Start ===");

      // Test basic connection
      const client = this.supabase.getClient();
      console.log("Supabase client:", !!client);

      // Test simple query
      const { data: tableData, error: tableError } = await client
        .from("forum_posts")
        .select("count")
        .limit(1);

      console.log("Table query result:", {
        data: tableData,
        error: tableError,
      });

      // Test with specific columns
      const { data: basicData, error: basicError } = await client
        .from("forum_posts")
        .select("id, title, created_at")
        .limit(1);

      console.log("Basic columns result:", {
        data: basicData,
        error: basicError,
      });

      console.log("=== Forum Debug Connection End ===");

      return {
        connection: !!client,
        tableQuery: { data: tableData, error: tableError },
        basicQuery: { data: basicData, error: basicError },
      };
    } catch (error) {
      console.error("Debug connection error:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAvailableBoards(): Promise<Board[]> {
    try {
      // 포럼이 활성화된 문제들 조회
      const { data: questions, error } = await this.supabase
        .getClient()
        .from("questions")
        .select("id, title, description, published_at")
        .eq("forum_enabled", true)
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Questions query error:", error);
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

      return boards as Board[];
    } catch (error) {
      console.error("getAvailableBoards error:", error);
      throw error;
    }
  }
}
