import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { IDEATranslationsModule, IDEATranslationsService } from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { UsersService } from '@app/common/users.service';
import { Configurations } from '@models/configurations.model';
import { ConfigurationsService } from './configurations.service';
import { User } from '@models/user.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule],
  selector: 'app-user-role-mappings',
  template: `
    <ion-header>
      <ion-toolbar color="ideaToolbar">
        <ion-buttons slot="start">
          <ion-button [title]="'COMMON.CLOSE' | translate" (click)="close()">
            <ion-icon icon="close-circle-outline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ 'CONFIGURATIONS.CAS_MATCHED_USERS' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            [title]="'CONFIGURATIONS.REFRESH_ROLE_MAPPINGS' | translate"
            [disabled]="loading"
            (click)="refresh()"
          >
            <ion-icon icon="refresh-outline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [(ngModel)]="search"
          (ionInput)="filterUsers()"
          [placeholder]="'CONFIGURATIONS.SEARCH_USERS' | translate"
        />
      </ion-toolbar>
      <ion-toolbar>
        <ion-item lines="none">
          <ion-label>{{ 'CONFIGURATIONS.FILTER_CAS_PERMISSION' | translate }}</ion-label>
          <ion-select interface="popover" [(ngModel)]="selectedCasPermission" (ionChange)="filterUsers()">
            <ion-select-option value="">{{ 'COMMON.ALL' | translate }}</ion-select-option>
            <ion-select-option *ngFor="let permission of casPermissionOptions" [value]="permission">
              {{ permission }}
            </ion-select-option>
          </ion-select>
        </ion-item>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list class="aList">
        <ion-item *ngIf="!users">
          <ion-label><ion-skeleton-text animated /></ion-label>
        </ion-item>
        <ion-item class="noElements" *ngIf="users && !filteredUsers.length">
          <ion-label>{{ 'CONFIGURATIONS.NO_CAS_MATCHED_USERS' | translate }}</ion-label>
        </ion-item>
        <ion-item *ngFor="let user of filteredUsers">
          <ion-label class="ion-text-wrap">
            <h2>{{ getUserDisplayName(user) }}</h2>
            <p>
              {{ user.userId }}
              <span *ngIf="user.country"> · {{ user.country }}</span>
              <span *ngIf="user.section"> · {{ user.section }}</span>
            </p>
            <p>{{ 'CONFIGURATIONS.LAST_LOGIN' | translate }}: {{ getLastLoginLabel(user.lastLoginAt) }}</p>
            <span class="matchedRolesLabel">{{ 'CONFIGURATIONS.MATCHED_ROLES' | translate }}:</span>
            <p *ngFor="let source of getInheritedSources(user)">
              {{ source.matchedExtendedRole }}<span *ngIf="source.roleName"> -&gt; {{ source.roleName }}</span>
            </p>
          </ion-label>
          <ion-button fill="clear" color="medium" slot="end" (click)="app.openUserProfileById(user.userId)">
            <ion-icon icon="open-outline" slot="icon-only" />
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [
    `
      .matchedRolesLabel {
        display: block;
        font-weight: 500;
        margin-top: 8px;
      }
    `
  ]
})
export class UserRoleMappingsComponent implements OnInit {
  users: User[];
  filteredUsers: User[] = [];
  search = '';
  selectedCasPermission = '';
  casPermissionOptions: string[] = [];
  loading = false;

  constructor(
    private modalCtrl: ModalController,
    private usersService: UsersService,
    private configurationsService: ConfigurationsService,
    private t: IDEATranslationsService,
    public app: AppService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [users, configurations] = await Promise.all([
        this.usersService.getAll(),
        this.configurationsService.get()
      ]);
      this.users = users;
      this.setCasPermissionOptions(configurations);
      this.filterUsers();
    } finally {
      this.loading = false;
    }
  }

  private setCasPermissionOptions(configurations: Configurations): void {
    this.casPermissionOptions = Array.from(
      new Set(
        configurations.customRoles.reduce(
          (permissions, role) => [...permissions, ...role.extendedRolePatterns],
          [] as string[]
        )
      )
    ).sort();
    if (this.selectedCasPermission && !this.casPermissionOptions.includes(this.selectedCasPermission)) {
      this.selectedCasPermission = '';
    }
  }

  filterUsers(): void {
    const query = this.search.trim().toLowerCase();
    this.filteredUsers = (this.users || [])
      .filter(user => {
        const sources = user.roleAssignmentSources || [];
        const inheritedSources = sources.filter(source => source.matchedExtendedRole !== 'manual');
        if (!inheritedSources.length) return false;
        if (this.selectedCasPermission && !inheritedSources.some(source => source.matchedExtendedRole === this.selectedCasPermission)) {
          return false;
        }
        return true;
      })
      .filter(user => {
        if (!query) return true;
        return [user.userId, user.firstName, user.lastName, user.section]
          .filter(value => !!value)
          .some(value => value.toLowerCase().includes(query));
      });
  }

  getUserDisplayName(user: User): string {
    return [user.firstName, user.lastName].filter(value => !!value).join(' ') || user.userId;
  }

  getInheritedSources(user: User): User['roleAssignmentSources'] {
    return (user.roleAssignmentSources || []).filter(source => source.matchedExtendedRole !== 'manual');
  }

  getLastLoginLabel(lastLoginAt: string): string {
    if (!lastLoginAt) return this.t._('CONFIGURATIONS.NEVER');
    const elapsedMilliseconds = Math.max(0, Date.now() - new Date(lastLoginAt).getTime());
    const elapsedMinutes = Math.floor(elapsedMilliseconds / 60000);
    if (elapsedMinutes < 1) return this.t._('CONFIGURATIONS.JUST_NOW');
    if (elapsedMinutes < 60) return this.t._('CONFIGURATIONS.MINUTES_AGO', { count: elapsedMinutes });
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours <= 24) return this.t._('CONFIGURATIONS.HOURS_AGO', { count: elapsedHours });
    return new Date(lastLoginAt).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
