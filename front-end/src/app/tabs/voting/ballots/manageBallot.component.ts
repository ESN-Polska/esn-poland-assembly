import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { IDEAMessageService, IDEAShowHintButtonModule, IDEATranslationsModule, IDEATranslationsService } from '@idea-ionic/common';

import { AppService } from '@app/app.service';

import { VotingBallot, VotingBallotTypes, VotingMajorityTypes } from '@models/votingSession.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule, IDEAShowHintButtonModule],
  selector: 'app-manage-ballot',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="medium">
        <ion-buttons slot="start">
          <ion-button [title]="'COMMON.CANCEL' | translate" (click)="close()">
            <ion-icon slot="icon-only" icon="close-circle"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ 'VOTING.MANAGE_BALLOT' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button [title]="'COMMON.SAVE' | translate" (click)="save()">
            <ion-icon slot="icon-only" icon="checkmark-circle"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list class="aList" lines="full">
        <ion-item [class.fieldHasError]="hasFieldAnError('text')">
          <ion-label position="stacked">
            {{ 'VOTING.BALLOT_TEXT' | translate }} <ion-text class="obligatoryDot" />
          </ion-label>
          <ion-input [(ngModel)]="ballot.text"></ion-input>
        </ion-item>
        <ion-item [class.fieldHasError]="hasFieldAnError('type')">
          <ion-label position="stacked">
            {{ 'VOTING.BALLOT_TYPE' | translate }} <ion-text class="obligatoryDot" />
          </ion-label>
          <ion-select interface="popover" [(ngModel)]="ballot.type" (ionChange)="onTypeChange()">
            <ion-select-option *ngFor="let bt of BallotTypes | keyvalue" [value]="bt.value">
              {{ 'VOTING.BALLOT_TYPES.' + bt.key | translate }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item *ngIf="ballot.isMultiple()" [class.fieldHasError]="hasFieldAnError('maxOptions')">
          <ion-label position="stacked">
            {{ 'VOTING.BALLOT_MAX_OPTIONS' | translate }} <ion-text class="obligatoryDot" />
          </ion-label>
          <ion-input type="number" [min]="2" [max]="ballot.options.length || 2" [(ngModel)]="ballot.maxOptions" />
          <idea-show-hint-button
            slot="end"
            class="ion-margin-top"
            [hint]="'VOTING.BALLOT_MAX_OPTIONS_HINT'"
            translate
          />
        </ion-item>
        <ion-item [class.fieldHasError]="hasFieldAnError('majorityType')">
          <ion-label position="stacked">
            {{ 'VOTING.BALLOT_MAJORITY' | translate }} <ion-text class="obligatoryDot" />
          </ion-label>
          <ion-select interface="popover" [(ngModel)]="ballot.majorityType">
            <ion-select-option *ngFor="let mt of MajorityTypes | keyvalue" [value]="mt.value">
              {{ 'VOTING.MAJORITY_TYPES.' + mt.key | translate }}
            </ion-select-option>
          </ion-select>
          <idea-show-hint-button
            slot="end"
            class="ion-margin-top"
            [hint]="'VOTING.MAJORITY_TYPES.' + ballot.majorityType"
            translate
          />
        </ion-item>
        <ion-item-divider [class.fieldHasError]="hasFieldAnError('options')">
          <ion-label>{{ 'VOTING.BALLOT_OPTIONS' | translate }} <ion-text class="obligatoryDot" /></ion-label>
          <ion-button slot="end" fill="clear" (click)="addOption()">{{ 'COMMON.ADD' | translate }}</ion-button>
        </ion-item-divider>
        <ion-item class="noElements" *ngIf="!ballot.options.length">
          <ion-label>{{ 'COMMON.NO_ELEMENTS' | translate }}</ion-label>
        </ion-item>
        <ion-reorder-group [disabled]="false" (ionItemReorder)="handleOptionsReorder($event)">
          <ion-item *ngFor="let option of ballot.options; let index = index; trackBy: trackByIndex">
            <ion-reorder slot="start"></ion-reorder>
            <ion-badge slot="start" color="light">{{ index + 1 }}</ion-badge>
            <ion-input [(ngModel)]="ballot.options[index]" />
            <ion-button slot="end" color="danger" fill="clear" (click)="removeOptionByIndex(index)">
              <ion-icon icon="trash-outline" slot="icon-only" />
            </ion-button>
          </ion-item>
        </ion-reorder-group>
        <ng-container *ngIf="ballot.isMultiple()">
          <ion-item>
            <ion-badge slot="start" color="light">{{ ballot.options.length + 1 }}</ion-badge>
            <ion-input readonly [value]="'VOTING.NONE_OF_THE_ABOVE' | translate" />
          </ion-item>
          <ion-item>
            <ion-badge slot="start" color="light">{{ ballot.options.length + 2 }}</ion-badge>
            <ion-input readonly [value]="'VOTING.ABSTAIN' | translate" />
          </ion-item>
        </ng-container>
        <ion-item *ngIf="!ballot.isMultiple()">
          <ion-badge slot="start" color="light">{{ ballot.options.length + 1 }}</ion-badge>
          <ion-input readonly [value]="'VOTING.ABSTAIN' | translate" />
        </ion-item>
      </ion-list>
    </ion-content>
  `
})
export class ManageBallotStandaloneComponent implements OnInit {
  /**
   * The voting ballot to manage.
   */
  @Input() ballot: VotingBallot;

  errors = new Set<string>();

  BallotTypes = VotingBallotTypes;
  MajorityTypes = VotingMajorityTypes;

  constructor(
    private modalCtrl: ModalController,
    private message: IDEAMessageService,
    private t: IDEATranslationsService,
    public app: AppService
  ) {}
  ngOnInit(): void {
    this.ballot = new VotingBallot(this.ballot);
  }

  hasFieldAnError(field: string): boolean {
    return this.errors.has(field);
  }

  onTypeChange(): void {
    if (this.ballot.isMultiple()) {
      if (!this.ballot.maxOptions || this.ballot.maxOptions < 2) {
        this.ballot.maxOptions = Math.min(2, Math.max(2, this.ballot.options.length || 2));
      }
      // Remove any option manually typed as "None of the above"
      const noneStr = this.t._('VOTING.NONE_OF_THE_ABOVE').toLowerCase();
      this.ballot.options = this.ballot.options.filter(
        x => x?.trim().toLowerCase() !== noneStr && x?.trim().toLowerCase() !== 'none of the above'
      );
    }
  }

  addOption(): void {
    this.ballot.options.push('');
  }
  handleOptionsReorder({ detail }): void {
    this.ballot.options = detail.complete(this.ballot.options);
  }
  removeOptionByIndex(index: number): void {
    this.ballot.options.splice(index, 1);
    if (this.ballot.isMultiple() && this.ballot.maxOptions > this.ballot.options.length) {
      this.ballot.maxOptions = Math.max(2, this.ballot.options.length);
    }
  }
  trackByIndex(index: number): number {
    return index;
  }

  async save(): Promise<void> {
    this.ballot.options = this.ballot.options.filter(x => x?.trim());
    if (this.ballot.isMultiple()) {
      if (!this.ballot.maxOptions || this.ballot.maxOptions < 2) {
        this.ballot.maxOptions = Math.min(2, Math.max(2, this.ballot.options.length));
      } else if (this.ballot.maxOptions > this.ballot.options.length) {
        this.ballot.maxOptions = Math.max(2, this.ballot.options.length);
      }
    }
    this.errors = new Set(this.ballot.validate());
    if (this.errors.size) return this.message.error('COMMON.FORM_HAS_ERROR_TO_CHECK');

    this.modalCtrl.dismiss(this.ballot);
  }
  close(): void {
    this.modalCtrl.dismiss();
  }
}
