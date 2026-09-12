import { Resource } from 'idea-toolbox';

export const DEFAULT_TIMEZONE = 'Europe/Brussels';

export enum AppPermission {
  QA = 'qa',
  QA_TOPICS = 'qa.topics',
  QA_CATEGORIES = 'qa.categories',
  QA_RELATED_TOPICS = 'qa.relatedTopics',
  DASHBOARD = 'dashboard',
  OPPORTUNITIES = 'opportunities',
  VOTING = 'voting',
  BADGES = 'badges',
  CONFIGURATIONS = 'configurations',
  USERS = 'users'
}

/** Country-scoped CAS permissions published by ESN Accounts. */
export const CAS_PERMISSION_OPTIONS = [
  'National.president:PL',
  'National.vicePresident:PL',
  'National.treasurer:PL',
  'National.pr:PL',
  'National.regularBoardMember:PL',
  'National.secretary:PL',
  'National.staff:PL',
  'National.boardSupport:PL',
  'National.webmaster:PL',
  'National.projectCoordinator:PL',
  'National.Auditor:PL',
  'National.EducationOfficer:PL',
  'National.activity:PL',
  'National.eventCoordinator:PL',
  'National.cardManager:PL',
  'National.alumnus:PL'
];

export interface CustomRole {
  id: string;
  name: string;
  userIds: string[];
  permissions: AppPermission[];
  casPermissions: string[];
}

export type BuiltInRole = 'ADMINISTRATOR' | 'OPPORTUNITIES_MANAGER' | 'DASHBOARD_MANAGER';

export interface AutomaticRoleAssignment {
  roleId: BuiltInRole | string;
  casPermissions: string[];
}

/**
 * The platform's configuations.
 */
export class Configurations extends Resource {
  static PK = '1';
  /**
   * A fixed string, to identify the configurations.
   */
  PK = Configurations.PK;

  /**
   * The IDs of the platform's administrators.
   */
  administratorsIds: string[];
  /**
   * The IDs of the users that can manage the dashboard.
   */
  dashboardManagersIds: string[];
  /**
   * The IDs of the users that can open and manage opportunities.
   */
  opportunitiesManagersIds: string[];
  customRoles: CustomRole[];
  automaticRoleAssignments: AutomaticRoleAssignment[];
  /**
   * The IDs of the users banned; these users won't be able to add new contents (questions, messages, etc.).
   * Note: it's not a data model by itself becase we hope this list will always stay empty/short.
   */
  bannedUsersIds: string[];

  /**
   * The name/title of the platform.
   */
  appTitle: string;
  /**
   * The subtitle of the platform.
   */
  appSubtitle: string;
  /**
   * A contact email to reach if support is needed by users.
   */
  supportEmail: string;
  /**
   * The logo of the platform (in light mode); if not specified, the default logo is shown.
   */
  appLogoURL: string;
  /**
   * The logo of the platform in dark mode; if not specified, the default logo is shown.
   */
  appLogoURLDarkMode: string;
  /**
   * The timezone to use for dates and deadlines.
   */
  timezone: string;
  /**
   * When displaying a user, which information to show.
   */
  usersOriginDisplay: UsersOriginDisplayOptions;
  /**
   * Whether to hide the Q&A topics feature from the front-end.
   */
  hideQATopics: boolean;
  /**
   * Whether to hide the opportunities feature from the front-end.
   */
  hideOpportunities: boolean;
  /**
   * Whether to hide the voting feature from the front-end.
   */
  hideVoting: boolean;
  /**
   * Whether to hide the badges (gamification) feature from the front-end.
   */
  hideBadges: boolean;

  load(x: any): void {
    super.load(x);
    this.administratorsIds = this.cleanArray(x.administratorsIds, String).map(x => x.toLowerCase());
    this.opportunitiesManagersIds = this.cleanArray(x.opportunitiesManagersIds, String).map(x => x.toLowerCase());
    this.dashboardManagersIds = this.cleanArray(x.dashboardManagersIds, String).map(x => x.toLowerCase());
    this.customRoles = this.cleanArray(x.customRoles, Object).map((role: any) => ({
      id: this.clean(role.id, String),
      name: this.clean(role.name, String),
      userIds: this.cleanArray(role.userIds, String).map(x => x.toLowerCase()),
      permissions: this.cleanArray(role.permissions, String) as AppPermission[],
      casPermissions: this.cleanArray(role.casPermissions, String)
    }));
    this.automaticRoleAssignments = this.cleanArray(x.automaticRoleAssignments, Object).map((assignment: any) => ({
      roleId: this.clean(assignment.roleId, String),
      casPermissions: this.cleanArray(assignment.casPermissions, String)
    }));
    this.bannedUsersIds = this.cleanArray(x.bannedUsersIds, String).map(x => x.toLowerCase());

    this.appTitle = this.clean(x.appTitle, String, 'Assembly app');
    this.appSubtitle = this.clean(x.appSubtitle, String);
    this.supportEmail = this.clean(x.supportEmail, String);
    this.appLogoURL = this.clean(x.appLogoURL, String);
    this.appLogoURLDarkMode = this.clean(x.appLogoURLDarkMode, String);
    this.timezone = this.clean(x.timezone, String, DEFAULT_TIMEZONE);
    this.usersOriginDisplay = this.clean(x.usersOriginDisplay, String, UsersOriginDisplayOptions.SECTION);
    this.hideQATopics = this.clean(x.hideQATopics, Boolean, false);
    this.hideOpportunities = this.clean(x.hideOpportunities, Boolean, false);
    this.hideVoting = this.clean(x.hideVoting, Boolean, false);
    this.hideBadges = this.clean(x.hideBadges, Boolean, false);
  }

  safeLoad(newData: any, safeData: any): void {
    super.safeLoad(newData, safeData);
    this.PK = Configurations.PK;
  }

  validate(): string[] {
    const e = super.validate();
    if (this.iE(this.administratorsIds)) e.push('administratorsIds');
    if (this.iE(this.appTitle)) e.push('appTitle');
    return e;
  }
}

/**
 * The possible email templates.
 */
export enum EmailTemplates {
  QUESTIONS = 'QUESTIONS',
  ANSWERS = 'ANSWERS',
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  VOTING_INSTRUCTIONS = 'VOTING_INSTRUCTIONS',
  VOTING_CONFIRMATION = 'VOTING_CONFIRMATION'
}

/**
 * The possible options in displaying information about a user.
 */
export enum UsersOriginDisplayOptions {
  COUNTRY = 'country',
  SECTION = 'section',
  BOTH = 'both'
}
