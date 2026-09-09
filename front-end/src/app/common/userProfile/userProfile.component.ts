import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, PopoverController } from '@ionic/angular';
import { IDEATranslationsModule, IDEATranslationsService } from '@idea-ionic/common';

import { UserBadgeComponent } from '@tabs/configurations/badges/userBadge.component';

import { AppService } from '@app/app.service';
import { BadgesService } from '@tabs/configurations/badges/badges.service';

import { environment as env } from '@env';
import { User } from '@models/user.model';
import { Subject } from '@models/subject.model';
import { UserBadge } from '@models/badge.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule, UserBadgeComponent],
  selector: 'app-user-profile',
  template: `
    <ion-header class="ion-no-border" *ngIf="isModal || _app.isInMobileMode() || !isCurrentUser">
      <ion-toolbar color="ideaToolbar">
        <ion-buttons slot="start" *ngIf="isModal">
          <ion-button [title]="'COMMON.CLOSE' | translate" (click)="close()">
            <ion-icon icon="close-circle-outline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="start" *ngIf="!isModal && !isCurrentUser">
          <ion-back-button defaultHref="/tabs/dashboard" />
        </ion-buttons>
        <ion-buttons slot="start" *ngIf="!isModal && isCurrentUser && _app.isInMobileMode()">
          <ion-img [src]="_app.getIcon(true)" />
        </ion-buttons>
        <ion-title>{{ 'TABS.PROFILE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list class="aList maxWidthContainer">
        <p>
          <ion-avatar>
            <img
              [src]="avatarURL || _app.getAvatarFallbackURL()"
              (error)="_app.fallbackAvatar($event.target)"
              alt=""
            />
          </ion-avatar>
        </p>
        <ion-item lines="none">
          <ion-label class="ion-text-center">
            <h1>{{ name }}</h1>
            <p *ngIf="origin">{{ origin }}</p>
            <p *ngIf="!origin && userId && name !== userId" class="userIdSubtitle">&#64;{{ userId }}</p>
          </ion-label>
        </ion-item>

        <ng-container *ngIf="!_app.configurations.hideBadges">
          <ion-list-header>
            <ion-label>
              <h2>{{ (isCurrentUser ? 'BADGES.YOUR_BADGES' : 'BADGES.USER_BADGES') | translate }}</h2>
            </ion-label>
          </ion-list-header>

          <ion-item lines="none" *ngIf="isCurrentUser && userBadges && userBadges.length">
            <ion-label class="ion-text-wrap selectBadgeHint">
              <ion-icon name="information-circle-outline"></ion-icon>
              {{ 'BADGES.SELECT_BADGE_HINT' | translate }}
            </ion-label>
          </ion-item>

          <ion-item lines="full" class="noBadges" *ngIf="userBadges && !userBadges.length">
            <ion-icon slot="start" icon="sad-outline" />
            <ion-label class="ion-text-wrap">
              {{ (isCurrentUser ? 'BADGES.NO_BADGES' : 'BADGES.NO_BADGES_USER') | translate }}
            </ion-label>
          </ion-item>

          <ion-grid class="badgesGrid">
            <ion-row class="ion-justify-content-center ion-align-items-center">
              <ion-col *ngIf="!userBadges">
                <ion-skeleton-text animated />
              </ion-col>
              <ion-col *ngFor="let userBadge of userBadges" class="badgeCol">
                <div class="badgeContainer" (click)="openUserBadgeDetails(userBadge)">
                  <ion-img
                    class="tappable"
                    [class.selectedBadgeImg]="userBadge.selected"
                    [src]="_badges.getImageURLOfUserBadge(userBadge)"
                    (ionError)="_badges.fallbackBadgeImage($event?.target)"
                  />
                  <ion-badge color="primary" class="selectedBadgeTag" *ngIf="userBadge.selected">
                    <ion-icon name="ribbon"></ion-icon>
                    {{ 'BADGES.SELECTED_FOR_QUESTIONS' | translate }}
                  </ion-badge>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ng-container>

        <ion-list-header>
          <ion-label><h2>{{ 'COMMON.ACTIONS' | translate }}</h2></ion-label>
        </ion-list-header>

        <ion-item button *ngIf="userId" (click)="openOnESNAccounts()">
          <ion-icon name="person-outline" slot="start" />
          <ion-label>
            {{ (isCurrentUser ? 'PROFILE.MANAGE_ON_ESN_ACCOUNTS' : 'PROFILE.VIEW_ON_ESN_ACCOUNTS') | translate }}
          </ion-label>
        </ion-item>

        <ng-container *ngIf="isCurrentUser">
          <ion-item *ngIf="_app.configurations.supportEmail" button (click)="sendFeedback()">
            <ion-icon name="help-buoy-outline" slot="start" />
            <ion-label>{{ 'PROFILE.FEEDBACK_OR_HELP' | translate }}</ion-label>
          </ion-item>
          <ion-item button (click)="_app.logout()">
            <ion-icon name="log-out-outline" slot="start" />
            <ion-label>{{ 'COMMON.LOGOUT' | translate }}</ion-label>
          </ion-item>
          <p class="ion-text-center version">v{{ version }}</p>
        </ng-container>

        <ion-item button *ngIf="isModal && !isCurrentUser" (click)="close()">
          <ion-icon name="close-circle-outline" slot="start" />
          <ion-label>{{ 'COMMON.CLOSE' | translate }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [
    `
      .maxWidthContainer {
        max-width: 500px;
        margin: 0 auto;
      }
      ion-avatar {
        margin: 16px auto;
        width: 140px;
        height: 140px;
        border: 4px solid var(--ion-color-light);
        box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;
        border-radius: 50%;
        overflow: hidden;
      }
      ion-avatar img,
      ion-avatar ion-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        display: block;
      }
      ion-label h1 {
        font-size: 1.5em;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .userIdSubtitle {
        color: var(--ion-color-medium);
        font-size: 0.9em;
      }
      p.version {
        margin-top: 30px;
        font-size: 0.8em;
        color: var(--ion-color-step-500);
      }
      ion-item.noBadges ion-label {
        font-size: 0.9em;
      }
      .selectBadgeHint {
        font-size: 0.85em;
        color: var(--ion-color-medium);
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: -6px;
        margin-bottom: 6px;
      }
      .badgeCol {
        display: flex;
        justify-content: center;
      }
      .badgeContainer {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
      }
      .selectedBadgeTag {
        margin-top: 4px;
        font-size: 0.7em;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
      }
      .selectedBadgeImg {
        filter: drop-shadow(0 0 6px rgba(var(--ion-color-primary-rgb), 0.6));
      }
      ion-grid.badgesGrid ion-img {
        margin: 0 auto;
        width: 90px;
        height: 90px;
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
      }
      ion-grid.badgesGrid ion-img:hover {
        transform: scale(1.08);
      }
      ion-grid.badgesGrid ion-skeleton-text {
        margin: 0 auto;
        border-radius: 50%;
        width: 90px;
        height: 90px;
      }
    `
  ]
})
export class UserProfileComponent implements OnInit, OnChanges {
  @Input() target: Subject | User | string;
  @Input() isModal = false;

  userId: string;
  name: string;
  avatarURL: string;
  origin: string;
  userBadges: UserBadge[];
  isCurrentUser = false;

  version = env.idea.app.version;

  private _popover = inject(PopoverController);
  private _modalCtrl = inject(ModalController);
  private _t = inject(IDEATranslationsService);
  _badges = inject(BadgesService);
  _app = inject(AppService);

  async ngOnInit(): Promise<void> {
    await this._badges.getList();
    await this.refreshUserAndBadges();
  }

  async ngOnChanges(): Promise<void> {
    await this.refreshUserAndBadges();
  }

  private async refreshUserAndBadges(): Promise<void> {
    this.resolveUserInfo();
    if (this.userId) {
      this.userBadges = await this._badges.getListOfUserById(this.userId);
    }
  }

  private resolveUserInfo(): void {
    if (this.target) {
      if (typeof this.target === 'string') {
        this.userId = this.target.toLowerCase();
        this.name = this.target;
        this.avatarURL = null;
        this.origin = null;
      } else if (this.target instanceof User) {
        this.userId = this.target.userId?.toLowerCase();
        this.name = [this.target.firstName, this.target.lastName].filter(Boolean).join(' ') || this.userId;
        this.avatarURL = this.target.avatarURL;
        this.origin = this.target.getOrigin ? this.target.getOrigin(this._app.configurations.usersOriginDisplay) : null;
      } else {
        const anyTarget = this.target as any;
        this.userId = (anyTarget.id ?? anyTarget.userId)?.toLowerCase();
        this.name = anyTarget.name ?? ([anyTarget.firstName, anyTarget.lastName].filter(Boolean).join(' ') || this.userId);
        this.avatarURL = anyTarget.avatarURL;
        if (typeof anyTarget.getOrigin === 'function') {
          this.origin = anyTarget.getOrigin(this._app.configurations.usersOriginDisplay);
        } else {
          this.origin = [anyTarget.country, anyTarget.section].filter(Boolean).join(' - ') || null;
        }
      }
    } else {
      this.userId = this._app.user?.userId?.toLowerCase();
      this.name = this._app.user
        ? [this._app.user.firstName, this._app.user.lastName].filter(Boolean).join(' ')
        : '';
      this.avatarURL = this._app.user?.avatarURL;
      this.origin = this._app.user?.getOrigin(this._app.configurations.usersOriginDisplay);
    }

    this.isCurrentUser = !!(
      this.userId &&
      this._app.user?.userId &&
      this.userId === this._app.user.userId.toLowerCase()
    );

    if (this.isCurrentUser && this._app.user) {
      this.name = [this._app.user.firstName, this._app.user.lastName].filter(Boolean).join(' ') || this.name;
      this.avatarURL = this._app.user.avatarURL || this.avatarURL;
      this.origin = this._app.user.getOrigin(this._app.configurations?.usersOriginDisplay) || this.origin;
    }
  }

  close(): void {
    if (this.isModal) {
      this._modalCtrl.dismiss();
    }
  }

  async openOnESNAccounts(): Promise<void> {
    if (!this.userId) return;
    await this._app.openESNAccountsProfileById(this.userId);
  }

  async sendFeedback(): Promise<void> {
    const emailSubject = encodeURIComponent(this._t._('PROFILE.FEEDBACK_EMAIL_SUBJECT'));
    const url = `mailto:${this._app.configurations.supportEmail}?subject=${emailSubject}`;
    await this._app.openURL(url);
  }

  async openUserBadgeDetails(userBadge: UserBadge): Promise<void> {
    const popover = await this._popover.create({
      component: UserBadgeComponent,
      componentProps: { userBadge },
      cssClass: 'badgePopover'
    });
    await popover.present();
    const { data } = await popover.onDidDismiss();
    if (data?.updated) {
      await this.refreshUserAndBadges();
    }
  }
}
