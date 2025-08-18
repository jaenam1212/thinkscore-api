import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from '../common/dto/answers.dto';

@Controller('answers')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Get('user/:userId')
  async getUserAnswers(@Param('userId') userId: string) {
    return this.answersService.getUserAnswers(userId);
  }

  @Get('question/:questionId')
  async getQuestionAnswers(@Param('questionId') questionId: string) {
    return this.answersService.getQuestionAnswers(parseInt(questionId, 10));
  }

  @Post()
  async createAnswer(@Body() answerData: CreateAnswerDto) {
    return this.answersService.createAnswer(answerData);
  }

  @Get(':id')
  async getAnswer(@Param('id') id: string) {
    return this.answersService.getAnswer(parseInt(id, 10));
  }
}