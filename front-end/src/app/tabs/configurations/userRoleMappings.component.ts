import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { IDEATranslationsModule } from '@idea-ionic/common';

import { AppService } from '@app/app.service';
import { UsersService } from '@app/common/users.service';
import { CAS_PERMISSION_OPTIONS } from '@models/configurations.model';
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
        <ion-item lines="none">
          <ion-checkbox slot="start" [(ngModel)]="inheritedOnly" (ionChange)="filterUsers()" />
          <ion-label>{{ 'CONFIGURATIONS.SHOW_CAS_ASSIGNED_ONLY' | translate }}</ion-label>
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
            <p>{{ user.userId }}<span *ngIf="user.section"> · {{ user.section }}</span></p>
            <p>{{ 'CONFIGURATIONS.LAST_LOGIN' | translate }}: {{ user.lastLoginAt | date: 'medium' }}</p>
            <p *ngFor="let source of getVisibleSources(user)">
              <strong>{{ source.roleName }}</strong> · {{ source.casPermission }}
            </p>
          </ion-label>
          <ion-button fill="clear" color="medium" slot="end" (click)="app.openUserProfileById(user.userId)">
            <ion-icon icon="open-outline" slot="icon-only" />
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  `
})
export class UserRoleMappingsComponent implements OnInit {
  users: User[];
  filteredUsers: User[] = [];
  search = '';
  selectedCasPermission = '';
  inheritedOnly = true;
  casPermissionOptions = CAS_PERMISSION_OPTIONS;

  constructor(
    private modalCtrl: ModalController,
    private usersService: UsersService,
    public app: AppService
  ) {}

  async ngOnInit(): Promise<void> {
    this.users = await this.usersService.getAll();
    this.filterUsers();
  }

  filterUsers(): void {
    const query = this.search.trim().toLowerCase();
    this.filteredUsers = (this.users || [])
      .filter(user => {
        const sources = user.roleAssignmentSources || [];
        const inheritedSources = sources.filter(source => source.casPermission !== 'manual');
        if (this.inheritedOnly && !inheritedSources.length) return false;
        if (!this.inheritedOnly && !sources.length) return false;
        if (this.selectedCasPermission && !inheritedSources.some(source => source.casPermission === this.selectedCasPermission)) {
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

  getVisibleSources(user: User): User['roleAssignmentSources'] {
    if (!this.inheritedOnly) return user.roleAssignmentSources || [];
    return (user.roleAssignmentSources || []).filter(source => source.casPermission !== 'manual');
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
