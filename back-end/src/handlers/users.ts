///
/// IMPORTS
///

import { DynamoDB, HandledError, ResourceController } from 'idea-aws';

import { User } from '../models/user.model';

///
/// CONSTANTS, ENVIRONMENT VARIABLES, HANDLER
///

const DDB_TABLES = { users: process.env.DDB_TABLE_users };
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
    let users: any[] = (await ddb.scan({ TableName: DDB_TABLES.users })) || [];
    if (search) {
      users = users.filter(
        u =>
          u.userId?.toLowerCase().includes(search) ||
          u.name?.toLowerCase().includes(search) ||
          u.section?.toLowerCase().includes(search)
      );
    }
    return users.sort((a, b): number => (a.name || a.userId).localeCompare(b.name || b.userId)).slice(0, 50);
  }
}
