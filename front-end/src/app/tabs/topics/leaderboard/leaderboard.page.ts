import { Component, OnInit } from '@angular/core';
import { AlertController, PopoverController } from '@ionic/angular';
import { IDEALoadingService, IDEAMessageService, IDEATranslationsService } from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { BadgeDetailPopoverComponent } from '@app/common/badgeDetailPopover.component';
import { BadgesService } from '@tabs/configurations/badges/badges.service';
import { GAEventsService } from '@tabs/configurations/events/events.service';
import { TopicsService } from '@tabs/topics/topics.service';
import { MessagesService } from '@tabs/topics/messages/messages.service';

import { GAEvent } from '@models/event.model';
import { Topic, TopicTypes } from '@models/topic.model';
import { Message, MessageTypes } from '@models/message.model';
import { Subject } from '@models/subject.model';

export interface ParticipantLeaderboardEntry {
  creator: Subject;
  interventions: number;
  appreciations: number;
  upvotesReceived: number;
  heartsReceived: number;
  topicsCount: number;
  score: number;
  rank: number;
}

export interface SectionLeaderboardEntry {
  section: string;
  country: string;
  totalScore: number;
  participantsCount: number;
  avgScore: number;
  interventions: number;
  appreciations: number;
  upvotesReceived: number;
  heartsReceived: number;
  rank: number;
}

@Component({
  selector: 'topics-leaderboard',
  templateUrl: 'leaderboard.page.html',
  styleUrls: ['leaderboard.page.scss']
})
export class TopicsLeaderboardPage implements OnInit {
  events: GAEvent[] = [];
  filterByEvent: string = null;
  searchQuery: string = '';
  loading = false;

  liveTopicsCount = 0;
  participantsLeaderboard: ParticipantLeaderboardEntry[] = [];
  sectionsLeaderboard: SectionLeaderboardEntry[] = [];

  displayParticipants: ParticipantLeaderboardEntry[] = [];
  displaySections: SectionLeaderboardEntry[] = [];

  mobileSegment: 'participants' | 'sections' = 'participants';
  myLeaderboardRank: number | null = null;
  myScore: number | null = null;
  mySectionRank: number | null = null;
  mySectionScore: number | null = null;

  constructor(
    public app: AppService,
    public _badges: BadgesService,
    private _events: GAEventsService,
    private _topics: TopicsService,
    private _messages: MessagesService,
    private alertCtrl: AlertController,
    private popoverCtrl: PopoverController,
    private loadingService: IDEALoadingService,
    private messageService: IDEAMessageService,
    private t: IDEATranslationsService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(showLoadingIndicator = true): Promise<void> {
    try {
      this.loading = true;
      if (showLoadingIndicator) {
        await this.loadingService.show();
      }

      // 1. Fetch events list for selector
      try {
        this.events = (await this._events.getList()) || [];
      } catch (_) {
        this.events = [];
      }

      // 2. Fetch active and archived topics
      const [activeTopics, archivedTopics] = await Promise.all([
        this._topics.getActiveList().catch(() => [] as Topic[]),
        this._topics.getArchivedList().catch(() => [] as Topic[])
      ]);

      const allTopics = [...(activeTopics || []), ...(archivedTopics || [])];

      // 3. Filter for Live topics (include all regardless of disableEngagement)
      let liveTopics = allTopics.filter(t => t.type === TopicTypes.LIVE && !t.isDraft());

      if (this.filterByEvent) {
        liveTopics = liveTopics.filter(t => t.event?.eventId === this.filterByEvent);
      }

      this.liveTopicsCount = liveTopics.length;

      // 4. Fetch messages concurrently for all live topics
      const topicMessagesArrays = await Promise.all(
        liveTopics.map(topic =>
          this._messages
            .getListOfTopic(topic, { force: true })
            .catch(() => [] as Message[])
        )
      );

      // 5. Aggregate messages per participant
      const participantMap = new Map<string, ParticipantLeaderboardEntry>();
      const topicParticipationMap = new Map<string, Set<string>>();

      for (let i = 0; i < liveTopics.length; i++) {
        const topic = liveTopics[i];
        const messages = topicMessagesArrays[i] || [];

        for (const msg of messages) {
          if (!msg.creator?.id) continue;
          const creatorId = msg.creator.id;

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
          // Preserve avatar and badge from latest message if current is missing
          if (!entry.creator.avatarURL && msg.creator.avatarURL) entry.creator.avatarURL = msg.creator.avatarURL;
          if (!entry.creator.section && msg.creator.section) entry.creator.section = msg.creator.section;
          if (!entry.creator.selectedBadge && msg.creator.selectedBadge) entry.creator.selectedBadge = msg.creator.selectedBadge;

          if (msg.type === MessageTypes.QUESTION) {
            entry.interventions++;
            entry.upvotesReceived += msg.numOfUpvotes ?? 0;
          } else if (msg.type === MessageTypes.APPRECIATION) {
            entry.appreciations++;
            entry.heartsReceived += msg.numOfUpvotes ?? 0;
          }
        }
      }

      // Calculate participant scores
      const scoring = this.app.configurations.engagementScoring;
      for (const [creatorId, entry] of participantMap.entries()) {
        entry.topicsCount = topicParticipationMap.get(creatorId)?.size || 0;
        entry.score =
          entry.interventions * scoring.interventionMultiplier +
          entry.appreciations * scoring.appreciationMultiplier +
          entry.upvotesReceived * scoring.upvoteMultiplier +
          entry.heartsReceived * scoring.heartMultiplier;
      }

      // Sort participants by score DESC
      this.participantsLeaderboard = Array.from(participantMap.values()).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const bTotal = b.interventions + b.appreciations;
        const aTotal = a.interventions + a.appreciations;
        if (bTotal !== aTotal) return bTotal - aTotal;
        return (a.creator.name || '').localeCompare(b.creator.name || '');
      });

      this.participantsLeaderboard.forEach((entry, idx) => (entry.rank = idx));

      // 6. Aggregate sections leaderboard
      const sectionMap = new Map<string, SectionLeaderboardEntry>();
      for (const entry of this.participantsLeaderboard) {
        const sectionName = entry.creator.section?.trim() || 'Other / National';
        const countryName = entry.creator.country?.trim() || '';
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

      this.sectionsLeaderboard = Array.from(sectionMap.values()).sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.participantsCount !== a.participantsCount) return b.participantsCount - a.participantsCount;
        return a.section.localeCompare(b.section);
      });

      this.sectionsLeaderboard.forEach((entry, idx) => (entry.rank = idx));

      // Check current user's rank
      const myEntry = this.participantsLeaderboard.find(d => d.creator.id === this.app.user?.userId);
      if (myEntry) {
        this.myLeaderboardRank = myEntry.rank + 1;
        this.myScore = myEntry.score;
      } else {
        this.myLeaderboardRank = null;
        this.myScore = null;
      }

      // Check current user's section rank
      const mySectionEntry = this.sectionsLeaderboard.find(s => this.isMySection(s.section));
      if (mySectionEntry) {
        this.mySectionRank = mySectionEntry.rank + 1;
        this.mySectionScore = mySectionEntry.totalScore;
      } else {
        this.mySectionRank = null;
        this.mySectionScore = null;
      }

      this.applySearch();
    } catch (err) {
      this.messageService.error('COMMON.OPERATION_FAILED');
    } finally {
      this.loading = false;
      if (showLoadingIndicator) {
        this.loadingService.hide();
      }
    }
  }

  async handleRefresh(event?: any): Promise<void> {
    await this.loadData(false);
    if (event?.complete) {
      event.complete();
    }
  }

  onEventChange(): void {
    this.loadData();
  }

  applySearch(): void {
    const q = (this.searchQuery || '').trim().toLowerCase();

    if (!q) {
      this.displayParticipants = this.participantsLeaderboard.slice();
      this.displaySections = this.sectionsLeaderboard.slice();
      return;
    }

    this.displayParticipants = this.participantsLeaderboard.filter(d => {
      const name = (d.creator.name || '').toLowerCase();
      const section = (d.creator.section || '').toLowerCase();
      const country = (d.creator.country || '').toLowerCase();
      return name.includes(q) || section.includes(q) || country.includes(q);
    });

    this.displaySections = this.sectionsLeaderboard.filter(s => {
      const sectionMatches = s.section.toLowerCase().includes(q);
      const countryMatches = (s.country || '').toLowerCase().includes(q);
      return sectionMatches || countryMatches;
    });
  }

  async showScoringInfo(event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const scoring = this.app.configurations.engagementScoring;
    const header = this.t._('MESSAGES.SCORING_FORMULA');
    const message = this.t._('MESSAGES.SCORING_FORMULA_DETAILS', {
      i: scoring.interventionMultiplier,
      a: scoring.appreciationMultiplier,
      u: scoring.upvoteMultiplier,
      h: scoring.heartMultiplier
    });
    const buttons = [{ text: this.t._('COMMON.CLOSE') }];
    const alert = await this.alertCtrl.create({ header, message, buttons, cssClass: 'scoringInfoAlert' });
    await alert.present();
  }

  openUserProfile(creator: Subject): void {
    if (creator) {
      this.app.openUserProfile(creator);
    }
  }

  filterBySection(sectionName: string): void {
    if (!sectionName) return;
    if (this.searchQuery.trim().toLowerCase() === sectionName.trim().toLowerCase()) {
      this.searchQuery = '';
    } else {
      this.searchQuery = sectionName;
      if (this.app.isInMobileMode()) {
        this.mobileSegment = 'participants';
      }
    }
    this.applySearch();
  }

  async openBadgeDetail(badgeId: string, event: Event, userId?: string): Promise<void> {
    if (!badgeId) return;
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const isMobile = this.app.isInMobileMode() || window.innerWidth <= 767;
    const badgeElement = event?.currentTarget as HTMLElement;
    const badgeRect = badgeElement?.getBoundingClientRect();
    const popoverWidth = 320;
    const viewportPadding = 8;
    const alignment =
      badgeRect && badgeRect.right + popoverWidth > window.innerWidth - viewportPadding ? 'end' : 'start';

    let preloadedBadgeDetail;
    let preloadedEarnedAt: string | null = null;
    try {
      preloadedBadgeDetail = await this._badges.getBadgeDetail(badgeId);
      if (userId) {
        const userBadges = await this._badges.getListOfUserById(userId);
        preloadedEarnedAt = userBadges?.find(userBadge => userBadge.badge === badgeId)?.earnedAt ?? null;
      }
    } catch (_) {
      preloadedBadgeDetail = undefined;
    }

    const popover = await this.popoverCtrl.create({
      component: BadgeDetailPopoverComponent,
      componentProps: { badgeId, userId, preloadedBadgeDetail, preloadedEarnedAt },
      cssClass: 'badgeDetailPopover',
      showBackdrop: false,
      event: isMobile ? undefined : event,
      alignment: isMobile ? undefined : alignment
    });
    await popover.present();

    if (!isMobile) {
      requestAnimationFrame(() => {
        const content = popover.shadowRoot?.querySelector<HTMLElement>('[part="content"]');
        if (!content) return;

        const bounds = content.getBoundingClientRect();
        const horizontalOffset =
          Math.max(viewportPadding - bounds.left, 0) - Math.max(bounds.right - window.innerWidth + viewportPadding, 0);
        const verticalOffset =
          Math.max(viewportPadding - bounds.top, 0) - Math.max(bounds.bottom - window.innerHeight + viewportPadding, 0);

        if (horizontalOffset !== 0 || verticalOffset !== 0) {
          const currentTransform = content.style.transform;
          const translateMatch = currentTransform.match(/translate(?:3d)?\(([^)]+)\)/);
          if (translateMatch) {
            const coords = translateMatch[1].split(',').map(coord => parseFloat(coord.trim()) || 0);
            const currentX = coords[0] || 0;
            const currentY = coords[1] || 0;
            content.style.transform = `translate3d(${currentX + horizontalOffset}px, ${currentY + verticalOffset}px, 0px)`;
          } else {
            content.style.transform = `translate3d(${horizontalOffset}px, ${verticalOffset}px, 0px)`;
          }
        }
      });
    }
  }

  isMySection(sectionName: string): boolean {
    if (!this.app.user?.section || !sectionName) return false;
    return this.app.user.section.trim().toLowerCase() === sectionName.trim().toLowerCase();
  }

  trackByCreatorId(_: number, item: ParticipantLeaderboardEntry): string {
    return item.creator.id;
  }

  trackBySection(_: number, item: SectionLeaderboardEntry): string {
    return item.section;
  }
}
