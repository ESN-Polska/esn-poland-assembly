import { Component, OnInit, inject } from '@angular/core';
import { IDEAApiService } from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { environment as env } from '@env';

interface GitHubContributor {
  login: string;
  html_url: string;
  avatar_url: string;
  contributions: number;
  type: string;
  name?: string | null;
}

@Component({
  selector: 'app-credits',
  templateUrl: './credits.page.html',
  styleUrls: ['./credits.page.scss']
})
export class CreditsPage implements OnInit {
  contributors: GitHubContributor[] = [];
  loading = true;
  failed = false;
  version = env.idea.app.version;

  private readonly api = inject(IDEAApiService);
  readonly app = inject(AppService);

  getContributionsURL(login: string): string {
    return `https://github.com/szycic/esn-poland-assembly/commits?author=${encodeURIComponent(login)}`;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.contributors = await this.api.getResource('contributors');
    } catch (_) {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }
}