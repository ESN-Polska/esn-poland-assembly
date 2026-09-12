import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { IDEATranslationsModule } from '@idea-ionic/common';

import {
  AppPermission,
  AutomaticRoleAssignment,
  CAS_PERMISSION_OPTIONS,
  CustomRole
} from '@models/configurations.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule],
  selector: 'app-role-editor',
  template: `
    <ion-header>
      <ion-toolbar color="ideaToolbar">
        <ion-buttons slot="start">
          <ion-button [title]="'COMMON.CLOSE' | translate" (click)="close()">
            <ion-icon icon="close-circle-outline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button [title]="'COMMON.SAVE' | translate" (click)="save()">
            <ion-icon icon="checkmark-circle-outline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list class="aList roleEditorList">
        <ion-list-header *ngIf="mode === 'custom'">
          <ion-label>
            <h2>{{ 'CONFIGURATIONS.ROLE_DETAILS' | translate }}</h2>
          </ion-label>
        </ion-list-header>
        <ion-item *ngIf="mode === 'custom'">
          <ion-label position="stacked">{{ 'CONFIGURATIONS.ROLE_NAME' | translate }}</ion-label>
          <ion-input [(ngModel)]="name" />
        </ion-item>
        <ion-item *ngIf="mode === 'custom'">
          <ion-label position="stacked">{{ 'CONFIGURATIONS.ROLE_USERS' | translate }}</ion-label>
          <ion-textarea
            [(ngModel)]="userIds"
            autoGrow="true"
            [placeholder]="'CONFIGURATIONS.ROLE_USERS_PLACEHOLDER' | translate"
          />
        </ion-item>

        <ion-list-header>
          <ion-label>
            <h2>{{ 'CONFIGURATIONS.CAS_PERMISSIONS' | translate }}</h2>
            <p>{{ 'CONFIGURATIONS.CAS_PERMISSIONS_I' | translate }}</p>
          </ion-label>
        </ion-list-header>
        <ion-item *ngFor="let permission of casPermissionOptions">
          <ion-checkbox slot="start" [(ngModel)]="selectedCASPermissions[permission]" />
          <ion-label class="ion-text-wrap">{{ permission }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label position="stacked">{{ 'CONFIGURATIONS.CUSTOM_CAS_PATTERNS' | translate }}</ion-label>
          <ion-textarea
            [(ngModel)]="customCASPermissions"
            autoGrow="true"
            [placeholder]="'CONFIGURATIONS.CUSTOM_CAS_PATTERNS_PLACEHOLDER' | translate"
          />
        </ion-item>

        <ion-list-header *ngIf="mode === 'custom'">
          <ion-label>
            <h2>{{ 'CONFIGURATIONS.APP_PERMISSIONS' | translate }}</h2>
            <p>{{ 'CONFIGURATIONS.APP_PERMISSIONS_I' | translate }}</p>
          </ion-label>
        </ion-list-header>
        <ng-container *ngIf="mode === 'custom'">
          <ion-item *ngFor="let permission of appPermissions">
            <ion-checkbox slot="start" [(ngModel)]="selectedAppPermissions[permission]" />
            <ion-label class="ion-text-wrap">{{ permission }}</ion-label>
          </ion-item>
        </ng-container>
      </ion-list>
    </ion-content>
  `,
  styles: [
    `
      .roleEditorList {
        max-width: 900px;
        margin: 0 auto;
      }
      ion-list-header {
        padding-top: 20px;
      }
      ion-item ion-label {
        white-space: normal;
      }
    `
  ]
})
export class RoleEditorComponent implements OnInit {
  @Input() mode: 'custom' | 'automatic';
  @Input() role: CustomRole;
  @Input() assignment: AutomaticRoleAssignment;
  @Input() roleId: string;

  readonly appPermissions = Object.values(AppPermission);
  readonly casPermissionOptions = CAS_PERMISSION_OPTIONS;
  selectedCASPermissions: Record<string, boolean> = {};
  selectedAppPermissions: Record<string, boolean> = {};
  name = '';
  userIds = '';
  customCASPermissions = '';

  get title(): string {
    if (this.mode === 'custom') return this.role ? 'Edit custom role' : 'Create custom role';
    return `Automatic ${this.roleId.toLowerCase().replace(/_/g, ' ')} assignment`;
  }

  constructor(private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.name = this.role?.name || '';
    this.userIds = this.role?.userIds?.join('\n') || '';
    const selectedCAS = this.role?.casPermissions || this.assignment?.casPermissions || [];
    selectedCAS.forEach(permission => (this.selectedCASPermissions[permission] = true));
    (this.role?.permissions || []).forEach(permission => (this.selectedAppPermissions[permission] = true));
    this.customCASPermissions = selectedCAS
      .filter(permission => !this.casPermissionOptions.includes(permission))
      .join('\n');
  }

  save(): void {
    const casPermissions = [
      ...this.casPermissionOptions.filter(permission => this.selectedCASPermissions[permission]),
      ...this.customCASPermissions
        .split(/[\n,]/)
        .map(permission => permission.trim())
        .filter(Boolean)
    ].filter((permission, index, permissions) => permissions.indexOf(permission) === index);

    if (this.mode === 'automatic') {
      this.modalCtrl.dismiss({ casPermissions });
      return;
    }

    const permissions = this.appPermissions.filter(permission => this.selectedAppPermissions[permission]);
    this.modalCtrl.dismiss({
      role: {
        id: this.role?.id || `${Date.now()}`,
        name: this.name.trim(),
        userIds: this.userIds
          .split(/[\n,]/)
          .map(userId => userId.trim().toLowerCase())
          .filter(Boolean),
        permissions,
        casPermissions
      } as CustomRole
    });
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
