///
/// IMPORTS
///

import { DynamoDB, HandledError, ResourceController } from 'idea-aws';

import { Configurations } from '../models/configurations.model';
import { User } from '../models/user.model';

///
/// CONSTANTS, ENVIRONMENT VARIABLES, HANDLER
///

const DDB_TABLES = { users: process.env.DDB_TABLE_users, configurations: process.env.DDB_TABLE_configurations };
const ddb = new DynamoDB();

export const handler = (ev: any, _: any, cb: any): Promise<void> => new UsersRC(ev, cb).handleRequest();

///
/// RESOURCE CONTROLLER
///

class UsersRC extends ResourceController {
  galaxyUser: User;
  targetUser: any;

  constructor(event: any, callback: any) {
    super(event, callback, { resourceId: 'userId' });
    this.galaxyUser = new User(event.requestContext?.authorizer?.lambda?.user);
  }

  protected async checkAuthBeforeRequest(): Promise<void> {
    if (!this.resourceId) return;

    const userId = this.resourceId.toLowerCase();
    try {
      this.targetUser = await ddb.get({ TableName: DDB_TABLES.users, Key: { userId } });
      if (!this.targetUser) throw new HandledError('User not found');
    } catch (err) {
      throw new HandledError('User not found');
    }
  }

  protected async getResource(): Promise<any> {
    return this.targetUser;
  }

  protected async getResources(): Promise<any[]> {
    const search = this.queryParams.search ? String(this.queryParams.search).toLowerCase() : '';
    const includeRoleAssignments = this.queryParams.roleAssignments === 'true';
    const canViewRoleAssignments =
      this.galaxyUser?.isAdministrator || this.galaxyUser?.hasPermission('configurations.users');
    let users: any[] = (await ddb.scan({ TableName: DDB_TABLES.users })) || [];
    if (search) {
      users = users.filter(
        u =>
          u.userId?.toLowerCase().includes(search) ||
          u.name?.toLowerCase().includes(search) ||
          u.section?.toLowerCase().includes(search)
      );
    }
    users = users.sort((a, b): number => (a.name || a.userId).localeCompare(b.name || b.userId));
    if (!canViewRoleAssignments || !includeRoleAssignments) return users.slice(0, 50);

    const configurations = new Configurations(
      await ddb.get({ TableName: DDB_TABLES.configurations, Key: { PK: Configurations.PK } })
    );
    return users.map(rawUser => {
      const user = new User(rawUser);
      User.applyConfigurationPermissions(user, configurations);
      const manualSources = [
        ...(configurations.administratorsIds.includes(user.userId)
          ? [{ roleId: 'ADMINISTRATOR', roleName: 'ADMINISTRATOR', casPermission: 'manual' }]
          : []),
        ...(configurations.opportunitiesManagersIds.includes(user.userId)
          ? [{ roleId: 'OPPORTUNITIES_MANAGER', roleName: 'OPPORTUNITIES MANAGER', casPermission: 'manual' }]
          : []),
        ...(configurations.dashboardManagersIds.includes(user.userId)
          ? [{ roleId: 'DASHBOARD_MANAGER', roleName: 'DASHBOARD MANAGER', casPermission: 'manual' }]
          : [])
      ];
      const customSources = configurations.customRoles
        .filter(role => user.customRoleIds.includes(role.id))
        .reduce((sources, role) => {
          if (role.userIds.includes(user.userId)) sources.push({ roleId: role.id, roleName: role.name, casPermission: 'manual' });
          role.casPermissions
            .filter(permission => User.matchesExtendedCASPermission(user, permission))
            .forEach(casPermission => sources.push({ roleId: role.id, roleName: role.name, casPermission }));
          return sources;
        }, [] as { roleId: string; roleName: string; casPermission: string }[]);
      const builtInSources = configurations.automaticRoleAssignments
        .filter(assignment => User.hasAnyCASPermission(user, assignment.casPermissions))
        .map(assignment => ({
          roleId: assignment.roleId,
          roleName: assignment.roleId.replace(/_/g, ' '),
          casPermission: assignment.casPermissions.find(permission => User.matchesExtendedCASPermission(user, permission))
        }));
      return { ...rawUser, roleAssignmentSources: [...manualSources, ...customSources, ...builtInSources] };
    });
  }
}
