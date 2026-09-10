import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, PopoverController } from '@ionic/angular';
import { Suggestion } from 'idea-toolbox';
import {
  IDEAApiService,
  IDEALoadingService,
  IDEAMessageService,
  IDEASuggestionsComponent,
  IDEATranslationsModule,
  IDEATranslationsService
} from '@idea-ionic/common';

import { UserBadgeComponent } from '@tabs/configurations/badges/userBadge.component';

import { AppService } from '@app/app.service';
import { UsersService } from '@common/users.service';
import { BadgesService } from '@tabs/configurations/badges/badges.service';
import { DateTimezonePipe } from '@common/dateTimezone.pipe';

import { environment as env } from '@env';
import { User } from '@models/user.model';
import { Subject } from '@models/subject.model';
import { Badge, BuiltInBadges, UserBadge } from '@models/badge.model';
import { Topic, TopicTypes } from '@models/topic.model';
import { Question } from '@models/question.model';
import { Message, MessageTypes } from '@models/message.model';
import { TopicsService } from '@tabs/topics/topics.service';
import { QuestionsService } from '@tabs/topics/questions/questions.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule, UserBadgeComponent, DateTimezonePipe],
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

        <div class="profileSegmentContainer" *ngIf="!_app.configurations?.hideQATopics">
          <ion-segment [(ngModel)]="activeSegment" (ionChange)="segmentChanged()">
            <ion-segment-button value="profile">
              <ion-label>{{ 'TABS.PROFILE' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="qa">
              <ion-label>
                {{ 'PROFILE.TOPICS.TAB' | translate }}
                <ion-badge *ngIf="userTopics?.length" color="primary" class="segmentBadge">
                  {{ userTopics.length }}
                </ion-badge>
              </ion-label>
            </ion-segment-button>
            <ion-segment-button value="stats">
              <ion-label>{{ 'PROFILE.STATS.TAB' | translate }}</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <ng-container *ngIf="activeSegment === 'profile' || _app.configurations?.hideQATopics">
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
              <ion-col class="ion-text-center badgeCol" *ngIf="_app.user?.isAdministrator && userId && userBadges">
                <div class="badgeContainer addBadgeTile" (click)="assignBadge()">
                  <div class="addBadgeButton">
                    <ion-icon name="add" />
                  </div>
                  <ion-label class="addBadgeTileLabel">{{ 'BADGES.GIVE_A_BADGE' | translate }}</ion-label>
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
        </ng-container>

        <ng-container *ngIf="activeSegment === 'qa' && !_app.configurations?.hideQATopics">
          <ion-list-header>
            <ion-label>
              <h2>{{ 'PROFILE.TOPICS.HEADER' | translate }}</h2>
            </ion-label>
          </ion-list-header>

          <ng-container *ngIf="!userTopics">
            <ion-item *ngFor="let _ of [1, 2, 3]">
              <ion-label>
                <ion-skeleton-text animated style="width: 70%"></ion-skeleton-text>
                <p><ion-skeleton-text animated style="width: 40%"></ion-skeleton-text></p>
              </ion-label>
            </ion-item>
          </ng-container>

          <div class="noTopics" *ngIf="userTopics && !userTopics.length">
            <ion-icon name="chatbubbles-outline" />
            <p>{{ 'PROFILE.TOPICS.NO_ACTIVITY' | translate }}</p>
          </div>

          <ion-item
            button
            class="topicItem"
            *ngFor="let item of userTopics"
            (click)="openTopic(item.topic)"
          >
            <ion-label class="ion-text-wrap">
              <p class="topicMeta">
                <span class="eventName" *ngIf="item.topic.event?.name">{{ item.topic.event.name }}</span>
                <ion-badge [color]="item.topic.category.color" *ngIf="item.topic.category?.name">
                  {{ item.topic.category.name }}
                </ion-badge>
                <span class="topicDate">
                  <ion-icon name="calendar-outline"></ion-icon>
                  {{ getTopicDate(item.topic) | dateTz }}
                </span>
              </p>
              <h3>{{ item.topic.name }}</h3>
              <p class="topicBadges">
                <ion-badge color="tertiary" *ngIf="item.isSpeaker">
                  <ion-icon name="person-outline"></ion-icon>
                  {{ 'PROFILE.TOPICS.ROLE_SUBJECT' | translate }}
                </ion-badge>
                <ion-badge color="success" *ngIf="item.isSpeaker && item.answeredCount">
                  <ion-icon name="checkmark-done-outline"></ion-icon>
                  {{ (item.answeredCount === 1 ? 'PROFILE.TOPICS.ANSWERED_ONE' : 'PROFILE.TOPICS.ANSWERED_MANY') | translate : { count: item.answeredCount } }}
                </ion-badge>
                <ion-badge color="secondary" *ngIf="item.askedCount">
                  <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
                  {{ (item.askedCount === 1 ? 'PROFILE.TOPICS.ROLE_QUESTIONER_ONE' : 'PROFILE.TOPICS.ROLE_QUESTIONER_MANY') | translate : { count: item.askedCount } }}
                </ion-badge>
                <ion-badge color="primary" *ngIf="item.interventionsCount">
                  <ion-icon name="mic-outline"></ion-icon>
                  {{ (item.interventionsCount === 1 ? 'PROFILE.TOPICS.INTERVENTION_ONE' : 'PROFILE.TOPICS.INTERVENTION_MANY') | translate : { count: item.interventionsCount } }}
                </ion-badge>
                <ion-badge color="ESNpink" *ngIf="item.appreciationsCount">
                  <ion-icon name="heart-outline"></ion-icon>
                  {{ (item.appreciationsCount === 1 ? 'PROFILE.TOPICS.APPRECIATION_ONE' : 'PROFILE.TOPICS.APPRECIATION_MANY') | translate : { count: item.appreciationsCount } }}
                </ion-badge>
                <ion-badge [color]="item.topic.closedAt ? 'medium' : 'success'">
                  {{ 'TOPICS.STATUSES.' + (item.topic.closedAt ? 'CLOSED' : 'OPEN') | translate }}
                </ion-badge>
              </p>
            </ion-label>
            <ion-icon name="chevron-forward" slot="end" color="medium" />
          </ion-item>
        </ng-container>

        <ng-container *ngIf="activeSegment === 'stats' && !_app.configurations?.hideQATopics">
          <ion-list-header>
            <ion-label>
              <h2>{{ 'PROFILE.STATS.HEADER' | translate }}</h2>
            </ion-label>
          </ion-list-header>

          <ng-container *ngIf="!userStats">
            <ion-grid class="statsGrid">
              <ion-row>
                <ion-col size="6" *ngFor="let _ of [1, 2, 3, 4, 5, 6, 7, 8]">
                  <ion-card class="statCard skeletonStatCard">
                    <ion-card-content>
                      <ion-skeleton-text animated class="statIconSkeleton"></ion-skeleton-text>
                      <ion-skeleton-text animated class="statValueSkeleton"></ion-skeleton-text>
                      <ion-skeleton-text animated class="statLabelSkeleton"></ion-skeleton-text>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ng-container>

          <div *ngIf="userStats">
            <ion-grid class="statsGrid">
              <ion-row>
                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper tertiary">
                        <ion-icon name="person-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.topicsAsSubject }}</div>
                      <div class="statLabel">{{ (userStats.topicsAsSubject === 1 ? 'PROFILE.STATS.TOPIC_AS_SUBJECT_ONE' : 'PROFILE.STATS.TOPIC_AS_SUBJECT_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper success">
                        <ion-icon name="checkmark-done-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.questionsAnswered }}</div>
                      <div class="statLabel">{{ (userStats.questionsAnswered === 1 ? 'PROFILE.STATS.QUESTION_ANSWERED_ONE' : 'PROFILE.STATS.QUESTION_ANSWERED_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper secondary">
                        <ion-icon name="help-circle-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.questionsAsked }}</div>
                      <div class="statLabel">{{ (userStats.questionsAsked === 1 ? 'PROFILE.STATS.QUESTION_ASKED_ONE' : 'PROFILE.STATS.QUESTION_ASKED_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper primary">
                        <ion-icon name="mic-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.interventions }}</div>
                      <div class="statLabel">{{ (userStats.interventions === 1 ? 'PROFILE.STATS.INTERVENTION_ONE' : 'PROFILE.STATS.INTERVENTION_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper pink">
                        <ion-icon name="heart-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.appreciations }}</div>
                      <div class="statLabel">{{ (userStats.appreciations === 1 ? 'PROFILE.STATS.APPRECIATION_ONE' : 'PROFILE.STATS.APPRECIATION_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper pink">
                        <ion-icon name="heart"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.heartsReceived }}</div>
                      <div class="statLabel">{{ (userStats.heartsReceived === 1 ? 'PROFILE.STATS.HEART_RECEIVED_ONE' : 'PROFILE.STATS.HEART_RECEIVED_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper warning">
                        <ion-icon name="thumbs-up-outline"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.upvotesReceived }}</div>
                      <div class="statLabel">{{ (userStats.upvotesReceived === 1 ? 'PROFILE.STATS.UPVOTE_RECEIVED_ONE' : 'PROFILE.STATS.UPVOTE_RECEIVED_MANY') | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <ion-col size="6">
                  <ion-card class="statCard">
                    <ion-card-content>
                      <div class="statIconWrapper clap">
                        <ion-icon icon="assets/icons/clap.svg"></ion-icon>
                      </div>
                      <div class="statValue">{{ userStats.applauseReceived }}</div>
                      <div class="statLabel">{{ 'PROFILE.STATS.APPLAUSE_RECEIVED' | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </ng-container>
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
      .addBadgeTile {
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
        width: 90px;
        min-height: 90px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .addBadgeTile:hover {
        transform: scale(1.08);
      }
      .addBadgeButton {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        border: 2px dashed var(--ion-color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ion-color-primary);
        font-size: 24px;
        margin-bottom: 6px;
        transition: background-color 0.2s;
      }
      .addBadgeTile:hover .addBadgeButton {
        background-color: rgba(var(--ion-color-primary-rgb), 0.1);
      }
      .addBadgeTileLabel {
        font-size: 0.75em;
        font-weight: 500;
        color: var(--ion-color-primary);
        text-align: center;
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
      .profileSegmentContainer {
        margin: 12px 16px 4px;
      }
      .profileSegmentContainer ion-segment-button {
        text-transform: none;
      }
      .profileSegmentContainer ion-segment-button ion-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .segmentBadge {
        font-size: 0.72em;
        padding: 2px 6px;
        border-radius: 10px;
        line-height: 1.2;
      }
      .topicItem {
        --padding-start: 16px;
        --padding-end: 16px;
        cursor: pointer;
      }
      .topicMeta {
        font-size: 0.78em;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .eventName {
        color: var(--ion-color-medium);
        font-weight: 500;
      }
      .topicDate {
        color: var(--ion-color-medium);
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .topicDate ion-icon {
        font-size: 1.15em;
      }
      .topicBadges {
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .topicBadges ion-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72em;
        padding: 4px 7px;
        border-radius: 4px;
      }
      .noTopics {
        margin: 28px 16px;
        text-align: center;
      }
      .noTopics ion-icon {
        font-size: 40px;
        color: var(--ion-color-medium);
        margin: 0 auto 8px;
        display: block;
      }
      .noTopics p {
        color: var(--ion-color-medium);
        font-size: 0.9em;
        margin: 0;
      }
      .statsGrid {
        padding: 4px 8px;
      }
      .statCard {
        margin: 6px;
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        border: 1px solid var(--ion-color-light-shade, #f0f0f0);
        text-align: center;
        transition: transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        height: calc(100% - 12px);
      }
      .statCard:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .statCard ion-card-content {
        padding: 14px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .statCardFull ion-card-content.horizontalStat {
        flex-direction: row;
        gap: 16px;
        text-align: left;
        padding: 12px 18px;
        justify-content: flex-start;
      }
      .horizontalStatText {
        display: flex;
        flex-direction: column;
      }
      .statIconWrapper {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        margin-bottom: 8px;
      }
      .statCardFull .statIconWrapper {
        margin-bottom: 0;
        min-width: 40px;
      }
      .statIconWrapper.primary {
        background-color: rgba(var(--ion-color-primary-rgb), 0.12);
        color: var(--ion-color-primary);
      }
      .statIconWrapper.secondary {
        background-color: rgba(var(--ion-color-secondary-rgb), 0.12);
        color: var(--ion-color-secondary);
      }
      .statIconWrapper.tertiary {
        background-color: rgba(var(--ion-color-tertiary-rgb), 0.12);
        color: var(--ion-color-tertiary);
      }
      .statIconWrapper.pink {
        background-color: rgba(236, 0, 140, 0.12);
        color: #ec008c;
      }
      .statIconWrapper.clap {
        background-color: rgba(236, 0, 140, 0.12);
        color: #ec008c;
      }
      .statIconWrapper.clap ion-icon {
        font-size: 20px;
      }
      .statIconWrapper.warning {
        background-color: rgba(var(--ion-color-warning-rgb), 0.15);
        color: var(--ion-color-warning-shade);
      }
      .statIconWrapper.success {
        background-color: rgba(var(--ion-color-success-rgb), 0.12);
        color: var(--ion-color-success);
      }
      .statValue {
        font-size: 1.6em;
        font-weight: 700;
        line-height: 1.1;
        margin-bottom: 4px;
        color: var(--ion-text-color, #111);
      }
      .statLabel {
        font-size: 0.78em;
        color: var(--ion-color-medium);
        font-weight: 500;
        line-height: 1.2;
      }
      .statSubLabel {
        font-size: 0.72em;
        color: var(--ion-color-secondary-shade, #0bb8cc);
        margin-top: 3px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .statSubLabel ion-icon {
        font-size: 1.15em;
      }
      .statIconSkeleton {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        margin-bottom: 8px;
      }
      .statValueSkeleton {
        width: 40px;
        height: 22px;
        border-radius: 4px;
        margin-bottom: 6px;
      }
      .statLabelSkeleton {
        width: 80px;
        height: 12px;
        border-radius: 4px;
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

  activeSegment: 'profile' | 'qa' | 'stats' = 'profile';
  userTopics: {
    topic: Topic;
    isSpeaker: boolean;
    askedCount: number;
    answeredCount: number;
    interventionsCount: number;
    appreciationsCount: number;
  }[] | null = null;
  userStats: {
    topicsAsSubject: number;
    questionsAsked: number;
    questionsAnswered: number;
    interventions: number;
    appreciations: number;
    heartsReceived: number;
    upvotesReceived: number;
    applauseReceived: number;
  } | null = null;
  loadingTopics = false;
  TopicTypes = TopicTypes;

  version = env.idea.app.version;

  private _popover = inject(PopoverController);
  private _modalCtrl = inject(ModalController);
  private _loading = inject(IDEALoadingService);
  private _message = inject(IDEAMessageService);
  private _t = inject(IDEATranslationsService);
  private _api = inject(IDEAApiService);
  _badges = inject(BadgesService);
  _app = inject(AppService);
  private _users = inject(UsersService);
  private _topics = inject(TopicsService);
  private _questions = inject(QuestionsService);

  async ngOnInit(): Promise<void> {
    await this._badges.getList();
    await this.refreshUserAndBadges();
  }

  async ngOnChanges(): Promise<void> {
    this.userTopics = null;
    this.userStats = null;
    await this.refreshUserAndBadges();
  }

  private async refreshUserAndBadges(): Promise<void> {
    this.resolveUserInfo();
    if (this.userId) {
      if (!this.avatarURL || this.name === this.userId || !this.origin) {
        const found = await this._users.getById(this.userId);
        if (found) {
          if (!this.avatarURL && found.avatarURL) this.avatarURL = found.avatarURL;
          const resolvedName = [found.firstName, found.lastName].filter(Boolean).join(' ') || (found as any).name;
          if ((!this.name || this.name === this.userId) && resolvedName) {
            this.name = resolvedName;
          }
          if (!this.origin && found.getOrigin) {
            this.origin = found.getOrigin(this._app.configurations?.usersOriginDisplay);
          } else if (!this.origin) {
            this.origin = [found.country, found.section].filter(Boolean).join(' - ') || null;
          }
        }
      }
      this.userBadges = await this._badges.getListOfUserById(this.userId);
      if (!this._app.configurations?.hideQATopics) {
        this.ensureUserTopicsLoaded();
      }
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

    if (this._app.configurations?.hideQATopics && this.activeSegment !== 'profile') {
      this.activeSegment = 'profile';
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

  async assignBadge(): Promise<void> {
    if (!this.userId) return;
    const targetUserId = this.userId.toLowerCase();

    const customBadges = await this._badges.getList();
    const builtInBadges = Object.keys(BuiltInBadges).map(
      badge =>
        new Badge({
          badgeId: badge,
          name: this._t._('BADGES.BUILT_IN_BADGES.'.concat(badge)),
          description: this._t._('BADGES.BUILT_IN_BADGES_I.'.concat(badge))
        })
    );
    const data = [...builtInBadges, ...(customBadges || [])]
      .map(
        badge =>
          new Suggestion({
            value: badge.badgeId,
            name: badge.name,
            description: badge.description,
            category1: Badge.isBuiltIn(badge.badgeId)
              ? this._t._('BADGES.BUILT_IN_BADGE')
              : this._t._('BADGES.CUSTOM_BADGE')
          })
      )
      .filter(x => !this.userBadges?.some(ub => ub.badge === x.value));

    const componentProps = {
      data,
      sortData: true,
      searchPlaceholder: this._t._('BADGES.GIVE_A_BADGE'),
      hideIdFromUI: true,
      hideClearButton: true
    };
    const modal = await this._modalCtrl.create({ component: IDEASuggestionsComponent, componentProps });
    await modal.present();
    const { data: modalResult } = await modal.onDidDismiss();
    const badge = modalResult?.value;
    if (!badge) return;

    try {
      await this._loading.show();
      await this._badges.addBadgeToUser(targetUserId, badge);
      await this.refreshUserAndBadges();
      this._message.success('COMMON.OPERATION_COMPLETED');
    } catch (error) {
      this._message.error('COMMON.OPERATION_FAILED');
    } finally {
      this._loading.hide();
    }
  }

  segmentChanged(): void {
    if (this.activeSegment === 'qa' || this.activeSegment === 'stats') {
      this.ensureUserTopicsLoaded();
    }
  }

  ensureUserTopicsLoaded(): void {
    if (this.userStats === null && !this.loadingTopics) {
      this.loadUserTopics();
    }
  }

  async loadUserTopics(): Promise<void> {
    if (!this.userId || this.loadingTopics) return;
    this.loadingTopics = true;
    const targetId = this.userId.toLowerCase();

    try {
      const active = (await this._topics.getActiveList()) || [];
      let archived: Topic[] = [];
      try {
        archived = (await this._topics.getArchivedList()) || [];
      } catch (_) {}

      const allTopics = [...active, ...archived];
      const activityMap = new Map<
        string,
        {
          topic: Topic;
          isSpeaker: boolean;
          askedCount: number;
          answeredCount: number;
          interventionsCount: number;
          appreciationsCount: number;
        }
      >();

      let topicsAsSubjectCount = 0;
      for (const t of allTopics) {
        const isSubject = !!(t.subjects && t.subjects.some(s => s.id?.toLowerCase() === targetId));
        if (isSubject) {
          topicsAsSubjectCount++;
          activityMap.set(t.topicId, {
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

      const topicsWithQuestions = active.filter(
        t => (t.numOfQuestions && t.numOfQuestions > 0) || t.type === TopicTypes.LIVE
      );

      await Promise.all(
        topicsWithQuestions.map(async t => {
          try {
            if (t.type === TopicTypes.LIVE) {
              const messages: Message[] = await this._api.getResource(['topics', t.topicId, 'messages']);
              if (messages && messages.length) {
                let userInterventions = 0;
                let userAppreciations = 0;

                for (const m of messages) {
                  if (m.creator?.id?.toLowerCase() === targetId) {
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
                      topic: t,
                      isSpeaker: false,
                      askedCount: 0,
                      answeredCount: 0,
                      interventionsCount: userInterventions,
                      appreciationsCount: userAppreciations
                    });
                  }
                }
              }
            } else {
              const questions: Question[] = await this._api.getResource(['topics', t.topicId, 'questions']);
              if (questions && questions.length) {
                const isSubjectInTopic = t.subjects && t.subjects.some(s => s.id?.toLowerCase() === targetId);
                let userQuestionsCount = 0;
                let topicAnsweredCount = 0;
                for (const q of questions) {
                  const isCreator = q.creator?.id?.toLowerCase() === targetId;
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
            }
          } catch (_) {}
        })
      );

      this.userTopics = Array.from(activityMap.values()).sort((a, b) =>
        (b.topic.createdAt || '').localeCompare(a.topic.createdAt || '')
      );

      this.userStats = {
        topicsAsSubject: topicsAsSubjectCount,
        questionsAsked: totalQuestionsAsked,
        questionsAnswered: totalQuestionsAnswered,
        interventions: totalInterventions,
        appreciations: totalAppreciations,
        heartsReceived: totalHeartsReceived,
        upvotesReceived: totalUpvotesReceived,
        applauseReceived: totalApplauseReceived
      };
    } catch (_) {
      this.userTopics = [];
      this.userStats = {
        topicsAsSubject: 0,
        questionsAsked: 0,
        questionsAnswered: 0,
        interventions: 0,
        appreciations: 0,
        heartsReceived: 0,
        upvotesReceived: 0,
        applauseReceived: 0
      };
    } finally {
      this.loadingTopics = false;
    }
  }

  getTopicDate(topic?: Topic): string {
    if (!topic) return '';
    return topic.type === TopicTypes.LIVE && topic.shouldBeLiveAt ? topic.shouldBeLiveAt : topic.createdAt;
  }

  openTopic(topic: Topic): void {
    if (this.isModal) {
      this._modalCtrl.dismiss();
    }
    this._app.goToInTabs(['topics', topic.topicId, topic.type === TopicTypes.LIVE ? 'live' : 'standard']);
  }
}
