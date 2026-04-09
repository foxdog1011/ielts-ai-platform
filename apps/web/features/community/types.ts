// features/community/types.ts
// Domain types for the community question bank feature.

export interface CommunityQuestion {
  readonly id: string;
  readonly type: 'writing' | 'speaking';
  readonly title: string;
  readonly prompt: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly tips?: string;
  readonly authorName: string;
  readonly authorId: string;
  readonly practiceCount: number;
  readonly totalScore: number;
  readonly avgScore: number | null;
  readonly createdAt: number;
}

export type QuestionType = 'all' | 'writing' | 'speaking';
export type SortOption = 'popular' | 'newest' | 'highest';

export interface CommunityListParams {
  readonly type?: 'writing' | 'speaking';
  readonly sort?: SortOption;
  readonly page?: number;
}

export interface CreateQuestionInput {
  readonly type: 'writing' | 'speaking';
  readonly title: string;
  readonly prompt: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly tips?: string;
  readonly authorName: string;
}

export interface CommunityApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly meta?: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
  };
}
