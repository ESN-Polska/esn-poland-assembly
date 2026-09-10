import { Injectable } from '@angular/core';
import { IDEAApiService } from '@idea-ionic/common';

import { User } from '@models/user.model';
import { AppService } from '@app/app.service';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private cache = new Map<string, Promise<User>>();

  constructor(private api: IDEAApiService, private app: AppService) {}

  /**
   * Get a user by their ESN Accounts userId.
   * Returns cached result if already fetched.
   */
  async getById(userId: string): Promise<User> {
    if (!userId) return null;
    const cleanId = userId.trim().toLowerCase();

    // Check if it's the current user
    if (this.app.user?.userId && this.app.user.userId.toLowerCase() === cleanId) {
      return this.app.user;
    }

    if (this.cache.has(cleanId)) {
      return this.cache.get(cleanId);
    }

    const promise = (async () => {
      try {
        const raw = await this.api.getResource(['users', cleanId]);
        if (!raw) return null;
        return new User(raw);
      } catch (err) {
        return null;
      }
    })();

    this.cache.set(cleanId, promise);
    return promise;
  }

  /**
   * Search users by name, userId, or section.
   */
  async search(query: string): Promise<User[]> {
    if (!query) return [];
    try {
      const results: any[] = await this.api.getResource('users', { params: { search: query } });
      return (results || []).map(u => new User(u));
    } catch (_) {
      return [];
    }
  }

  /**
   * Clear the local in-memory cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
