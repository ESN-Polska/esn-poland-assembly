import { epochISOString, Resource } from 'idea-toolbox';

/**
 * An event for which a topic is discussed or an entity is linked to.
 * Note: it's  NOT named `Event` to avoid overlapping with standard classes.
 */
export class GAEvent extends Resource {
  /**
   * The ID of the event.
   */
  eventId: string;
  /**
   * The name of the event.
   */
  name: string;
  /**
   * The ID of the custom engagement badge assigned to the event.
   */
  engagementBadge?: string;
  /**
   * The timestamp when the topic was archived.
   */
  archivedAt?: epochISOString;
  /**
   * The timestamp of the last item (topic or voting session) created/assigned to this event.
   */
  lastActivityAt?: epochISOString;
  /**
   * The timestamp of the last topic created/assigned to this event.
   */
  lastTopicAt?: epochISOString;
  /**
   * The timestamp of the last vote/voting session created/assigned to this event.
   */
  lastVoteAt?: epochISOString;
  /**
   * The timestamp of creation.
   */
  createdAt?: epochISOString;
  /**
   * The timestamp of last update.
   */
  updatedAt?: epochISOString;

  load(x: any): void {
    super.load(x);
    this.eventId = this.clean(x.eventId, String);
    this.name = this.clean(x.name, String);
    if (x.engagementBadge) this.engagementBadge = this.clean(x.engagementBadge, String);
    else delete this.engagementBadge;
    if (x.archivedAt) this.archivedAt = this.clean(x.archivedAt, d => new Date(d).toISOString());
    if (x.lastActivityAt) this.lastActivityAt = this.clean(x.lastActivityAt, d => new Date(d).toISOString());
    if (x.lastTopicAt) this.lastTopicAt = this.clean(x.lastTopicAt, d => new Date(d).toISOString());
    if (x.lastVoteAt) this.lastVoteAt = this.clean(x.lastVoteAt, d => new Date(d).toISOString());
    if (x.createdAt) this.createdAt = this.clean(x.createdAt, d => new Date(d).toISOString());
    if (x.updatedAt) this.updatedAt = this.clean(x.updatedAt, d => new Date(d).toISOString());
  }

  safeLoad(newData: any, safeData: any): void {
    super.safeLoad(newData, safeData);
    this.eventId = safeData.eventId;
    if (newData.engagementBadge) this.engagementBadge = this.clean(newData.engagementBadge, String);
    else delete this.engagementBadge;
    if (safeData.archivedAt) this.archivedAt = safeData.archivedAt;
    if (safeData.lastActivityAt) this.lastActivityAt = safeData.lastActivityAt;
    if (safeData.lastTopicAt) this.lastTopicAt = safeData.lastTopicAt;
    if (safeData.lastVoteAt) this.lastVoteAt = safeData.lastVoteAt;
    if (safeData.createdAt) this.createdAt = safeData.createdAt;
    if (safeData.updatedAt) this.updatedAt = safeData.updatedAt;
  }

  validate(): string[] {
    const e = super.validate();
    if (this.iE(this.name)) e.push('name');
    return e;
  }
}

/**
 * A brief representation of an Event.
 */
export class GAEventAttached extends Resource {
  /**
   * The ID of the event.
   */
  eventId: string;
  /**
   * The name of the event.
   */
  name: string;
  /**
   * The ID of the custom engagement badge assigned to the event.
   */
  engagementBadge?: string;

  load(x: any): void {
    super.load(x);
    this.eventId = this.clean(x.eventId, String);
    this.name = this.clean(x.name, String);
    if (x.engagementBadge) this.engagementBadge = this.clean(x.engagementBadge, String);
    else delete this.engagementBadge;
  }
}
