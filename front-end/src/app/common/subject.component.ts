import { Component, Input } from '@angular/core';

import { AppService } from '@app/app.service';

import { Subject, SubjectTypes } from '@models/subject.model';

@Component({
  selector: 'app-subject',
  templateUrl: 'subject.component.html',
  styleUrls: ['subject.component.scss']
})
export class SubjectComponent {
  /**
   * The subject to show.
   */
  @Input() subject: Subject;
  /**
   * The color of the item.
   */
  @Input() color: string;
  /**
   * The lines attribute of the item.
   */
  @Input() lines: string;
  /**
   * The size for the component.
   */
  @Input() size: 'default' | 'small' = 'default';

  SubjectTypes = SubjectTypes;

  constructor(public app: AppService) {}

  async openSubject(event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!this.subject?.id) return;
    if (!this.subject.type || this.subject.type === SubjectTypes.USER) {
      await this.app.openUserProfile(this.subject);
    } else {
      const url = this.subject.getURL();
      await this.app.openURL(url);
    }
  }

  async openOnESNAccounts(): Promise<void> {
    await this.openSubject();
  }
}
