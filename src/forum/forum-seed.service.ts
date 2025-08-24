import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ForumSeedService {
  constructor(private supabase: SupabaseService) {}

  async seedForumData(): Promise<{ success: boolean; message: string }> {
    try {
      // 먼저 기본 프로필 생성 (시드 데이터용)
      const { error: profileError } = await this.supabase
        .getClient()
        .from("profiles")
        .upsert(
          {
            id: "11111111-1111-1111-1111-111111111111",
            email: "seed@example.com",
            display_name: "관리자",
          },
          {
            onConflict: "id",
            ignoreDuplicates: true,
          }
        )
        .select()
        .single();

      if (profileError && profileError.code !== "23505") {
        console.error("Profile creation error:", profileError);
      }

      // 포럼 게시글 시드 데이터
      const posts = [
        {
          title: "시뮬레이션 가설에 대한 여러분의 생각은?",
          content: `최근에 시뮬레이션 가설 문제를 풀어봤는데, 정말 흥미로운 주제인 것 같아요.

혹시 우리가 살고 있는 현실이 정말 시뮬레이션일 가능성에 대해 어떻게 생각하시나요?

저는 개인적으로 이 가설이 완전히 반박하기 어렵다는 점에서 철학적으로 매우 의미있다고 봅니다. 하지만 실용적인 관점에서는 큰 의미가 없을 수도 있고요.

여러분의 의견을 듣고 싶습니다!`,
          author_id: "11111111-1111-1111-1111-111111111111",
          category: "philosophy",
          views_count: 127,
          likes_count: 23,
          is_pinned: true,
        },
        {
          title: "AI 평가 시스템이 너무 까다로운 것 같아요",
          content: `안녕하세요! 방금 답변을 제출했는데 생각보다 점수가 낮게 나와서 당황스럽네요 😅

제 답변이 그렇게 나쁘지 않다고 생각했는데, AI가 보는 관점이 사람과는 다른 것 같아요.

혹시 비슷한 경험 있으신 분 계신가요? 어떤 부분을 더 신경써야 할까요?`,
          author_id: "11111111-1111-1111-1111-111111111111",
          category: "feedback",
          views_count: 89,
          likes_count: 15,
        },
        {
          title: "트롤리 딜레마 - 당신의 선택은?",
          content: `클래식한 트롤리 딜레마 문제입니다.

**상황**: 통제를 잃은 트롤리가 5명을 향해 달려가고 있습니다. 당신은 레버를 당겨서 트롤리를 다른 선로로 돌릴 수 있지만, 그 선로에는 1명이 있습니다.

**질문**: 레버를 당기시겠습니까?

- ✅ 당긴다 (1명을 희생하여 5명을 구한다)
- ❌ 당기지 않는다 (직접적인 행동을 피한다)

여러분의 선택과 그 이유를 댓글로 남겨주세요!`,
          author_id: "11111111-1111-1111-1111-111111111111",
          category: "ethics",
          views_count: 234,
          likes_count: 41,
        },
        {
          title: "논리 퍼즐 공유 - 한번 풀어보세요!",
          content: `재미있는 논리 퍼즐을 하나 가져왔습니다 🧩

**문제**: 
세 명의 현명한 사람 A, B, C가 있습니다. 각자 모자를 쓰고 있는데, 모자는 빨간색 또는 파란색입니다. 각자는 다른 두 사람의 모자 색깔은 볼 수 있지만 자신의 모자는 볼 수 없습니다.

빨간 모자가 최소 1개는 있다는 것을 모두가 알고 있습니다.

A가 "내 모자 색깔을 모르겠다"고 했습니다.
B도 "내 모자 색깔을 모르겠다"고 했습니다.
그러자 C가 "내 모자는 빨간색이다!"라고 말했습니다.

C는 어떻게 알 수 있었을까요? 🤔`,
          author_id: "11111111-1111-1111-1111-111111111111",
          category: "puzzle",
          views_count: 156,
          likes_count: 28,
        },
        {
          title: "첫 100점을 받았습니다! 🎉",
          content: `드디어 첫 100점을 받았습니다! 너무 기뻐서 공유하고 싶었어요 ✨

처음에는 70점대에서 머물러있었는데, 몇 가지 팁을 적용한 후 점수가 많이 올랐습니다:

1. **구체적인 예시 들기**: 추상적인 설명보다 구체적인 상황을 예로 들면 좋더라고요
2. **반대 의견도 고려하기**: 내 주장에 대한 반박도 함께 언급하고 답변하기
3. **논리적 구조**: 서론-본론-결론 형식으로 체계적으로 작성

혹시 비슷하게 고민하시는 분들에게 도움이 되길 바라요! 💪`,
          author_id: "11111111-1111-1111-1111-111111111111",
          category: "tips",
          views_count: 203,
          likes_count: 67,
        },
      ];

      // 게시글 삽입
      const { error: postsError } = await this.supabase
        .getClient()
        .from("forum_posts")
        .upsert(posts, { ignoreDuplicates: true })
        .select("id, title");

      if (postsError) {
        console.error("Posts insertion error:", postsError);
        return {
          success: false,
          message: `Posts insertion failed: ${postsError.message}`,
        };
      }

      // 댓글 시드 데이터 (게시글이 삽입된 후)
      const comments = [
        {
          post_id: 1,
          content:
            "정말 흥미로운 주제네요! 저는 시뮬레이션 가설이 현실적으로는 증명 불가능하지만, 그 자체로도 의미있는 사고실험이라고 생각해요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
        {
          post_id: 1,
          content:
            "닉 보스트롬의 논문을 읽어보시는 것을 추천합니다. 수학적으로도 꽤 탄탄한 논증이에요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
        {
          post_id: 2,
          content:
            "저도 비슷한 경험이 있어요! AI는 논리적 일관성을 많이 보는 것 같더라구요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
        {
          post_id: 3,
          content:
            "저는 당기지 않을 것 같아요. 적극적으로 누군가를 해치는 것과 소극적으로 방관하는 것은 도덕적으로 다르다고 생각해서요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
        {
          post_id: 3,
          content:
            "반대로 저는 당길 것 같습니다. 결과적으로 더 많은 생명을 구할 수 있다면 그것이 옳다고 봐요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
        {
          post_id: 5,
          content:
            "축하합니다! 정말 유용한 팁이네요. 특히 반대 의견 고려하기는 생각해보지 못했는데 시도해봐야겠어요.",
          author_id: "11111111-1111-1111-1111-111111111111",
        },
      ];

      // 댓글 삽입
      const { error: commentsError } = await this.supabase
        .getClient()
        .from("forum_comments")
        .upsert(comments, { ignoreDuplicates: true });

      if (commentsError) {
        console.error("Comments insertion error:", commentsError);
        return {
          success: false,
          message: `Comments insertion failed: ${commentsError.message}`,
        };
      }

      return {
        success: true,
        message: `Successfully seeded ${posts.length} posts and ${comments.length} comments`,
      };
    } catch (error) {
      console.error("Seed operation error:", error);
      return {
        success: false,
        message: `Seed operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
