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
  ) {
    return this.forumService.createPost(createPostDto, req.user.id);
  }

  @Get("posts")
  async getPosts(
    @Query("category") category?: string,
    @Query("sort") sortBy?: "recent" | "popular" | "all"
  ) {
    return this.forumService.getPosts(category, sortBy);
  }

  @Get("posts/:id")
  async getPost(@Param("id") id: string) {
    return this.forumService.getPostById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("posts/:id")
  async updatePost(
    @Param("id") id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: JwtRequest
  ) {
    return this.forumService.updatePost(+id, updatePostDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("posts/:id")
  async deletePost(@Param("id") id: string, @Request() req: JwtRequest) {
    return this.forumService.deletePost(+id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("comments")
  async createComment(
    @Body() createCommentDto: CreateCommentDto,
    @Request() req: JwtRequest
  ) {
    return this.forumService.createComment(createCommentDto, req.user.id);
  }

  @Get("posts/:id/comments")
  async getComments(@Param("id") id: string) {
    return this.forumService.getCommentsByPostId(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:id/like")
  async toggleLike(@Param("id") id: string, @Request() req: JwtRequest) {
    return this.forumService.toggleLike(+id, req.user.id);
  }
}
