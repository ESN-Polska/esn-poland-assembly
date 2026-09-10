///
/// IMPORTS
///

import { DynamoDB, ResourceController } from 'idea-aws';

import { User } from '../models/user.model';
import { Topic, TopicTypes } from '../models/topic.model';
import { Question } from '../models/question.model';
import { Message, MessageTypes } from '../models/message.model';
import { UserStats, UserTopicSummary, UserStatsRecord } from '../models/userStats.model';

///
/// CONSTANTS, ENVIRONMENT VARIABLES, HANDLER
///

const DDB_TABLES = {
  usersStats: process.env.DDB_TABLE_usersStats,
  topics: process.env.DDB_TABLE_topics,
  questions: process.env.DDB_TABLE_questions,
  messages: process.env.DDB_TABLE_messages
};
const ddb = new DynamoDB();

export const handler = (ev: any, _: any, cb: any): Promise<void> => new UsersStatsRC(ev, cb).handleRequest();

///
/// RESOURCE CONTROLLER
///

export class UsersStatsRC extends ResourceController {
  galaxyUser: User;

  constructor(event: any, callback: any) {
    super(event, callback);
    this.galaxyUser = new User(event.requestContext?.authorizer?.lambda?.user);
  }

  protected async getResources(): Promise<UserStatsRecord | any> {
    const targetUserId = (this.queryParams.userId || this.galaxyUser.userId).toLowerCase().trim();
    const forceRefresh = this.queryParams.refresh === 'true' || this.queryParams.refresh === true;

    // Check pre-aggregated cache in DynamoDB first if refresh not requested
    if (!forceRefresh && DDB_TABLES.usersStats) {
      try {
        const cached = await ddb.get({
          TableName: DDB_TABLES.usersStats,
          Key: { userId: targetUserId }
        });
        if (cached && cached.stats) {
          return new UserStatsRecord(cached);
        }
      } catch (_) {
        // Fall through to compute if table not yet deployed or fetch failed
      }
    }

    return await UsersStatsRC.aggregateUserStats(targetUserId, this.galaxyUser?.isAdministrator, this.logger);
  }

  /**
   * Aggregate stats and topic activity for a given user across all topics (both active and archived).
   */
  static async aggregateUserStats(
    targetUserId: string,
    isAdmin = false,
    logger?: any
  ): Promise<UserStatsRecord> {
    const cleanId = targetUserId.toLowerCase().trim();

    // 1. Fetch all topics (both active and archived)
    const topicsRaw = (await ddb.scan({ TableName: DDB_TABLES.topics })) || [];
    let topics = topicsRaw.map(t => new Topic(t));
    if (!isAdmin) {
      topics = topics.filter(t => !t.isDraft());
    }

    const activityMap = new Map<string, UserTopicSummary>();
    let topicsAsSubjectCount = 0;

    for (const t of topics) {
      const isSubject = !!(t.subjects && t.subjects.some(s => s.id?.toLowerCase() === cleanId));
      if (isSubject) {
        topicsAsSubjectCount++;
        activityMap.set(t.topicId, {
          topicId: t.topicId,
          topic: t,
          isSpeaker: true,
          askedCount: 0,
          answeredCount: 0,
          interventionsCount: 0,
          appreciationsCount: 0
        });
      }
    }

    let totalQuestionsAsked = 0;
    let totalQuestionsAnswered = 0;
    let totalInterventions = 0;
    let totalAppreciations = 0;
    let totalHeartsReceived = 0;
    let totalUpvotesReceived = 0;
    let totalApplauseReceived = 0;

    // Both active AND archived topics are included!
    const topicsWithContent = topics.filter(
      t => (t.numOfQuestions && t.numOfQuestions > 0) || t.type === TopicTypes.LIVE
    );

    await Promise.all(
      topicsWithContent.map(async t => {
        try {
          if (t.type === TopicTypes.LIVE) {
            const messagesRaw: any[] = (await ddb.query({
              TableName: DDB_TABLES.messages,
              KeyConditionExpression: 'topicId = :topicId',
              ExpressionAttributeValues: { ':topicId': t.topicId }
            })) || [];
            const messages = messagesRaw.map(m => new Message(m));

            let userInterventions = 0;
            let userAppreciations = 0;

            for (const m of messages) {
              if (m.creator?.id?.toLowerCase() === cleanId) {
                if (m.type === MessageTypes.QUESTION) {
                  userInterventions++;
                  totalInterventions++;
                  totalUpvotesReceived += m.numOfUpvotes || 0;
                } else if (m.type === MessageTypes.APPRECIATION) {
                  userAppreciations++;
                  totalAppreciations++;
                  totalHeartsReceived += m.numOfUpvotes || 0;
                }
              }
            }

            if (userInterventions > 0 || userAppreciations > 0) {
              const existing = activityMap.get(t.topicId);
              if (existing) {
                existing.interventionsCount = userInterventions;
                existing.appreciationsCount = userAppreciations;
              } else {
                activityMap.set(t.topicId, {
                  topicId: t.topicId,
                  topic: t,
                  isSpeaker: false,
                  askedCount: 0,
                  answeredCount: 0,
                  interventionsCount: userInterventions,
                  appreciationsCount: userAppreciations
                });
              }
            }
          } else {
            const questionsRaw: any[] = (await ddb.query({
              TableName: DDB_TABLES.questions,
              KeyConditionExpression: 'topicId = :topicId',
              ExpressionAttributeValues: { ':topicId': t.topicId }
            })) || [];
            const questions = questionsRaw.map(q => new Question(q));

            const isSubjectInTopic = t.subjects && t.subjects.some(s => s.id?.toLowerCase() === cleanId);
            let userQuestionsCount = 0;
            let topicAnsweredCount = 0;

            for (const q of questions) {
              const isCreator = q.creator?.id?.toLowerCase() === cleanId;
              if (isCreator) {
                userQuestionsCount++;
                totalQuestionsAsked++;
                totalUpvotesReceived += q.numOfUpvotes || 0;
              }
              if (isSubjectInTopic && q.numOfAnswers && q.numOfAnswers > 0) {
                topicAnsweredCount++;
                totalQuestionsAnswered++;
              }
              if (isSubjectInTopic || isCreator) {
                totalApplauseReceived += q.numOfClaps || 0;
              }
            }

            if (userQuestionsCount > 0 || (isSubjectInTopic && topicAnsweredCount > 0)) {
              const existing = activityMap.get(t.topicId);
              if (existing) {
                existing.askedCount = userQuestionsCount;
                existing.answeredCount = topicAnsweredCount;
              } else {
                activityMap.set(t.topicId, {
                  topicId: t.topicId,
                  topic: t,
                  isSpeaker: isSubjectInTopic,
                  askedCount: userQuestionsCount,
                  answeredCount: topicAnsweredCount,
                  interventionsCount: 0,
                  appreciationsCount: 0
                });
              }
            }
          }
        } catch (_) {
          // Ignore individual topic fetch errors
        }
      })
    );

    const userTopics = Array.from(activityMap.values()).sort((a, b) =>
      (b.topic.createdAt || '').localeCompare(a.topic.createdAt || '')
    );

    const stats: UserStats = {
      topicsAsSubject: topicsAsSubjectCount,
      questionsAsked: totalQuestionsAsked,
      questionsAnswered: totalQuestionsAnswered,
      interventions: totalInterventions,
      appreciations: totalAppreciations,
      heartsReceived: totalHeartsReceived,
      upvotesReceived: totalUpvotesReceived,
      applauseReceived: totalApplauseReceived
    };

    const record = new UserStatsRecord({
      userId: cleanId,
      stats,
      userTopics,
      updatedAt: new Date().toISOString()
    });

    if (DDB_TABLES.usersStats) {
      try {
        await ddb.put({
          TableName: DDB_TABLES.usersStats,
          Item: record
        });
      } catch (err) {
        if (logger) logger.warn('Failed to save pre-aggregated user stats', err);
      }
    }

    return record;
  }
}
