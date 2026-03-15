export interface Answer {
  id: number;
  user_id: string;
  question_id: number;
  content: string;
  created_at: string;
  questions?: {
    id: number;
    content: string;
    evaluation_criteria?: string[];
    is_active: boolean;
    created_at: string;
  };
  profiles?: {
    id: string;
    display_name?: string;
    created_at: string;
  };
  scores?: Array<{
    id: number;
    answer_id: number;
    score: number;
    reason?: string;
    created_at: string;
  }>;
}

export interface Question {
  id: number;
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  evaluation_criteria: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileData {
  display_name?: string;
  email?: string;
  username?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  access_token: string;
}

export interface SessionData {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: {
      id: string;
      email: string;
    };
  } | null;
}

export interface ForumPost {
  id: number;
  title: string;
  content: string;
  author_id: string;
  category: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author: {
    username: string;
    avatar_url?: string;
  };
}

export interface ForumBoard {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface ForumComment {
  id: number;
  post_id: number;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  author: {
    username: string;
    avatar_url?: string;
  };
}

export interface Score {
  id: number;
  answer_id: number;
  score: number;
  reason?: string;
  criteria_scores?: Record<string, number>;
  created_at: string;
  scorer_id?: string;
  is_ai_score: boolean;
}

export interface ForumPostWithAuthor extends ForumPost {
  comments_count: number;
  question?: {
    title: string;
    description: string;
  };
}

export interface ForumPostRaw {
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

export interface ForumPostDetail {
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
  author: {
    username: string;
    avatar_url: string | null;
  };
  comments: ForumComment[];
}

export interface ForumBoardItem {
  id: number | null;
  name: string;
  type: "general" | "question";
  description: string;
  published_at: string | null;
}
