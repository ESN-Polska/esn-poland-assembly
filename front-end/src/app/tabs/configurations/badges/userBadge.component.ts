import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, IonicModule, PopoverController } from '@ionic/angular';
import { IDEALoadingService, IDEAMessageService, IDEATranslationsModule, IDEATranslationsService } from '@idea-ionic/common';

import { DateTimezonePipe } from '@common/dateTimezone.pipe';

import { AppService } from '@app/app.service';
import { BadgesService } from './badges.service';

import { Badge, UserBadge } from '@models/badge.model';

@Component({
  standalone: true,
  imports: [CommonModule, IonicModule, IDEATranslationsModule, DateTimezonePipe],
  selector: 'app-user-badge',
  template: `
    <ion-card color="white" *ngIf="badge && userBadge">
      <ion-card-header>
        <ion-card-subtitle *ngIf="!userBadge.firstSeenAt && isOwner">
          <ion-item color="primary">
            <ion-label class="ion-text-wrap ion-text-center">{{ 'BADGES.YOU_EARNED_A_BADGE' | translate }}</ion-label>
          </ion-item>
        </ion-card-subtitle>
        <ion-card-title class="ion-text-center">{{ badge.name }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p class="ion-text-center">{{ badge.description }}</p>
        <ion-img
          [src]="_badges.getImageURLOfUserBadge(userBadge)"
          (ionError)="_badges.fallbackBadgeImage($event?.target)"
        />
        <p class="ion-text-center ion-padding-bottom">
          <ion-badge color="light">
            {{ 'BADGES.BADGE_EARNED' | translate }}: {{ userBadge.earnedAt | dateTz }}
          </ion-badge>
        </p>
        <p class="ion-text-center" *ngIf="isOwner">
          <ion-button
            *ngIf="!userBadge.selected"
            expand="block"
            color="primary"
            [disabled]="isBusy"
            (click)="toggleSelectBadge(true)"
          >
            <ion-icon name="ribbon-outline" slot="start"></ion-icon>
            {{ 'BADGES.DISPLAY_ON_QUESTIONS' | translate }}
          </ion-button>
          <ion-button
            *ngIf="userBadge.selected"
            expand="block"
            fill="outline"
            color="danger"
            [disabled]="isBusy"
            (click)="toggleSelectBadge(false)"
          >
            <ion-icon name="close-circle-outline" slot="start"></ion-icon>
            {{ 'BADGES.REMOVE_FROM_QUESTIONS' | translate }}
          </ion-button>
        </p>
        <p class="ion-text-center" *ngIf="_app.user?.isAdministrator">
          <ion-button
            fill="clear"
            color="danger"
            [disabled]="isBusy"
            (click)="removeBadge()"
          >
            <ion-icon name="trash-outline" slot="start"></ion-icon>
            {{ 'COMMON.DELETE' | translate }}
          </ion-button>
        </p>
        <p class="ion-text-center">
          <ion-button fill="clear" color="medium" (click)="close()">
            {{ 'COMMON.CLOSE' | translate }}
          </ion-button>
        </p>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      ion-card-subtitle {
        margin-top: 15px;
        margin-bottom: 30px;
      }
      ion-card-subtitle ion-item {
        border-radius: 4px;
      }
      ion-card-subtitle ion-item ion-label {
        font-weight: 500;
      }
      ion-card-title {
        margin-top: 15px;
        font-size: 1.8em;
      }
      ion-img {
        margin: 30px auto;
        height: 220px;
        width: 220px;
      }
    `
  ]
})
export class UserBadgeComponent implements OnInit {
  /**
   * The user's badge to show.
   */
  @Input() userBadge: UserBadge;

  badge: Badge;
  isOwner = false;
  isBusy = false;

  private _popover = inject(PopoverController);
  private _alertCtrl = inject(AlertController);
  private _t = inject(IDEATranslationsService);
  private _loading = inject(IDEALoadingService);
  private _message = inject(IDEAMessageService);
  _badges = inject(BadgesService);
  _app = inject(AppService);

  async ngOnInit(): Promise<void> {
    this.isOwner = !!(
      this.userBadge.userId &&
      this._app.user?.userId &&
      this.userBadge.userId.toLowerCase() === this._app.user.userId.toLowerCase()
    );

    if (this.isOwner) {
      await this._badges.markUserBadgeAsSeen(this.userBadge.badge);
    }

    this.badge = Badge.isBuiltIn(this.userBadge.badge)
      ? new Badge({
          badgeId: this.userBadge.badge,
          name: this._t._('BADGES.BUILT_IN_BADGES.'.concat(this.userBadge.badge)),
          description: this._t._('BADGES.BUILT_IN_BADGES_I.'.concat(this.userBadge.badge))
        })
      : this._badges.getDetailOfUserBadge(this.userBadge);
    if (!this.badge) this.badge = new Badge({ badgeId: 'NOT_FOUND', name: this._t._('COMMON.NOT_FOUND') });
  }

  async toggleSelectBadge(select: boolean): Promise<void> {
    try {
      this.isBusy = true;
      await this._loading.show();
      if (select) {
        await this._badges.selectBadge(this.userBadge.badge);
        this.userBadge.selected = true;
        this._message.success('BADGES.BADGE_SELECTED_SUCCESS');
      } else {
        await this._badges.deselectBadge(this.userBadge.badge);
        this.userBadge.selected = false;
        this._message.success('BADGES.BADGE_DESELECTED_SUCCESS');
      }
      this._popover.dismiss({ updated: true });
    } catch (error) {
      this._message.error('COMMON.OPERATION_FAILED');
    } finally {
      this.isBusy = false;
      await this._loading.hide();
    }
  }

  async removeBadge(): Promise<void> {
    if (!this.userBadge?.userId || !this.userBadge?.badge) return;

    const doRemove = async (): Promise<void> => {
      try {
        this.isBusy = true;
        await this._loading.show();
        await this._badges.removeBadgeFromUser(this.userBadge.userId, this.userBadge.badge);
        this._message.success('COMMON.OPERATION_COMPLETED');
        this._popover.dismiss({ updated: true });
      } catch (error) {
        this._message.error('COMMON.OPERATION_FAILED');
      } finally {
        this.isBusy = false;
        await this._loading.hide();
      }
    };

    const header = this._t._('COMMON.ARE_YOU_SURE');
    const buttons = [
      { text: this._t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this._t._('COMMON.CONFIRM'), role: 'destructive', handler: doRemove }
    ];
    const alert = await this._alertCtrl.create({ header, buttons });
    await alert.present();
  }

  close(): void {
    this._popover.dismiss();
  }
}
