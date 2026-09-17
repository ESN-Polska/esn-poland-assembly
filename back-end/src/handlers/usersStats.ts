///
/// IMPORTS
///

import { DynamoDB, ResourceController } from 'idea-aws';

import { User } from '../models/user.model';
import { Topic, TopicTypes } from '../models/topic.model';
import { Question } from '../models/question.model';
import { Message, MessageTypes } from '../models/message.model';
import { Configurations } from '../models/configurations.model';
import { UserStats, UserTopicSummary, UserStatsRecord } from '../models/userStats.model';
import { getSelectedBadgesForUsers } from './usersBadges';

///
/// CONSTANTS, ENVIRONMENT VARIABLES, HANDLER
///

const DDB_TABLES = {
  usersStats: process.env.DDB_TABLE_usersStats,
  topics: process.env.DDB_TABLE_topics,
  questions: process.env.DDB_TABLE_questions,
  messages: process.env.DDB_TABLE_messages,
  configurations: process.env.DDB_TABLE_configurations,
  usersBadges: process.env.DDB_TABLE_usersBadges
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
    if (this.queryParams.leaderboard === 'true' || this.queryParams.leaderboard === true) {
      return await UsersStatsRC.aggregateLeaderboard(this.queryParams.eventId, this.galaxyUser?.isAdministrator);
    }

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

  /**
   * Aggregate live topics engagement leaderboard on the server.
   */
  static async aggregateLeaderboard(
    eventId?: string,
    isAdmin = false
  ): Promise<{
    participants: any[];
    sections: any[];
    liveTopicsCount: number;
  }> {
    // 1. Fetch all topics
    const topicsRaw = (await ddb.scan({ TableName: DDB_TABLES.topics })) || [];
    let topics = topicsRaw.map(t => new Topic(t));
    if (!isAdmin) {
      topics = topics.filter(t => !t.isDraft());
    }

    let liveTopics = topics.filter(t => t.type === TopicTypes.LIVE);
    if (eventId) {
      liveTopics = liveTopics.filter(t => t.event?.eventId === eventId);
    }

    const liveTopicsCount = liveTopics.length;

    // 2. Fetch all messages in parallel from DynamoDB
    const topicMessagesArrays = await Promise.all(
      liveTopics.map(async t => {
        try {
          const raw: any[] = await ddb.query({
            TableName: DDB_TABLES.messages,
            KeyConditionExpression: 'topicId = :topicId',
            ExpressionAttributeValues: { ':topicId': t.topicId }
          });
          return (raw || []).map(m => new Message(m));
        } catch (_) {
          return [] as Message[];
        }
      })
    );

    // 3. Aggregate per participant
    const participantMap = new Map<string, any>();
    const topicParticipationMap = new Map<string, Set<string>>();

    for (let i = 0; i < liveTopics.length; i++) {
      const topic = liveTopics[i];
      const messages = topicMessagesArrays[i] || [];

      for (const msg of messages) {
        if (!msg.creator?.id) continue;
        const creatorId = msg.creator.id.toLowerCase().trim();

        if (!topicParticipationMap.has(creatorId)) {
          topicParticipationMap.set(creatorId, new Set<string>());
        }
        topicParticipationMap.get(creatorId).add(topic.topicId);

        if (!participantMap.has(creatorId)) {
          participantMap.set(creatorId, {
            creator: msg.creator,
            interventions: 0,
            appreciations: 0,
            upvotesReceived: 0,
            heartsReceived: 0,
            topicsCount: 0,
            score: 0,
            rank: 0
          });
        }

        const entry = participantMap.get(creatorId);
        if (!entry.creator.avatarURL && msg.creator.avatarURL) entry.creator.avatarURL = msg.creator.avatarURL;
        if (!entry.creator.section && msg.creator.section) entry.creator.section = msg.creator.section;
        if (!entry.creator.selectedBadge && msg.creator.selectedBadge) entry.creator.selectedBadge = msg.creator.selectedBadge;

        if (msg.type === MessageTypes.QUESTION) {
          entry.interventions++;
          entry.upvotesReceived += msg.numOfUpvotes || 0;
        } else if (msg.type === MessageTypes.APPRECIATION) {
          entry.appreciations++;
          entry.heartsReceived += msg.numOfUpvotes || 0;
        }
      }
    }

    // 4. Fetch selected badges for participants
    const userIds = Array.from(participantMap.keys());
    if (userIds.length && DDB_TABLES.usersBadges) {
      try {
        const selectedBadges = await getSelectedBadgesForUsers(ddb, userIds);
        for (const [userId, entry] of participantMap.entries()) {
          if (selectedBadges[userId]) {
            entry.creator.selectedBadge = selectedBadges[userId];
          }
        }
      } catch (_) {
        // Badges table optional or not yet created
      }
    }

    // 5. Calculate scores using configurations
    let scoring: any = {
      interventionMultiplier: 3,
      appreciationMultiplier: 1,
      upvoteMultiplier: 1,
      heartMultiplier: 1
    };
    if (DDB_TABLES.configurations) {
      try {
        const configRaw = await ddb.get({ TableName: DDB_TABLES.configurations, Key: { PK: Configurations.PK } });
        if (configRaw && configRaw.engagementScoring) {
          scoring = configRaw.engagementScoring;
        }
      } catch (_) {
        // Configurations table optional or default scoring
      }
    }

    for (const [creatorId, entry] of participantMap.entries()) {
      entry.topicsCount = topicParticipationMap.get(creatorId)?.size || 0;
      entry.score =
        entry.interventions * (scoring.interventionMultiplier ?? 3) +
        entry.appreciations * (scoring.appreciationMultiplier ?? 1) +
        entry.upvotesReceived * (scoring.upvoteMultiplier ?? 1) +
        entry.heartsReceived * (scoring.heartMultiplier ?? 1);
    }

    const participants = Array.from(participantMap.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const bTotal = b.interventions + b.appreciations;
      const aTotal = a.interventions + a.appreciations;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return (a.creator.name || '').localeCompare(b.creator.name || '');
    });
    participants.forEach((p, i) => (p.rank = i));

    // 6. Aggregate sections
    const sectionMap = new Map<string, any>();
    for (const entry of participants) {
      const rawSection = entry.creator.section?.trim();
      if (!rawSection || rawSection.toLowerCase() === 'unknown') {
        continue;
      }
      const sectionName = rawSection;
      const rawCountry = entry.creator.country?.trim() || '';
      const countryName = rawCountry.toLowerCase() === 'unknown' ? '' : rawCountry;
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, {
          section: sectionName,
          country: countryName,
          totalScore: 0,
          participantsCount: 0,
          avgScore: 0,
          interventions: 0,
          appreciations: 0,
          upvotesReceived: 0,
          heartsReceived: 0,
          rank: 0
        });
      }
      const sEntry = sectionMap.get(sectionName);
      if (!sEntry.country && countryName) {
        sEntry.country = countryName;
      }
      sEntry.totalScore += entry.score;
      sEntry.participantsCount++;
      sEntry.interventions += entry.interventions;
      sEntry.appreciations += entry.appreciations;
      sEntry.upvotesReceived += entry.upvotesReceived;
      sEntry.heartsReceived += entry.heartsReceived;
    }

    for (const sEntry of sectionMap.values()) {
      sEntry.avgScore = sEntry.participantsCount > 0 ? sEntry.totalScore / sEntry.participantsCount : 0;
    }

    const sections = Array.from(sectionMap.values()).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.participantsCount !== a.participantsCount) return b.participantsCount - a.participantsCount;
      return a.section.localeCompare(b.section);
    });
    sections.forEach((s, i) => (s.rank = i));

    return { participants, sections, liveTopicsCount };
  }
}
