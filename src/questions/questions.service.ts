import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateQuestionDto, UpdateQuestionDto } from '../common/dto/questions.dto';

interface Question {
  id: number;
  prompt: string;
  is_active: boolean;
  created_at: string;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getActiveQuestions(): Promise<Question[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('questions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Question[]) || [];
  }

  async getQuestion(id: number): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }

  async createQuestion(questionData: CreateQuestionDto): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('questions')
      .insert(questionData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }

  async updateQuestion(id: number, updateData: UpdateQuestionDto): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }
}