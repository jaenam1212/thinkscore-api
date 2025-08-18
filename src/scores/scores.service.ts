import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateScoreDto } from '../common/dto/scores.dto';

interface Score {
  id: number;
  answer_id: number;
  score: number;
  reason?: string;
  created_at: string;
  answers?: {
    id: number;
    user_id: string;
    question_id: number;
    content: string;
    created_at: string;
    questions?: {
      id: number;
      prompt: string;
      is_active: boolean;
      created_at: string;
    };
    profiles?: {
      id: string;
      display_name?: string;
      created_at: string;
    };
  };
}

@Injectable()
export class ScoresService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getAnswerScores(answerId: number): Promise<Score[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scores')
      .select('*')
      .eq('answer_id', answerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Score[]) || [];
  }

  async getUserScores(userId: string): Promise<Score[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scores')
      .select(`
        *,
        answers!inner(
          user_id,
          content,
          questions(prompt)
        )
      `)
      .eq('answers.user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Score[]) || [];
  }

  async getScore(id: number): Promise<Score> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scores')
      .select(`
        *,
        answers(
          *,
          questions(*),
          profiles(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Score;
  }

  async createScore(scoreData: CreateScoreDto): Promise<Score> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scores')
      .insert(scoreData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Score;
  }
}