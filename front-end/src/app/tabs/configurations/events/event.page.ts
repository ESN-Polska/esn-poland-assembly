import { Component, Input } from '@angular/core';
import { Location } from '@angular/common';
import { AlertController, ModalController } from '@ionic/angular';
import { Suggestion } from 'idea-toolbox';
import {
  IDEALoadingService,
  IDEAMessageService,
  IDEASuggestionsComponent,
  IDEATranslationsService
} from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { GAEventsService } from './events.service';
import { BadgesService } from '../badges/badges.service';

import { GAEvent } from '@models/event.model';
import { Badge } from '@models/badge.model';

@Component({
  selector: 'event',
  templateUrl: 'event.page.html',
  styleUrls: ['event.page.scss']
})
export class EventPage {
  @Input() eventId = 'new';
  event: GAEvent;

  badgeDetail: {
    badgeId: string;
    name: string;
    description: string;
    imageURL: string;
    isBuiltIn: boolean;
  } | null = null;

  editMode = UXMode.VIEW;
  UXMode = UXMode;
  errors = new Set<string>();
  entityBeforeChange: GAEvent;

  constructor(
    private location: Location,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private loading: IDEALoadingService,
    private message: IDEAMessageService,
    private t: IDEATranslationsService,
    private _events: GAEventsService,
    public _badges: BadgesService,
    public app: AppService
  ) {}
  async ionViewWillEnter(): Promise<void> {
    try {
      await this.loading.show();
      if (this.eventId !== 'new') {
        this.event = await this._events.getById(this.eventId);
        this.editMode = UXMode.VIEW;
      } else {
        this.event = new GAEvent();
        this.editMode = UXMode.INSERT;
      }
      await this.loadBadgeDetail();
    } catch (error) {
      this.message.error('COMMON.NOT_FOUND');
    } finally {
      this.loading.hide();
    }
  }

  async loadBadgeDetail(): Promise<void> {
    if (this.event?.engagementBadge) {
      this.badgeDetail = await this._badges.getBadgeDetail(this.event.engagementBadge);
    } else {
      this.badgeDetail = null;
    }
  }

  async selectEngagementBadge(): Promise<void> {
    try {
      await this.loading.show();
      const customBadges: Badge[] = await this._badges.getList({ force: true });
      this.loading.hide();

      if (!customBadges || customBadges.length === 0) {
        this.message.error('EVENTS.NO_CUSTOM_BADGES_AVAILABLE');
        return;
      }

      const data = customBadges.map(
        b =>
          new Suggestion({
            value: b.badgeId,
            name: b.name,
            description: b.description,
            category1: this.t._('BADGES.CUSTOM_BADGE')
          })
      );

      const componentProps = {
        data,
        sortData: true,
        searchPlaceholder: this.t._('EVENTS.SELECT_ENGAGEMENT_BADGE'),
        hideIdFromUI: true,
        hideClearButton: true
      };

      const modal = await this.modalCtrl.create({ component: IDEASuggestionsComponent, componentProps });
      modal.onDidDismiss().then(async ({ data }): Promise<void> => {
        const badgeId = data?.value;
        if (!badgeId) return;
        this.event.engagementBadge = badgeId;
        await this.loadBadgeDetail();
      });
      await modal.present();
    } catch (err) {
      this.loading.hide();
      this.message.error('COMMON.SOMETHING_WENT_WRONG');
    }
  }

  removeEngagementBadge(): void {
    delete this.event.engagementBadge;
    this.badgeDetail = null;
  }

  async save(): Promise<void> {
    this.errors = new Set(this.event.validate());
    if (this.errors.size) return this.message.error('COMMON.FORM_HAS_ERROR_TO_CHECK');

    try {
      await this.loading.show();
      let result: GAEvent;
      if (this.editMode === UXMode.INSERT) result = await this._events.insert(this.event);
      else result = await this._events.update(this.event);
      this.event.load(result);
      await this.loadBadgeDetail();
      this.location.replaceState(this.location.path().replace('/new', '/'.concat(this.event.eventId)));
      this.editMode = UXMode.VIEW;
      this.message.success('COMMON.OPERATION_COMPLETED');
    } catch (err) {
      this.message.error('COMMON.OPERATION_FAILED');
    } finally {
      this.loading.hide();
    }
  }
  hasFieldAnError(field: string): boolean {
    return this.errors.has(field);
  }

  async archiveEvent(archive = true): Promise<void> {
    const doArchive = async (): Promise<void> => {
      try {
        await this.loading.show();
        if (archive) await this._events.archive(this.event);
        else await this._events.unarchive(this.event);
        this.message.success('COMMON.OPERATION_COMPLETED');
        this.app.closePage();
      } catch (error) {
        this.message.error('COMMON.OPERATION_FAILED');
      } finally {
        this.loading.hide();
      }
    };
    const header = this.t._('COMMON.ARE_YOU_SURE');
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.CONFIRM'), role: 'destructive', handler: doArchive }
    ];
    const alert = await this.alertCtrl.create({ header, buttons });
    alert.present();
  }
  async deleteEvent(): Promise<void> {
    const doDelete = async (): Promise<void> => {
      try {
        await this.loading.show();
        await this._events.delete(this.event);
        this.message.success('COMMON.OPERATION_COMPLETED');
        this.app.closePage();
      } catch (error) {
        if (error.message === 'Event is used') this.message.error('EVENTS.CANT_DELETE_IF_USED_ERROR');
        else this.message.error('COMMON.OPERATION_FAILED');
      } finally {
        this.loading.hide();
      }
    };
    const header = this.t._('COMMON.ARE_YOU_SURE');
    const subHeader = this.t._('COMMON.ACTION_IS_IRREVERSIBLE');
    const message = this.t._('EVENTS.CANT_DELETE_IF_USED_WARNING');
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.DELETE'), role: 'destructive', handler: doDelete }
    ];
    const alert = await this.alertCtrl.create({ header, subHeader, message, buttons });
    alert.present();
  }

  enterEditMode(): void {
    this.entityBeforeChange = new GAEvent(this.event);
    this.editMode = UXMode.EDIT;
  }
  exitEditMode(): void {
    if (this.editMode === UXMode.INSERT) this.app.closePage();
    else {
      this.event = this.entityBeforeChange;
      this.errors = new Set<string>();
      this.loadBadgeDetail();
      this.editMode = UXMode.VIEW;
    }
  }
}

export enum UXMode {
  VIEW,
  INSERT,
  EDIT
}
