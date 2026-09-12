import { Resource } from 'idea-toolbox';

import {
  AppPermission,
  Configurations,
  UsersOriginDisplayOptions
} from './configurations.model';

/**
 * The list of interesting roles on which to assign permissions in the platform.
 */
export enum UserRoles {
  INTERNATIONAL_BOARD = 'INTERNATIONAL_BOARD',
  INTERNATIONAL_SECRETARIAT = 'INTERNATIONAL_SECRETARIAT',
  INTERNATIONAL_LEVEL = 'INTERNATIONAL_LEVEL',
  INTERNATIONAL_GA_CT = 'INTERNATIONAL_GA_CT',
  INTERNATIONAL_AB = 'INTERNATIONAL_AB',
  INTERNATIONAL_AC = 'INTERNATIONAL_AC',
  NATIONAL_BOARD = 'NATIONAL_BOARD',
  NATIONAL_LEVEL = 'NATIONAL_LEVEL',
  LOCAL_BOARD = 'LOCAL_BOARD',
  LOCAL_LEVEL = 'LOCAL_LEVEL'
}

/**
 * The map between the platform's roles with the (known) interesting roles on ESN Accounts.
 * Roles that ends with "*" are intended to be: "any role with that prefix".
 * Note: all roles are lower-cased (since they will be handled with a case-insensitive logic).
 */
export const ESN_ACCOUNTS_ROLES_MAP: { [userRole: string]: string[] } = {
  INTERNATIONAL_BOARD: [
    'international.president',
    'international.vicepresident',
    'international.treasurer',
    'international.webprojectadministrator',
    'international.externalrelations'
  ],
  INTERNATIONAL_SECRETARIAT: ['international.officestaff'],
  INTERNATIONAL_GA_CT: ['international.cnrsecretary', 'international.agmchair', 'international.cnradmin'],
  INTERNATIONAL_AB: ['international.ab.*'],
  INTERNATIONAL_AC: ['international.ac.*'],
  INTERNATIONAL_LEVEL: ['international.*'],
  NATIONAL_BOARD: ['national.regularboardmember'],
  NATIONAL_LEVEL: ['national.*'],
  LOCAL_BOARD: ['local.regularboardmember'],
  LOCAL_LEVEL: ['local.*']
};

export interface RoleAssignmentSource {
  roleId: string;
  roleName: string;
  casPermission: string;
}

export class User extends Resource {
  /**
   * Username in ESN Accounts (lowercase).
   */
  userId: string;
  /**
   * Email address.
   */
  email: string;
  /**
   * First name.
   */
  firstName: string;
  /**
   * Last name.
   */
  lastName: string;
  /**
   * Section code in ESN Accounts.
   */
  roles: string[];
  /** Scoped legacy CAS roles, for example National.cardManager:PL. */
  extendedRoles: string[];
  /**
   * Section code in ESN Accounts.
   */
  sectionCode: string;
  /**
   * ESN Section.
   */
  section: string;
  /**
   * ESN Country.
   */
  country: string;
  /**
   * The URL to the user's avatar.
   */
  avatarURL: string;
  /** Last time the user logged into the application. */
  lastLoginAt: string;
  /**
   * Whether the user is administrator, based on the platform's configurations.
   * A change in this permission will require a new sign-in to take full place.
   */
  isAdministrator: boolean;
  /**
   * Whether the user can manage opportunities, based on the platform's configurations.
   * A change in this permission will require a new sign-in to take full place.
   */
  canManageOpportunities: boolean;
  /**
   * Whether the user can manage the dashboard, based on the platform's configurations.
   * A change in this permission will require a new sign-in to take full place.
   */
  canManageDashboard: boolean;
  permissions: AppPermission[];

  /** IDs of custom roles granted by configuration or CAS permissions. */
  customRoleIds: string[];
  roleAssignmentSources: RoleAssignmentSource[];

  /**
   * Whether the user has one of the allowed roles.
   */
  static isAllowedBasedOnRoles = (user: User, allowedRoles: UserRoles[]): boolean => {
    const allowedESNAccountsRoles: string[] = [];
    for (const role of allowedRoles) allowedESNAccountsRoles.push(...ESN_ACCOUNTS_ROLES_MAP[role]);

    return user.roles
      .map(userRole => userRole.toLowerCase())
      .some(userRole =>
        allowedESNAccountsRoles.some(allowedRole =>
          allowedRole.endsWith('*')
            ? userRole.startsWith(allowedRole.slice(0, allowedRole.length - 1))
            : allowedRole === userRole
        )
      );
  };

  /** Match scoped CAS rules only; unscoped legacy roles must not grant custom roles. */
  static matchesExtendedCASPermission(user: User, permission: string): boolean {
    const roles = user.extendedRoles || [];
    const normalizedPermission = permission.toLowerCase().trim();
    return roles.some(userRole =>
      new RegExp(`^${normalizedPermission.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(
        String(userRole).toLowerCase().trim()
      )
    );
  }

  static hasAnyCASPermission(user: User, permissions: string[]): boolean {
    return permissions.some(permission => User.matchesExtendedCASPermission(user, permission));
  }

  hasPermission(permission: AppPermission | string): boolean {
    if (this.isAdministrator) return true;
    if (permission === AppPermission.OPPORTUNITIES && this.canManageOpportunities) return true;
    if (permission === AppPermission.DASHBOARD && this.canManageDashboard) return true;
    return (this.permissions || []).some(granted => permission === granted || permission.startsWith(`${granted}.`));
  }

  static applyConfigurationPermissions(user: User, configurations: Configurations): void {
    user.isAdministrator = configurations.administratorsIds.includes(user.userId);
    user.permissions = user.isAdministrator
      ? Object.values(AppPermission)
      : configurations.customRoles
          .filter(role => role.userIds.includes(user.userId))
          .reduce((permissions, role) => [...permissions, ...role.permissions], [] as AppPermission[])
          .filter((permission, index, permissions) => permissions.indexOf(permission) === index);
    user.customRoleIds = configurations.customRoles
      .filter(role => role.userIds.includes(user.userId) || User.hasAnyCASPermission(user, role.casPermissions))
      .map(role => role.id);
    const automaticRoleIds = configurations.automaticRoleAssignments
      .filter(assignment => User.hasAnyCASPermission(user, assignment.casPermissions))
      .map(assignment => assignment.roleId);
    const assignedCustomRoles = configurations.customRoles.filter(role => user.customRoleIds.includes(role.id));
    user.permissions = [
      ...user.permissions,
      ...assignedCustomRoles.reduce((permissions, role) => [...permissions, ...role.permissions], [] as AppPermission[])
    ].filter((permission, index, permissions) => permissions.indexOf(permission) === index);
    user.isAdministrator = user.isAdministrator || automaticRoleIds.includes('ADMINISTRATOR');
    user.permissions = user.isAdministrator ? Object.values(AppPermission) : user.permissions;
    user.canManageOpportunities =
      user.isAdministrator ||
      configurations.opportunitiesManagersIds.includes(user.userId) ||
      automaticRoleIds.includes('OPPORTUNITIES_MANAGER') ||
      user.permissions.includes(AppPermission.OPPORTUNITIES);
    user.canManageDashboard =
      user.isAdministrator ||
      configurations.dashboardManagersIds.includes(user.userId) ||
      automaticRoleIds.includes('DASHBOARD_MANAGER') ||
      user.permissions.includes(AppPermission.DASHBOARD);
  }

  load(x: any): void {
    super.load(x);
    this.userId = this.clean(x.userId, String)?.toLowerCase();
    this.email = this.clean(x.email, String);
    this.firstName = this.clean(x.firstName, String);
    this.lastName = this.clean(x.lastName, String);
    this.roles = this.cleanArray(x.roles, String);
    this.extendedRoles = this.cleanArray(x.extendedRoles, String);
    this.sectionCode = this.clean(x.sectionCode, String);
    this.section = this.clean(x.section, String);
    this.country = this.clean(x.country, String);
    this.avatarURL = this.clean(x.avatarURL, String);
    this.lastLoginAt = this.clean(x.lastLoginAt, String);
    this.isAdministrator = this.clean(x.isAdministrator, Boolean);
    this.canManageOpportunities = this.clean(x.canManageOpportunities, Boolean);
    this.canManageDashboard = this.clean(x.canManageDashboard, Boolean);
    this.permissions = this.cleanArray(x.permissions, String) as AppPermission[];
    this.customRoleIds = this.cleanArray(x.customRoleIds, String);
    this.roleAssignmentSources = this.cleanArray(x.roleAssignmentSources, Object) as RoleAssignmentSource[];
  }

  /**
   * Get a string representing the origin of the user.
   */
  getOrigin(displayOption: UsersOriginDisplayOptions = UsersOriginDisplayOptions.BOTH): string {
    return getUserOrigin(this, displayOption);
  }
}

/**
 * Get a string representing the origin of a user.
 */
export const getUserOrigin = (
  user: { country?: string; section?: string },
  displayOption: UsersOriginDisplayOptions
): string => {
  if (displayOption === UsersOriginDisplayOptions.COUNTRY) return user.country;
  if (displayOption === UsersOriginDisplayOptions.SECTION) return user.section;
  if (displayOption === UsersOriginDisplayOptions.BOTH) {
    if (user.country === user.section) return user.section;
    return [user.country, user.section].filter(x => x).join(' - ');
  } else return null;
};
