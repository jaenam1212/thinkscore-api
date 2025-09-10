import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface RankingUser {
  id: string;
  display_name: string;
  total_score: number;
  average_score: number;
  answer_count: number;
  rank_position: number;
}

export interface QuestionRankingUser {
  id: string;
  display_name: string;
  question_score: number;
  question_answer_count: number;
  total_score: number;
  rank_position: number;
}

export interface UserRank {
  rank_position: number;
  total_users: number;
  user_score: number;
  percentile: number;
}

export interface RankingStats {
  total_users: number;
  total_answers: number;
  average_score: number;
  top_scorer_name: string;
  top_score: number;
}

@Injectable()
export class RankingsService {
  constructor(private supabase: SupabaseService) {}

  async getOverallRankings(limit: number = 50): Promise<RankingUser[]> {
    try {
      // scores 테이블에서 answer_id와 점수를 가져온 후, answers 테이블과 조인해서 user_id 획득
      const { data: scoresData, error: scoresError } = await this.supabase
        .getClient()
        .from("scores").select(`
          answer_id,
          score,
          answers!inner(user_id)
        `);

      if (scoresError) {
        console.error("Scores query error:", scoresError);
        throw scoresError;
      }

      // profiles 테이블에서 사용자 정보 가져오기
      const { data: profilesData, error: profilesError } = await this.supabase
        .getClient()
        .from("profiles")
        .select("id, display_name");

      if (profilesError) {
        console.error("Profiles query error:", profilesError);
        throw profilesError;
      }

      console.log("Scores data length:", scoresData?.length);
      console.log("Profiles data length:", profilesData?.length);

      type ScoreData = Array<{
        answer_id: number;
        score: number;
        answers: { user_id: string };
      }>;
      type ProfileData = Array<{
        id: string;
        display_name: string;
      }>;

      const typedScores = scoresData as unknown as ScoreData;
      const typedProfiles = profilesData as ProfileData;

      // 프로필 데이터를 Map으로 변환
      const profilesMap = new Map(
        typedProfiles.map((profile) => [profile.id, profile])
      );

      // 사용자별로 점수 집계
      const userScores = new Map<
        string,
        {
          total_score: number;
          answer_count: number;
        }
      >();

      typedScores.forEach((score) => {
        const userId = score.answers.user_id;
        const existing = userScores.get(userId);
        if (existing) {
          existing.total_score += score.score;
          existing.answer_count += 1;
        } else {
          userScores.set(userId, {
            total_score: score.score,
            answer_count: 1,
          });
        }
      });

      // 랭킹 데이터 생성
      const rankings = Array.from(userScores.entries())
        .map(([userId, userData]) => {
          const profile = profilesMap.get(userId);
          return {
            id: userId,
            display_name:
              profile?.display_name || (profile ? "비공개" : "비회원"),
            total_score: userData.total_score,
            average_score: userData.total_score / userData.answer_count,
            answer_count: userData.answer_count,
            rank_position: 0,
          };
        })
        .sort((a, b) => b.average_score - a.average_score)
        .slice(0, limit)
        .map((user, index) => ({
          ...user,
          rank_position: index + 1,
        }));

      return rankings;
    } catch (error) {
      console.error("getOverallRankings error:", error);
      throw error;
    }
  }

  async getQuestionRankings(
    questionId: number,
    limit: number = 50
  ): Promise<QuestionRankingUser[]> {
    // 특정 문제의 점수 데이터를 answers 테이블과 조인해서 가져오기
    const { data: scoresData, error: scoresError } = await this.supabase
      .getClient()
      .from("scores")
      .select(
        `
        answer_id,
        score,
        answers!inner(user_id, question_id)
      `
      )
      .eq("answers.question_id", questionId)
      .order("score", { ascending: false })
      .limit(limit);

    if (scoresError) throw scoresError;

    type ScoreData = Array<{
      answer_id: number;
      score: number;
      answers: { user_id: string; question_id: number };
    }>;

    const typedScores = scoresData as unknown as ScoreData;

    // 해당 사용자들의 프로필 정보 가져오기
    const userIds = typedScores.map((s) => s.answers.user_id);

    const { data: profilesData, error: profilesError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    type ProfileData = Array<{
      id: string;
      display_name: string;
    }>;
    const typedProfiles = profilesData as ProfileData;

    // 프로필 데이터를 Map으로 변환
    const profilesMap = new Map(
      typedProfiles.map((profile) => [profile.id, profile])
    );

    return typedScores.map((score, index) => {
      const profile = profilesMap.get(score.answers.user_id);
      return {
        id: score.answers.user_id,
        display_name: profile?.display_name || (profile ? "비공개" : "비회원"),
        question_score: score.score,
        question_answer_count: 1,
        total_score: 0,
        rank_position: index + 1,
      };
    });
  }

  async getMyOverallRank(userId: string): Promise<UserRank> {
    // 내 점수 조회
    const { data: myProfile, error: profileError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("total_score")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    // 나보다 높은 점수를 가진 사용자 수 조회
    const { count: higherCount, error: countError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("*", { count: "exact" })
      .gt("total_score", (myProfile as { total_score: number }).total_score);

    if (countError) throw countError;

    // 전체 사용자 수 조회
    const { count: totalCount, error: totalError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("*", { count: "exact" });

    if (totalError) throw totalError;

    const rankPosition = (higherCount || 0) + 1;
    const totalUsers = totalCount || 1;
    const percentile = ((totalUsers - rankPosition) / totalUsers) * 100;

    return {
      rank_position: rankPosition,
      total_users: totalUsers,
      user_score: (myProfile as { total_score: number }).total_score,
      percentile: Math.round(percentile * 100) / 100,
    };
  }

  async getMyQuestionRank(
    userId: string,
    questionId: number
  ): Promise<UserRank> {
    // 내 점수 조회
    const { data: myScore, error: scoreError } = await this.supabase
      .getClient()
      .from("scores")
      .select("score")
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .single();

    if (scoreError) throw scoreError;

    // 이 문제에서 나보다 높은 점수를 가진 사용자 수 조회
    const { count: higherCount, error: countError } = await this.supabase
      .getClient()
      .from("scores")
      .select("*", { count: "exact" })
      .eq("question_id", questionId)
      .gt("score", (myScore as { score: number }).score);

    if (countError) throw countError;

    // 이 문제에 답변한 전체 사용자 수 조회
    const { count: totalCount, error: totalError } = await this.supabase
      .getClient()
      .from("scores")
      .select("*", { count: "exact" })
      .eq("question_id", questionId);

    if (totalError) throw totalError;

    const rankPosition = (higherCount || 0) + 1;
    const totalUsers = totalCount || 1;
    const percentile = ((totalUsers - rankPosition) / totalUsers) * 100;

    return {
      rank_position: rankPosition,
      total_users: totalUsers,
      user_score: (myScore as { score: number }).score,
      percentile: Math.round(percentile * 100) / 100,
    };
  }

  async getRankingStats(): Promise<RankingStats> {
    // 전체 사용자 수
    const { count: totalUsers, error: usersError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("*", { count: "exact" });

    if (usersError) throw usersError;

    // 전체 답변 수
    const { count: totalAnswers, error: answersError } = await this.supabase
      .getClient()
      .from("answers")
      .select("*", { count: "exact" });

    if (answersError) throw answersError;

    // 평균 점수 계산을 위한 데이터
    const { data: profiles, error: profilesError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("total_score")
      .gt("total_score", 0);

    if (profilesError) throw profilesError;

    // 최고 점수 사용자
    const { data: topScorer, error: topScorerError } = await this.supabase
      .getClient()
      .from("profiles")
      .select("display_name, total_score")
      .order("total_score", { ascending: false })
      .limit(1)
      .single();

    if (topScorerError) throw topScorerError;

    const typedProfiles = profiles as Array<{ total_score: number }>;
    const typedTopScorer = topScorer as {
      display_name: string;
      total_score: number;
    };

    const averageScore =
      typedProfiles.length > 0
        ? typedProfiles.reduce((sum, profile) => sum + profile.total_score, 0) /
          typedProfiles.length
        : 0;

    return {
      total_users: totalUsers || 0,
      total_answers: totalAnswers || 0,
      average_score: Math.round(averageScore * 100) / 100,
      top_scorer_name: typedTopScorer.display_name || "비공개",
      top_score: typedTopScorer.total_score,
    };
  }
}
