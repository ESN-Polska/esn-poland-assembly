import { Component, Input, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IDEALoadingService, IDEATranslationsService } from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { VotingService } from '../voting.service';

import { VotingSession } from '@models/votingSession.model';
import { VotingTicket } from '@models/votingTicket.model';

@Component({
  selector: 'vote',
  templateUrl: 'vote.page.html',
  styleUrls: ['vote.page.scss']
})
export class VotePage implements OnInit {
  /**
   * The ID of session to voter for.
   */
  @Input() sessionId: string;
  /**
   * The ID of the voter.
   */
  @Input() voterId: string;
  /**
   * The ID of the ticket that allows the voter to vote.
   */
  @Input() ticket: string;

  votingSession: VotingSession;
  votingTicket: VotingTicket;

  errorString: string;
  errors = new Set<string>();

  submission: (number | number[])[] = [];
  voted = false;

  constructor(
    private alertCtrl: AlertController,
    private loading: IDEALoadingService,
    private t: IDEATranslationsService,
    private _voting: VotingService,
    public app: AppService
  ) {}
  async ngOnInit(): Promise<void> {
    try {
      await this.loading.show();
      const res = await this._voting.beginVote(this.sessionId, this.voterId, this.ticket);
      this.votingSession = res.votingSession;
      this.votingTicket = res.votingTicket;
      this.submission = this.votingSession.ballots.map(b => (b.isMultiple() ? [] : undefined));
    } catch (error) {
      if (String(error) === 'Error: Already voted') this.errorString = this.t._('VOTING.ALREADY_VOTED');
      else this.errorString = this.t._('VOTING.INVALID_VOTING_LINK');
    } finally {
      this.loading.hide();
    }
  }

  private async showMessage(message: string, header = this.t._('COMMON.ERROR')): Promise<void> {
    const buttons = [{ text: this.t._('COMMON.GOT_IT') }];
    const alert = await this.alertCtrl.create({ header, message, buttons });
    alert.present();
  }

  hasFieldAnError(field: string): boolean {
    return this.errors.has(field);
  }

  isOptionSelected(bIndex: number, oIndex: number): boolean {
    const sub = this.submission[bIndex];
    return Array.isArray(sub) && sub.includes(oIndex);
  }

  getSelectedCandidateCount(bIndex: number): number {
    const sub = this.submission[bIndex];
    if (!Array.isArray(sub)) return 0;
    const candidatesCount = this.votingSession.ballots[bIndex].options.length;
    return sub.filter(x => x < candidatesCount).length;
  }

  isNoneOfTheAboveSelected(bIndex: number): boolean {
    const sub = this.submission[bIndex];
    const noneIdx = this.votingSession.ballots[bIndex].getNoneOfTheAboveIndex();
    return Array.isArray(sub) && sub.includes(noneIdx);
  }

  isAbstainSelected(bIndex: number): boolean {
    const sub = this.submission[bIndex];
    const abstainIdx = this.votingSession.ballots[bIndex].getAbstainIndex();
    return Array.isArray(sub) && sub.includes(abstainIdx);
  }

  toggleCandidateOption(bIndex: number, oIndex: number, max: number): void {
    const noneIdx = this.votingSession.ballots[bIndex].getNoneOfTheAboveIndex();
    const abstainIdx = this.votingSession.ballots[bIndex].getAbstainIndex();
    let current: number[] = Array.isArray(this.submission[bIndex]) ? (this.submission[bIndex] as number[]) : [];
    if (current.includes(noneIdx) || current.includes(abstainIdx)) {
      current = [];
    }
    if (current.includes(oIndex)) {
      current = current.filter(x => x !== oIndex);
    } else {
      if (current.length < max) {
        current = [...current, oIndex];
      }
    }
    this.submission[bIndex] = current;
  }

  toggleNoneOfTheAbove(bIndex: number): void {
    const noneIdx = this.votingSession.ballots[bIndex].getNoneOfTheAboveIndex();
    if (this.isNoneOfTheAboveSelected(bIndex)) {
      this.submission[bIndex] = [];
    } else {
      this.submission[bIndex] = [noneIdx];
    }
  }

  toggleAbstain(bIndex: number): void {
    const abstainIdx = this.votingSession.ballots[bIndex].getAbstainIndex();
    if (this.isAbstainSelected(bIndex)) {
      this.submission[bIndex] = [];
    } else {
      this.submission[bIndex] = [abstainIdx];
    }
  }

  async submitVote(): Promise<void> {
    this.errors = new Set(this.votingSession.validateVoteSubmission(this.submission));
    if (this.errors.size) return this.showMessage(this.t._('VOTING.SOME_OF_VOTES_MISSING'));

    const doSubmit = async (): Promise<void> => {
      try {
        await this.loading.show();
        await this._voting.submitVotes(this.votingTicket, this.submission);
        this.voted = true;
      } catch (error) {
        if (String(error) === 'Error: Already voted') this.showMessage(this.t._('VOTING.ALREADY_VOTED'));
        else this.showMessage(this.t._('VOTING.SUBMISSION_FAILED'));
      } finally {
        this.loading.hide();
      }
    };

    const header = this.t._('VOTING.CONFIRM_YOUR_VOTES');
    const subHeader = this.t._('COMMON.ARE_YOU_SURE');
    const message = this.t._('VOTING.CANT_CHANGE_SUBMITTED_VOTES');
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('VOTING.SUBMIT_VOTES'), handler: doSubmit }
    ];
    const alert = await this.alertCtrl.create({ header, subHeader, message, buttons });
    alert.present();
  }
}
