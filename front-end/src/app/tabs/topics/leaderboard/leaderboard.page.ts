import { Component, OnInit } from '@angular/core';
import { AlertController, PopoverController } from '@ionic/angular';
import { IDEAApiService, IDEALoadingService, IDEAMessageService, IDEATranslationsService } from '@idea-ionic/common';

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

  filteredParticipants: ParticipantLeaderboardEntry[] = [];
  filteredSections: SectionLeaderboardEntry[] = [];
  displayParticipants: ParticipantLeaderboardEntry[] = [];
  displaySections: SectionLeaderboardEntry[] = [];

  participantsLimit = 50;
  sectionsLimit = 50;
  readonly PAGE_SIZE = 50;

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
    private api: IDEAApiService,
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

      // 1. Fetch events list for selector (including archived events)
      try {
        this.events = (await this._events.getList({ all: true, force: true })) || [];
      } catch (_) {
        this.events = [];
      }

      // 2. Try fetching pre-aggregated leaderboard directly from backend in 1 fast query
      let backendSuccess = false;
      try {
        const res: any = await this.api.getResource('usersStats', {
          params: {
            leaderboard: true,
            ...(this.filterByEvent ? { eventId: this.filterByEvent } : {})
          }
        });
        if (res && res.participants && res.sections) {
          this.participantsLeaderboard = (res.participants || []).map((p: any) => ({
            ...p,
            creator: new Subject(p.creator)
          }));
          this.sectionsLeaderboard = res.sections || [];
          this.liveTopicsCount = res.liveTopicsCount || 0;
          backendSuccess = true;
        }
      } catch (_) {
        backendSuccess = false;
      }

      if (!backendSuccess) {
        // Fallback: Client-side calculation directly
        let allTopics: Topic[] = [];
        try {
          allTopics = (await this._topics.getAllTopics()) || [];
        } catch (_) {
          const [activeTopics, archivedTopics] = await Promise.all([
            this._topics.getActiveList({ force: true }).catch(() => [] as Topic[]),
            this._topics.getArchivedList({ force: true }).catch(() => [] as Topic[])
          ]);
          const topicMap = new Map<string, Topic>();
          for (const t of [...(activeTopics || []), ...(archivedTopics || [])]) {
            if (t?.topicId) {
              topicMap.set(t.topicId, t);
            }
          }
          allTopics = Array.from(topicMap.values());
        }

        let liveTopics = allTopics.filter(t => t.type === TopicTypes.LIVE && !t.isDraft());

        if (this.filterByEvent) {
          liveTopics = liveTopics.filter(t => t.event?.eventId === this.filterByEvent);
        }

        this.liveTopicsCount = liveTopics.length;

        const BATCH_SIZE = 6;
        const topicMessagesArrays: Message[][] = [];

        for (let i = 0; i < liveTopics.length; i += BATCH_SIZE) {
          const batch = liveTopics.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async topic => {
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  return await this._messages.getRawMessagesOfTopic(topic);
                } catch (_) {
                  if (attempt === 3) {
                    return [] as Message[];
                  }
                  await new Promise(resolve => setTimeout(resolve, 150 * attempt));
                }
              }
              return [] as Message[];
            })
          );
          topicMessagesArrays.push(...batchResults);
        }

        const participantMap = new Map<string, ParticipantLeaderboardEntry>();
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
              entry.upvotesReceived += msg.numOfUpvotes ?? 0;
            } else if (msg.type === MessageTypes.APPRECIATION) {
              entry.appreciations++;
              entry.heartsReceived += msg.numOfUpvotes ?? 0;
            }
          }
        }

        const scoring = this.app.configurations.engagementScoring || {
          interventionMultiplier: 3,
          appreciationMultiplier: 1,
          upvoteMultiplier: 1,
          heartMultiplier: 1
        };
        for (const [creatorId, entry] of participantMap.entries()) {
          entry.topicsCount = topicParticipationMap.get(creatorId)?.size || 0;
          entry.score =
            entry.interventions * scoring.interventionMultiplier +
            entry.appreciations * scoring.appreciationMultiplier +
            entry.upvotesReceived * scoring.upvoteMultiplier +
            entry.heartsReceived * scoring.heartMultiplier;
        }

        this.participantsLeaderboard = Array.from(participantMap.values()).sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const bTotal = b.interventions + b.appreciations;
          const aTotal = a.interventions + a.appreciations;
          if (bTotal !== aTotal) return bTotal - aTotal;
          return (a.creator.name || '').localeCompare(b.creator.name || '');
        });

        this.participantsLeaderboard.forEach((entry, idx) => {
          if (idx > 0 && entry.score === this.participantsLeaderboard[idx - 1].score) {
            entry.rank = this.participantsLeaderboard[idx - 1].rank;
          } else {
            entry.rank = idx;
          }
        });

        const sectionMap = new Map<string, SectionLeaderboardEntry>();
        for (const entry of this.participantsLeaderboard) {
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

        this.sectionsLeaderboard = Array.from(sectionMap.values()).sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          if (b.participantsCount !== a.participantsCount) return b.participantsCount - a.participantsCount;
          return a.section.localeCompare(b.section);
        });

        this.sectionsLeaderboard.forEach((entry, idx) => {
          if (idx > 0 && entry.totalScore === this.sectionsLeaderboard[idx - 1].totalScore) {
            entry.rank = this.sectionsLeaderboard[idx - 1].rank;
          } else {
            entry.rank = idx;
          }
        });
      }

      // Check current user's rank
      const currentUserId = this.app.user?.userId?.toLowerCase();
      const myEntry = this.participantsLeaderboard.find(d => d.creator.id?.toLowerCase() === currentUserId);
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
      this.filteredParticipants = this.participantsLeaderboard.slice();
      this.filteredSections = this.sectionsLeaderboard.slice();
    } else {
      this.filteredParticipants = this.participantsLeaderboard.filter(d => {
        const name = (d.creator.name || '').toLowerCase();
        const section = (d.creator.section || '').toLowerCase();
        const country = (d.creator.country || '').toLowerCase();
        return name.includes(q) || section.includes(q) || country.includes(q);
      });

      this.filteredSections = this.sectionsLeaderboard.filter(s => {
        const sectionMatches = s.section.toLowerCase().includes(q);
        const countryMatches = (s.country || '').toLowerCase().includes(q);
        return sectionMatches || countryMatches;
      });
    }

    this.participantsLimit = this.PAGE_SIZE;
    this.sectionsLimit = this.PAGE_SIZE;
    this.updateDisplayedLists();
  }

  private updateDisplayedLists(): void {
    this.displayParticipants = this.filteredParticipants.slice(0, this.participantsLimit);
    this.displaySections = this.filteredSections.slice(0, this.sectionsLimit);
  }

  loadMore(event: any): void {
    if (this.app.isInMobileMode()) {
      if (this.mobileSegment === 'participants') {
        this.participantsLimit += this.PAGE_SIZE;
      } else {
        this.sectionsLimit += this.PAGE_SIZE;
      }
    } else {
      this.participantsLimit += this.PAGE_SIZE;
      this.sectionsLimit += this.PAGE_SIZE;
    }
    this.updateDisplayedLists();

    setTimeout(() => {
      if (event?.target) {
        event.target.complete();
      }
    }, 50);
  }

  get hasMoreToLoad(): boolean {
    if (this.app.isInMobileMode()) {
      return this.mobileSegment === 'participants'
        ? this.displayParticipants.length < this.filteredParticipants.length
        : this.displaySections.length < this.filteredSections.length;
    }
    return (
      this.displayParticipants.length < this.filteredParticipants.length ||
      this.displaySections.length < this.filteredSections.length
    );
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
    if (this.app.user.section.trim().toLowerCase() === 'unknown') return false;
    return this.app.user.section.trim().toLowerCase() === sectionName.trim().toLowerCase();
  }

  trackByCreatorId(_: number, item: ParticipantLeaderboardEntry): string {
    return item.creator.id;
  }

  trackBySection(_: number, item: SectionLeaderboardEntry): string {
    return item.section;
  }
}
