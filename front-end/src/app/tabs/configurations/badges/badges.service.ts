import { Injectable } from '@angular/core';
import { IDEAApiService, IDEATranslationsService } from '@idea-ionic/common';

import { Badge, UserBadge } from '@models/badge.model';

/**
 * A local fallback URL for the missing badges.
 */
const BADGE_NOT_FOUND_URL = 'assets/imgs/badges/NOT_FOUND.svg';

@Injectable({ providedIn: 'root' })
export class BadgesService {
  private badges: Badge[];

  /**
   * The number of badges to consider for the pagination, when active.
   */
  MAX_PAGE_SIZE = 24;

  private _loadingListPromise: Promise<void> | null = null;

  constructor(private api: IDEAApiService, private t: IDEATranslationsService) {}

  //
  // BADGES
  //

  /**
   * Load the list of (custom) badges from the back-end.
   */
  private async loadList(): Promise<void> {
    if (this._loadingListPromise) return this._loadingListPromise;
    this._loadingListPromise = (async () => {
      try {
        const badges: UserBadge[] = await this.api.getResource('badges');
        this.badges = (badges || []).map(b => new Badge(b));
      } finally {
        this._loadingListPromise = null;
      }
    })();
    return this._loadingListPromise;
  }
  /**
   * Get the list of (custom) badges.
   * Note: it's a slice of the array.
   */
  async getList(
    options: {
      force?: boolean;
      search?: string;
      withPagination?: boolean;
      startPaginationAfterId?: string;
    } = {}
  ): Promise<Badge[]> {
    if (!this.badges || options.force) await this.loadList();
    if (!this.badges) return null;

    options.search = options.search ? String(options.search).toLowerCase() : '';

    let filteredList = this.badges.slice();

    if (options.search)
      filteredList = filteredList.filter(x =>
        options.search
          .split(' ')
          .every(searchTerm => [x.name, x.description].filter(f => f).some(f => f.toLowerCase().includes(searchTerm)))
      );

    if (options.withPagination && filteredList.length > this.MAX_PAGE_SIZE) {
      let indexOfLastOfPreviousPage = 0;
      if (options.startPaginationAfterId)
        indexOfLastOfPreviousPage = filteredList.findIndex(x => x.badgeId === options.startPaginationAfterId) || 0;
      filteredList = filteredList.slice(0, indexOfLastOfPreviousPage + this.MAX_PAGE_SIZE);
    }

    return filteredList;
  }
  /**
   * Get a badge by its id.
   */
  async getById(badge: string): Promise<Badge> {
    return new Badge(await this.api.getResource(['badges', badge]));
  }
  /**
   * Add a badge.
   */
  async insert(badge: Badge): Promise<Badge> {
    return new Badge(await this.api.postResource(['badges'], { body: badge }));
  }
  /**
   * Edit a badge.
   */
  async update(badge: Badge): Promise<Badge> {
    return new Badge(await this.api.putResource(['badges', badge.badgeId], { body: badge }));
  }
  /**
   * Delete a badge.
   */
  async delete(badge: Badge): Promise<void> {
    await this.api.deleteResource(['badges', badge.badgeId]);
  }

  //
  // USERS BADGES
  //

  /**
   * Get the list of the user's badges.
   */
  async getListOfUserById(userId: string): Promise<UserBadge[]> {
    const params = { userId };
    const badges: UserBadge[] = await this.api.getResource('usersBadges', { params });
    return badges.map(x => new UserBadge(x));
  }
  /**
   * Get a user badge by its id and mark it as seen.
   */
  async markUserBadgeAsSeen(badge: string): Promise<UserBadge> {
    return new UserBadge(await this.api.getResource(['usersBadges', badge]));
  }
  /**
   * Remove a badge from a user.
   */
  async removeBadgeFromUser(userId: string, badge: string): Promise<void> {
    const params = { userId };
    await this.api.deleteResource(['usersBadges', badge], { params });
  }
  /**
   * Add a badge to a user.
   */
  async addBadgeToUser(userId: string, badge: string): Promise<void> {
    const params = { userId };
    await this.api.postResource(['usersBadges', badge], { params });
  }
  /**
   * Select a badge to be displayed next to the user's questions.
   */
  async selectBadge(badge: string): Promise<UserBadge> {
    const updated = await this.api.patchResource(['usersBadges', badge], { body: { action: 'SELECT' } });
    return new UserBadge(updated);
  }
  /**
   * Deselect the user's badge.
   */
  async deselectBadge(badge: string): Promise<void> {
    await this.api.patchResource(['usersBadges', badge], { body: { action: 'DESELECT' } });
  }

  //
  // UI
  //

  /**
   * Get the detail of a badge from a user badge.
   */
  getDetailOfUserBadge(userBadge: UserBadge): Badge | null {
    return this.badges?.find(x => x.badgeId === userBadge.badge) ?? null;
  }
  /**
   * Get the image of a user badge.
   */
  getImageURLOfUserBadge(userBadge: UserBadge): string | null {
    if (Badge.isBuiltIn(userBadge.badge)) return 'assets/imgs/badges/' + userBadge.badge + '.svg';
    const badge = this.getDetailOfUserBadge(userBadge);
    return badge ? badge.imageURL : BADGE_NOT_FOUND_URL;
  }
  /**
   * Get the image URL for a badge by its ID string.
   */
  getImageURLOfBadgeId(badgeId: string): string | null {
    if (!badgeId) return null;
    if (Badge.isBuiltIn(badgeId)) return 'assets/imgs/badges/' + badgeId + '.svg';
    if (!this.badges && !this._loadingListPromise) {
      this.loadList().catch(() => {});
    }
    const badge = this.badges?.find(x => x.badgeId === badgeId);
    return badge ? badge.imageURL : BADGE_NOT_FOUND_URL;
  }
  /**
   * Get the localized name for a badge by its ID string.
   */
  getBadgeName(badgeId: string): string {
    if (!badgeId) return '';
    if (Badge.isBuiltIn(badgeId)) return this.t._('BADGES.BUILT_IN_BADGES.' + badgeId);
    if (!this.badges && !this._loadingListPromise) {
      this.loadList().catch(() => {});
    }
    const badge = this.badges?.find(x => x.badgeId === badgeId);
    return badge ? badge.name : badgeId;
  }
  /**
   * Load a fallback URL when a badge is missing.
   */
  fallbackBadgeImage(targetImg: any): void {
    if (targetImg && targetImg.src !== BADGE_NOT_FOUND_URL) targetImg.src = BADGE_NOT_FOUND_URL;
  }
}
