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
}

@Injectable()
export class ForumService {
  constructor(private supabase: SupabaseService) {}

  async createPost(createPostDto: CreatePostDto, authorId: string) {
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

    const { data, error } = await this.supabase
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

    if (error) throw error;
    return data;
  }

  async getPosts(
    questionId?: number,
    sortBy: "recent" | "popular" | "all" = "all"
  ) {
    try {
      let query = this.supabase.getClient().from("forum_posts").select(`
        *,
        author:profiles!forum_posts_author_id_fkey(username, avatar_url),
        question:questions(title, description)
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

      return (
        data?.map((post: ForumPostWithAuthor) => ({
          ...post,
          author: post.author || { username: "익명", avatar_url: null },
          comments_count: 0,
        })) || []
      );
    } catch (error) {
      console.error("getPosts error:", error);
      throw error;
    }
  }

  async getPostById(id: number) {
    // Increment view count using RPC function
    await this.supabase.getClient().rpc("increment_views", { post_id: id });

    const { data, error } = await this.supabase
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

    if (error) throw error;
    return data;
  }

  async updatePost(id: number, updatePostDto: UpdatePostDto, authorId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("forum_posts")
      .update(updatePostDto)
      .eq("id", id)
      .eq("author_id", authorId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async deletePost(id: number, authorId: string) {
    const { error } = await this.supabase
      .getClient()
      .from("forum_posts")
      .delete()
      .eq("id", id)
      .eq("author_id", authorId);

    if (error) throw error;
    return { success: true };
  }

  async createComment(createCommentDto: CreateCommentDto, authorId: string) {
    const { data, error } = await this.supabase
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

    if (error) throw error;
    return data;
  }

  async getCommentsByPostId(postId: number) {
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
    return data;
  }

  async toggleLike(postId: number, userId: string) {
    // Check if user already liked this post
    const { data: existingLike } = await this.supabase
      .getClient()
      .from("forum_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
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

  async debugConnection() {
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

  async getAvailableBoards() {
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
        ...(questions || []).map((question) => ({
          id: question.id,
          name: question.title,
          type: "question",
          description: question.description,
          published_at: question.published_at,
        })),
      ];

      return boards;
    } catch (error) {
      console.error("getAvailableBoards error:", error);
      throw error;
    }
  }
}
