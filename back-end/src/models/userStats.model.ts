import { Resource } from 'idea-toolbox';

export interface UserStats {
  topicsAsSubject: number;
  questionsAsked: number;
  questionsAnswered: number;
  interventions: number;
  appreciations: number;
  heartsReceived: number;
  upvotesReceived: number;
  applauseReceived: number;
}

export interface UserTopicSummary {
  topicId: string;
  topic: any;
  isSpeaker: boolean;
  askedCount: number;
  answeredCount: number;
  interventionsCount: number;
  appreciationsCount: number;
}

export class UserStatsRecord extends Resource {
  userId: string;
  stats: UserStats;
  userTopics: UserTopicSummary[];
  updatedAt: string;

  load(x: any): void {
    super.load(x);
    this.userId = this.clean(x.userId, String)?.toLowerCase();
    this.stats = {
      topicsAsSubject: this.clean(x.stats?.topicsAsSubject, Number) || 0,
      questionsAsked: this.clean(x.stats?.questionsAsked, Number) || 0,
      questionsAnswered: this.clean(x.stats?.questionsAnswered, Number) || 0,
      interventions: this.clean(x.stats?.interventions, Number) || 0,
      appreciations: this.clean(x.stats?.appreciations, Number) || 0,
      heartsReceived: this.clean(x.stats?.heartsReceived, Number) || 0,
      upvotesReceived: this.clean(x.stats?.upvotesReceived, Number) || 0,
      applauseReceived: this.clean(x.stats?.applauseReceived, Number) || 0
    };
    this.userTopics = Array.isArray(x.userTopics) ? x.userTopics : [];
    this.updatedAt = this.clean(x.updatedAt, String) || new Date().toISOString();
  }
}
