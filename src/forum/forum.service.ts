import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
} from "../common/dto/forum.dto";

@Injectable()
export class ForumService {
  constructor(private supabase: SupabaseService) {}

  async createPost(createPostDto: CreatePostDto, authorId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("forum_posts")
      .insert({
        title: createPostDto.title,
        content: createPostDto.content,
        author_id: authorId,
        category: createPostDto.category || "free",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async getPosts(
    category?: string,
    sortBy: "recent" | "popular" | "all" = "all"
  ) {
    let query = this.supabase.getClient().from("forum_posts").select(`
        *,
        author:profiles!forum_posts_author_id_fkey(username, avatar_url),
        comments_count:forum_comments(count)
      `);

    if (category && category !== "all") {
      query = query.eq("category", category);
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
    if (error) throw error;

    return data?.map((post) => {
      return {
        ...post,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        comments_count: post.comments_count?.[0]?.count || 0,
      };
    });
  }

  async getPostById(id: number) {
    // Increment view count
    await this.supabase
      .getClient()
      .from("forum_posts")
      .update({
        views_count: this.supabase
          .getClient()
          .rpc("increment_views", { post_id: id }),
      })
      .eq("id", id);

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
        .from("forum_posts")
        .update({
          likes_count: this.supabase
            .getClient()
            .rpc("decrement_likes", { post_id: postId }),
        })
        .eq("id", postId);

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
        .from("forum_posts")
        .update({
          likes_count: this.supabase
            .getClient()
            .rpc("increment_likes", { post_id: postId }),
        })
        .eq("id", postId);

      return { liked: true };
    }
  }
}
