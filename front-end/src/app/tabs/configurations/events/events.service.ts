import { Injectable } from '@angular/core';
import { IDEAApiService } from '@idea-ionic/common';

import { GAEvent } from '@models/event.model';

@Injectable({ providedIn: 'root' })
export class GAEventsService {
  private events: GAEvent[];
  private archivedOnly = false;

  /**
   * Whether in the cache we loaded all the events or only the NOT archived ones.
   */
  all: boolean;

  /**
   * The number of events to consider for the pagination, when active.
   */
  MAX_PAGE_SIZE = 24;

  constructor(private api: IDEAApiService) {}

  /**
   * Load the events from the back-end.
   */
  private async loadList(all = false, archivedOnly = false): Promise<void> {
    this.all = all;
    this.archivedOnly = archivedOnly;
    const params: any = {};
    if (all) params.all = true;
    if (archivedOnly) params.archived = true;
    const events: GAEvent[] = await this.api.getResource('events', { params });
    this.events = this.sortEvents((events || []).map(x => new GAEvent(x)));
  }
  /**
   * Get (and optionally filter) the list of events.
   * Note: it's a slice of the array.
   */
  async getList(
    options: {
      force?: boolean;
      all?: boolean;
      archivedOnly?: boolean;
      search?: string;
      withPagination?: boolean;
      startPaginationAfterId?: string;
    } = {}
  ): Promise<GAEvent[]> {
    if (!this.events || options.force || options.all !== this.all || options.archivedOnly !== this.archivedOnly)
      await this.loadList(options.all, options.archivedOnly);
    if (!this.events) return null;

    options.search = options.search ? String(options.search).toLowerCase() : '';

    let filteredList = this.events.slice();

    if (options.search)
      filteredList = filteredList.filter(x =>
        options.search
          .split(' ')
          .every(searchTerm => [x.name].filter(f => f).some(f => f.toLowerCase().includes(searchTerm)))
      );

    if (options.withPagination && filteredList.length > this.MAX_PAGE_SIZE) {
      let indexOfLastOfPreviousPage = 0;
      if (options.startPaginationAfterId)
        indexOfLastOfPreviousPage = filteredList.findIndex(x => x.eventId === options.startPaginationAfterId) || 0;
      filteredList = filteredList.slice(0, indexOfLastOfPreviousPage + this.MAX_PAGE_SIZE);
    }

    return filteredList;
  }

  /**
   * Get a event by its id.
   */
  async getById(eventId: string): Promise<GAEvent> {
    return new GAEvent(await this.api.getResource(['events', eventId]));
  }

  /**
   * Insert a event.
   */
  async insert(event: GAEvent): Promise<GAEvent> {
    return new GAEvent(await this.api.postResource('events', { body: event }));
  }

  /**
   * Update a event.
   */
  async update(event: GAEvent): Promise<GAEvent> {
    return new GAEvent(await this.api.putResource(['events', event.eventId], { body: event }));
  }

  /**
   * Archive an event.
   */
  async archive(event: GAEvent): Promise<void> {
    await this.api.patchResource(['events', event.eventId], { body: { action: 'ARCHIVE' } });
  }
  /**
   * Unarchive an event.
   */
  async unarchive(event: GAEvent): Promise<void> {
    await this.api.patchResource(['events', event.eventId], { body: { action: 'UNARCHIVE' } });
  }

  /**
   * Delete an event.
   */
  async delete(event: GAEvent): Promise<void> {
    await this.api.deleteResource(['events', event.eventId]);
  }


  /**
   * Central sorting logic: sort events by date of most recent activity (topic or voting session) descending.
   * Newest on top, oldest on the bottom. Events with no activity appear at the end sorted by name.
   */
  sortEvents(events: GAEvent[], fallbackItems?: any[]): GAEvent[] {
    if (!events || !events.length) return [];

    const fallbackDates = new Map<string, number>();
    if (fallbackItems && fallbackItems.length) {
      for (const item of fallbackItems) {
        const eid = item?.event?.eventId;
        if (!eid) continue;
        const rawDate =
          item.createdAt ||
          item.updatedAt ||
          item.archivedAt ||
          item.publishedSince ||
          item.startedAt ||
          item.openedAt ||
          item.endedAt ||
          item.closedAt;
        if (!rawDate) continue;
        const time = new Date(rawDate).getTime();
        if (!isNaN(time) && time > (fallbackDates.get(eid) || 0)) {
          fallbackDates.set(eid, time);
        }
      }
    }

    return [...events].sort((a, b) => {
      const getEventTime = (e: GAEvent): number => {
        const dates = [e.lastActivityAt, e.lastTopicAt, e.lastVoteAt, e.updatedAt, e.createdAt]
          .filter(Boolean)
          .map(d => new Date(d).getTime())
          .filter(t => !isNaN(t));
        const storedTime = dates.length ? Math.max(...dates) : 0;
        return storedTime || fallbackDates.get(e.eventId) || 0;
      };

      const timeA = getEventTime(a);
      const timeB = getEventTime(b);
      if (timeB !== timeA) return timeB - timeA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  /**
   * Backwards compatible aliases that use the unified central sorting logic.
   */
  sortEventsForTopics(events: GAEvent[], fallbackTopics?: any[]): GAEvent[] {
    return this.sortEvents(events, fallbackTopics);
  }

  sortEventsForVoting(events: GAEvent[], fallbackSessions?: any[]): GAEvent[] {
    return this.sortEvents(events, fallbackSessions);
  }

  sortEventsByLatestItemDate(events: GAEvent[], items: any[]): GAEvent[] {
    return this.sortEvents(events, items);
  }
}
