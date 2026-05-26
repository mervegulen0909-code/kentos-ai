import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type KentosEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.message_added'
  | 'sla.breached'
  | 'delivery.dispatched'
  | 'heartbeat';

export type KentosEvent = {
  type: KentosEventType;
  tenantId: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  // Single-instance in-process bus. For multi-instance deployments, replace with Redis Pub/Sub.
  private readonly subject = new Subject<KentosEvent>();

  emit(event: KentosEvent): void {
    this.logger.verbose(`emit ${event.type} tenant=${event.tenantId}`);
    this.subject.next(event);
  }

  stream(tenantId: string): Observable<KentosEvent> {
    return this.subject
      .asObservable()
      .pipe(filter((e) => e.tenantId === tenantId));
  }
}
