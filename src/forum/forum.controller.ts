import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ForumService } from "./forum.service";
import {
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
} from "../common/dto/forum.dto";

interface JwtRequest extends ExpressRequest {
  user: {
    userId: string;
    id: string;
  };
}

@Controller("forum")
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @UseGuards(JwtAuthGuard)
  @Post("posts")
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @Request() req: JwtRequest
  ): Promise<any> {
    return this.forumService.createPost(createPostDto, req.user.id);
  }

  @Get("posts")
  async getPosts(
    @Query("question_id") questionId?: string,
    @Query("sort") sortBy?: "recent" | "popular" | "all"
  ): Promise<any> {
    const questionIdNumber = questionId ? parseInt(questionId, 10) : undefined;
    return this.forumService.getPosts(questionIdNumber, sortBy);
  }

  @Get("posts/:id")
  async getPost(@Param("id") id: string): Promise<any> {
    return this.forumService.getPostById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("posts/:id")
  async updatePost(
    @Param("id") id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: JwtRequest
  ): Promise<any> {
    return this.forumService.updatePost(+id, updatePostDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("posts/:id")
  async deletePost(
    @Param("id") id: string,
    @Request() req: JwtRequest
  ): Promise<{ success: boolean }> {
    return this.forumService.deletePost(+id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("comments")
  async createComment(
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: JwtRequest
  ): Promise<any> {
    return this.forumService.createComment(createCommentDto, req.user.id);
  }

  @Get("posts/:id/comments")
  async getComments(@Param("id") id: string): Promise<any> {
    return this.forumService.getCommentsByPostId(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("comments/:id")
  async deleteComment(
    @Param("id") id: string,
    @Request() req: JwtRequest
  ): Promise<{ success: boolean }> {
    return this.forumService.deleteComment(+id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:id/like")
  async toggleLike(
    @Param("id") id: string,
    @Request() req: JwtRequest
  ): Promise<{ liked: boolean }> {
    return this.forumService.toggleLike(+id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("posts/:id/like-status")
  async getLikeStatus(
    @Param("id") id: string,
    @Request() req: JwtRequest
  ): Promise<{ liked: boolean }> {
    return await this.forumService.getLikeStatus(+id, req.user.id);
  }

  @Get("debug")
  async debugConnection(): Promise<any> {
    return this.forumService.debugConnection();
  }

  @Get("boards")
  async getAvailableBoards(): Promise<any> {
    return this.forumService.getAvailableBoards();
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/check")
  checkAdminStatus(): { isAdmin: boolean } {
    return this.forumService.checkAdminStatus();
  }
}
