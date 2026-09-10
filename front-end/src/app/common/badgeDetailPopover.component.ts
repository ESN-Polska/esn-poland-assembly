import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, PopoverController } from '@ionic/angular';
import { IDEATranslationsModule } from '@idea-ionic/common';

import { BadgesService } from '@tabs/configurations/badges/badges.service';
import { DateTimezonePipe } from '@common/dateTimezone.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, IonicModule, IDEATranslationsModule, DateTimezonePipe],
  selector: 'app-badge-detail-popover',
  template: `
    <div class="badgeDetailLoading" *ngIf="loading">
      <ion-spinner name="crescent" color="primary"></ion-spinner>
    </div>
    <div class="badgeDetailCard" *ngIf="!loading && badgeDetail">
      <div class="badgeHeader">
        <div class="badgeImgFrame">
          <img
            [src]="badgeDetail.imageURL"
            (error)="_badges.fallbackBadgeImage($event?.target)"
            [alt]="badgeDetail.name"
          />
        </div>
        <div class="badgeInfo">
          <ion-badge [color]="badgeDetail.isBuiltIn ? 'primary' : 'tertiary'" class="badgeTypeBadge">
            {{ (badgeDetail.isBuiltIn ? 'BADGES.BUILT_IN_BADGE' : 'BADGES.CUSTOM_BADGE') | translate }}
          </ion-badge>
          <h3 class="badgeName">{{ badgeDetail.name }}</h3>
        </div>
      </div>

      <div class="badgeDescription" *ngIf="badgeDetail.description">
        <p>{{ badgeDetail.description }}</p>
      </div>

      <div class="badgeEarnedAt" *ngIf="earnedAt">
        <ion-icon name="time-outline"></ion-icon>
        <span>
          {{ 'BADGES.BADGE_EARNED' | translate }}:
          <span class="earnedDate">{{ earnedAt | dateTz }}</span>
        </span>
      </div>

      <div class="badgeActions">
        <ion-button size="small" fill="clear" color="medium" (click)="close()">
          {{ 'COMMON.CLOSE' | translate }}
        </ion-button>
      </div>
    </div>
  `,
  styles: [
    `
      .badgeDetailLoading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 110px;
        padding: 20px;
        background: var(--ion-card-background, #ffffff);
      }

      .badgeDetailCard {
        padding: 18px 18px 10px 18px;
        background: var(--ion-card-background, #ffffff);
        color: var(--ion-text-color, #111111);
      }

      .badgeHeader {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 8px;
      }

      .badgeImgFrame {
        width: 48px;
        height: 48px;
        min-width: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
      }

      .badgeImgFrame img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.14));
      }

      .badgeInfo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .badgeTypeBadge {
        align-self: flex-start;
        font-size: 0.65rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 6px;
      }

      .badgeName {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        line-height: 1.25;
        letter-spacing: -0.2px;
        color: var(--ion-text-color, #111111);
        word-break: break-word;
      }

      .badgeDescription {
        margin: 10px 0 6px 0;
        padding: 0;
        background: none;
        border: none;
      }

      .badgeDescription p {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.5;
        color: var(--ion-color-step-800, #333333);
      }

      .badgeEarnedAt {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.08));
        font-size: 0.85rem;
        color: var(--ion-color-step-650, #555555);
      }

      .badgeEarnedAt ion-icon {
        font-size: 1.2rem;
        color: var(--ion-color-primary);
        flex-shrink: 0;
      }

      .badgeEarnedAt .earnedDate {
        font-weight: 600;
        color: var(--ion-text-color, #111111);
      }

      .badgeActions {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }

      .badgeActions ion-button {
        --padding-start: 10px;
        --padding-end: 10px;
        height: 28px;
        font-size: 0.85rem;
        margin: 0;
      }
    `
  ]
})
export class BadgeDetailPopoverComponent implements OnInit {
  @Input() badgeId: string;
  @Input() userId?: string;
  @Input() preloadedBadgeDetail?: {
    badgeId: string;
    name: string;
    description: string;
    imageURL: string;
    isBuiltIn: boolean;
  } | null;
  @Input() preloadedEarnedAt?: string | null;

  loading = true;
  badgeDetail: {
    badgeId: string;
    name: string;
    description: string;
    imageURL: string;
    isBuiltIn: boolean;
  } | null = null;

  earnedAt: string | null = null;

  public _badges = inject(BadgesService);
  private popoverCtrl = inject(PopoverController);

  async ngOnInit(): Promise<void> {
    if (this.preloadedBadgeDetail !== undefined) {
      this.badgeDetail = this.preloadedBadgeDetail;
      this.earnedAt = this.preloadedEarnedAt ?? null;
      this.loading = false;
      return;
    }

    try {
      if (this.badgeId) {
        this.badgeDetail = await this._badges.getBadgeDetail(this.badgeId);
      }
      if (this.userId && this.badgeId) {
        try {
          const userBadges = await this._badges.getListOfUserById(this.userId);
          const userBadge = userBadges?.find(ub => ub.badge === this.badgeId);
          if (userBadge?.earnedAt) {
            this.earnedAt = userBadge.earnedAt;
          }
        } catch (err) {
          // Fallback silently if user badges cannot be retrieved
        }
      }
    } finally {
      this.loading = false;
    }
  }

  close(): void {
    this.popoverCtrl.dismiss();
  }
}
