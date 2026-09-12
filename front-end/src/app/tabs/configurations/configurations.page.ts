import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonInfiniteScroll, IonSearchbar, IonSelect, ModalController } from '@ionic/angular';
import { IDEALoadingService, IDEAMessageService, IDEATranslationsService } from '@idea-ionic/common';

import { EmailTemplateComponent } from './emailTemplate/emailTemplate.component';
import { GiveBadgesComponent } from './badges/giveBadges.component';
import { ManageBadgesComponent } from './badges/manageBadges.component';
import { UserRoleMappingsComponent } from './userRoleMappings.component';
import { RoleEditorComponent } from './roleEditor.component';

import { AppService } from '@app/app.service';
import { ConfigurationsService } from './configurations.service';
import { BadgesService } from './badges/badges.service';
import { MediaService } from '@app/common/media.service';

import {
  AppPermission,
  Configurations,
  CustomRole,
  EmailTemplates,
  UsersOriginDisplayOptions
} from '@models/configurations.model';
import { Badge } from '@models/badge.model';

type UserListKey = 'administratorsIds' | 'opportunitiesManagersIds' | 'dashboardManagersIds' | 'bannedUsersIds';

@Component({
  selector: 'configurations',
  templateUrl: 'configurations.page.html',
  styleUrls: ['configurations.page.scss']
})
export class ConfigurationsPage implements OnInit {
  configurations!: Configurations;

  pageSection: PageSections | null = PageSections.CONTENTS;
  PageSections = PageSections;

  EmailTemplates = EmailTemplates;
  UODP = UsersOriginDisplayOptions;
  selectedCustomRoleId = '';

  timezones = (Intl as any).supportedValuesOf('timeZone');

  badges?: Badge[];

  @ViewChild('badgesSearchbar') badgesSearchbar!: IonSearchbar;
  @ViewChild('customRoleSelect') customRoleSelect!: IonSelect;

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loading: IDEALoadingService,
    private message: IDEAMessageService,
    private t: IDEATranslationsService,
    private _configurations: ConfigurationsService,
    private _media: MediaService,
    public _badges: BadgesService,
    public app: AppService
  ) {}
  async ngOnInit(): Promise<void> {
    this.configurations = await this._configurations.get();
    if (this.pageSection && !this.canAccessPageSection(this.pageSection)) {
      this.pageSection = this.canAccessPageSection(PageSections.CONTENTS)
        ? PageSections.CONTENTS
        : this.canAccessPageSection(PageSections.OPTIONS)
          ? PageSections.OPTIONS
          : this.canAccessPageSection(PageSections.USERS)
            ? PageSections.USERS
            : this.canAccessPageSection(PageSections.TEMPLATES)
              ? PageSections.TEMPLATES
              : this.canAccessPageSection(PageSections.USERS_BADGES)
                ? PageSections.USERS_BADGES
                : null;
    }
    if (!this.pageSection) return this.app.closePage('COMMON.UNAUTHORIZED');
    this.filterBadges('', undefined, true);
  }

  ionViewDidEnter(): void {
    setTimeout(() => this.resetCustomRoleSelector());
  }

  resetCustomRoleSelector(): void {
    this.selectedCustomRoleId = '';
    if (this.customRoleSelect) this.customRoleSelect.value = undefined;
  }

  canAccessPageSection(section: string): boolean {
    if (section === PageSections.CONTENTS) return this.app.user?.hasPermission(AppPermission.CONFIGURATIONS.CONTENTS);
    if (section === PageSections.OPTIONS) return this.app.user?.hasPermission(AppPermission.CONFIGURATIONS.OPTIONS);
    if (section === PageSections.USERS) return this.app.user?.hasPermission(AppPermission.CONFIGURATIONS.USERS);
    if (section === PageSections.USERS_BADGES) return this.app.user?.hasPermission(AppPermission.CONFIGURATIONS.BADGES);
    if (section === PageSections.TEMPLATES) return this.app.user?.hasPermission(AppPermission.CONFIGURATIONS.TEMPLATES);
    return false;
  }

  seeAsStandardUser(): void {
    this.app.seeAsStandardUser();
  }
  seeAsOpportunitiesManager(): void {
    this.app.seeAsOpportunitiesManager();
  }
  seeAsDashboardManager(): void {
    this.app.seeAsDashboardManager();
  }
  seeAsCustomRole(roleId: string): void {
    const role = this.configurations?.customRoles?.find(customRole => customRole.id === roleId);
    if (role) this.app.seeAsCustomRole(role);
    setTimeout(() => this.resetCustomRoleSelector());
  }

  async openUserRoleMappings(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: UserRoleMappingsComponent,
      cssClass: 'user-role-mappings-modal'
    });
    await modal.present();
  }

  addAdministrator(): void {
    this.addUserToList('administratorsIds', 'ADD_ADMINISTRATOR');
  }
  addOpportunitiesManager(): void {
    this.addUserToList('opportunitiesManagersIds', 'ADD_OPPORTUNITIES_MANAGER');
  }
  addDashboardManager(): void {
    this.addUserToList('dashboardManagersIds', 'ADD_DASHBOARD_MANAGER');
  }
  addBannedUser(): void {
    this.addUserToList('bannedUsersIds', 'ADD_BANNED_USER');
  }
  private async addUserToList(listKey: UserListKey, translationKey: string): Promise<void> {
    const doAdd = async ({ userId }: { userId?: string }): Promise<void> => {
      if (!userId) return;
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations[listKey].push(userId);
      await this.updateConfigurations(newConfigurations);
    };

    const header = this.t._('CONFIGURATIONS.'.concat(translationKey));
    const message = this.t._('CONFIGURATIONS.ADD_USERS_BY_THEIR_USERNAME');
    const inputs: any = [{ name: 'userId', type: 'text' }];
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.ADD'), handler: doAdd }
    ];

    const alert = await this.alertCtrl.create({ header, message, inputs, buttons });
    await alert.present();
  }

  removeAdministratorById(userId: string): void {
    this.removeUserFromListById(userId, 'administratorsIds');
  }
  removeOpportunitiesManagerById(userId: string): void {
    this.removeUserFromListById(userId, 'opportunitiesManagersIds');
  }
  removeDashboardManagerById(userId: string): void {
    this.removeUserFromListById(userId, 'dashboardManagersIds');
  }
  removeBannedUserById(userId: string): void {
    this.removeUserFromListById(userId, 'bannedUsersIds');
  }

  async addCustomRole(): Promise<void> {
    await this.manageCustomRole();
  }

  async manageCustomRole(role?: CustomRole): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: RoleEditorComponent,
      componentProps: { mode: 'custom', role },
      cssClass: 'role-editor-modal'
    });
    modal.onDidDismiss().then(({ data }): void => {
      if (!data?.role) return;
      const newRole = data.role as CustomRole;
      if (!newRole.name) return;
      const newConfigurations = new Configurations(this.configurations);
      const roleIndex = newConfigurations.customRoles.findIndex(existingRole => existingRole.id === newRole.id);
      if (roleIndex >= 0) newConfigurations.customRoles[roleIndex] = newRole;
      else newConfigurations.customRoles.push(newRole);
      this.updateConfigurations(newConfigurations);
    });
    await modal.present();
  }

  async manageAutomaticRole(roleId: 'ADMINISTRATOR' | 'OPPORTUNITIES_MANAGER' | 'DASHBOARD_MANAGER'): Promise<void> {
    const assignment = this.configurations.automaticRoleAssignments.find(item => item.roleId === roleId);
    const modal = await this.modalCtrl.create({
      component: RoleEditorComponent,
      componentProps: { mode: 'automatic', assignment, roleId },
      cssClass: 'role-editor-modal'
    });
    modal.onDidDismiss().then(({ data }): void => {
      if (!data) return;
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations.automaticRoleAssignments = newConfigurations.automaticRoleAssignments.filter(
        item => item.roleId !== roleId
      );
      if (data.extendedRolePatterns.length) {
        newConfigurations.automaticRoleAssignments.push({ roleId, extendedRolePatterns: data.extendedRolePatterns });
      }
      this.updateConfigurations(newConfigurations);
    });
    await modal.present();
  }

  getAutomaticRoleAssignmentCount(roleId: string): number {
    return this.configurations?.automaticRoleAssignments?.find(assignment => assignment.roleId === roleId)
      ?.extendedRolePatterns.length || 0;
  }

  async removeCustomRole(role: CustomRole): Promise<void> {
    const doRemove = async (): Promise<void> => {
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations.customRoles = newConfigurations.customRoles.filter(existingRole => existingRole.id !== role.id);
      await this.updateConfigurations(newConfigurations);
    };
    const alert = await this.alertCtrl.create({
      header: this.t._('COMMON.ARE_YOU_SURE'),
      buttons: [
        { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
        { text: this.t._('COMMON.REMOVE'), role: 'destructive', handler: doRemove }
      ]
    });
    await alert.present();
  }
  private async removeUserFromListById(userId: string, listKey: UserListKey): Promise<void> {
    const doRemove = async (): Promise<void> => {
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations[listKey].splice(newConfigurations[listKey].indexOf(userId), 1);
      await this.updateConfigurations(newConfigurations);
    };

    const header = this.t._('COMMON.ARE_YOU_SURE');
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.REMOVE'), role: 'destructive', handler: doRemove }
    ];
    const alert = await this.alertCtrl.create({ header, buttons });
    alert.present();
  }

  async updateConfigurations(newConfigurations: Configurations = this.configurations): Promise<void> {
    try {
      await this.loading.show();
      this.configurations = await this._configurations.update(newConfigurations);
      this.app.configurations.load(this.configurations);
      this.message.success('COMMON.OPERATION_COMPLETED');
    } catch (error) {
      this.message.error('COMMON.OPERATION_FAILED');
    } finally {
      this.loading.hide();
    }
  }

  async openTemplateEmailModal(template: EmailTemplates): Promise<void> {
    const componentProps = { template };
    const modal = await this.modalCtrl.create({ component: EmailTemplateComponent, componentProps });
    await modal.present();
  }

  async changeAppTitle(): Promise<void> {
    const header = this.t._('CONFIGURATIONS.APP_TITLE');
    const inputs: any[] = [{ name: 'appTitle', type: 'text', value: this.configurations.appTitle }];
    const doChange = async ({ appTitle }: { appTitle?: string }): Promise<void> => {
      if (!appTitle) return;
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations.appTitle = appTitle;
      await this.updateConfigurations(newConfigurations);
    };
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.CONFIRM'), handler: doChange }
    ];
    const alert = await this.alertCtrl.create({ header, inputs, buttons });
    await alert.present();
  }
  async changeAppSubtitle(): Promise<void> {
    const header = this.t._('CONFIGURATIONS.APP_SUBTITLE');
    const inputs: any[] = [{ name: 'appSubtitle', type: 'text', value: this.configurations.appSubtitle }];
    const doChange = async ({ appSubtitle }: { appSubtitle?: string }): Promise<void> => {
      if (!appSubtitle) return;
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations.appSubtitle = appSubtitle;
      await this.updateConfigurations(newConfigurations);
    };
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.CONFIRM'), handler: doChange }
    ];
    const alert = await this.alertCtrl.create({ header, inputs, buttons });
    await alert.present();
  }
  async changeSupportEmail(): Promise<void> {
    const header = this.t._('CONFIGURATIONS.SUPPORT_EMAIL');
    const inputs: any[] = [{ name: 'supportEmail', type: 'text', value: this.configurations.supportEmail }];
    const doChange = async ({ supportEmail }: { supportEmail?: string }): Promise<void> => {
      if (!supportEmail) return;
      const newConfigurations = new Configurations(this.configurations);
      newConfigurations.supportEmail = supportEmail;
      await this.updateConfigurations(newConfigurations);
    };
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.CONFIRM'), handler: doChange }
    ];
    const alert = await this.alertCtrl.create({ header, inputs, buttons });
    await alert.present();
  }
  async uploadAppLogo({ target }: { target: HTMLInputElement }, darkMode = false): Promise<void> {
    const file = target.files?.[0];
    if (!file) return;

    try {
      await this.loading.show();
      const imageURI = await this._media.uploadImage(file);
      const newConfigurations = new Configurations(this.configurations);
      if (darkMode) newConfigurations.appLogoURLDarkMode = this.app.getImageURLByURI(imageURI);
      else newConfigurations.appLogoURL = this.app.getImageURLByURI(imageURI);
      this.updateConfigurations(newConfigurations);
    } catch (error) {
      this.message.error('COMMON.OPERATION_FAILED');
    } finally {
      if (target) target.value = '';
      this.loading.hide();
    }
  }
  async resetAppLogo(darkMode = false): Promise<void> {
    const doReset = async (): Promise<void> => {
      const newConfigurations = new Configurations(this.configurations);
      if (darkMode) newConfigurations.appLogoURLDarkMode = null;
      else newConfigurations.appLogoURL = null;
      await this.updateConfigurations(newConfigurations);
    };
    const header = this.t._('CONFIGURATIONS.RESET_APP_LOGO');
    const message = this.t._('CONFIGURATIONS.RESET_APP_LOGO_I');
    const buttons = [
      { text: this.t._('COMMON.CANCEL'), role: 'cancel' },
      { text: this.t._('COMMON.RESET'), role: 'destructive', handler: doReset }
    ];
    const alert = await this.alertCtrl.create({ header, message, buttons });
    alert.present();
  }
  async setVisibilityQATopicsFeature(show: boolean): Promise<void> {
    const newConfigurations = new Configurations(this.configurations);
    newConfigurations.hideQATopics = !show;
    await this.updateConfigurations(newConfigurations);
  }
  async setVisibilityOpportunitiesFeature(show: boolean): Promise<void> {
    const newConfigurations = new Configurations(this.configurations);
    newConfigurations.hideOpportunities = !show;
    await this.updateConfigurations(newConfigurations);
  }
  async setVisibilityVotingFeature(show: boolean): Promise<void> {
    const newConfigurations = new Configurations(this.configurations);
    newConfigurations.hideVoting = !show;
    await this.updateConfigurations(newConfigurations);
  }
  async setVisibilityBadgesFeature(show: boolean): Promise<void> {
    const newConfigurations = new Configurations(this.configurations);
    newConfigurations.hideBadges = !show;
    await this.updateConfigurations(newConfigurations);
  }

  async filterBadges(search = '', scrollToNextPage?: IonInfiniteScroll, force = false): Promise<void> {
    let startPaginationAfterId: string | undefined;
    if (scrollToNextPage && this.badges?.length) startPaginationAfterId = this.badges[this.badges.length - 1].badgeId;

    this.badges = await this._badges.getList({ force, search, withPagination: true, startPaginationAfterId });

    if (scrollToNextPage) setTimeout((): Promise<void> => scrollToNextPage.complete(), 100);
  }
  async openBadgesModal(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: GiveBadgesComponent });
    await modal.present();
  }
  async addCustomBadge(): Promise<void> {
    await this.manageCustomBadge(new Badge());
  }
  async manageCustomBadge(badge: Badge): Promise<void> {
    const componentProps = { badge };
    const modal = await this.modalCtrl.create({ component: ManageBadgesComponent, componentProps });
    modal.onDidDismiss().then(({ data }): void => {
      if (!data) return;
        this.badges = undefined;
        this.filterBadges(this.badgesSearchbar?.value || '', undefined, true);
    });
    modal.present();
  }
}

enum PageSections {
  CONTENTS = 'CONTENTS',
  USERS = 'USERS',
  USERS_BADGES = 'USERS_BADGES',
  TEMPLATES = 'TEMPLATES',
  OPTIONS = 'OPTIONS'
}
