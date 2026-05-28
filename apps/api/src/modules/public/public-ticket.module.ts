import { Module } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { RateLimitService } from '../../common/services/rate-limit.service.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { CitizensModule } from '../citizens/citizens.module.js';
import { FaqArticlesModule } from '../faq/faq-articles.module.js';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { CitizenIdentityService } from './citizen-identity.service.js';
import { CitizenSessionService } from './citizen-session.service.js';
import { FirebaseAuthService } from './firebase-auth.service.js';
import { InternalChannelController } from './internal-channel.controller.js';
import { PostmarkInboundController } from './postmark-inbound.controller.js';
import { TelegramInboundController } from './telegram-inbound.controller.js';
import { PublicCitizenErasureController } from './public-citizen-erasure.controller.js';
import { OutboundDispatchService } from './outbound-dispatch.service.js';
import { PublicConversationController } from './public-conversation.controller.js';
import { PublicConversationService } from './public-conversation.service.js';
import { PublicFirebaseAuthController } from './public-firebase-auth.controller.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicWidgetController } from './public-widget.controller.js';
import { PublicTicketAiService, PublicTicketService } from './public-ticket.service.js';
import { WidgetEmbedController } from './widget-embed.controller.js';
import { PublicFaqAppointmentsController } from './public-faq-appointments.controller.js';

@Module({
  imports: [AttachmentsModule, AnalyticsModule, CitizensModule, FaqArticlesModule, AppointmentsModule],
  controllers: [PublicTicketController, PublicConversationController, PublicWidgetController, WidgetEmbedController, InternalChannelController, PublicFirebaseAuthController, PublicCitizenErasureController, PostmarkInboundController, TelegramInboundController, PublicFaqAppointmentsController],
  providers: [
    PublicTicketAiService,
    PublicTicketService,
    PublicConversationService,
    CitizenIdentityService,
    CitizenSessionService,
    OutboundDispatchService,
    PublicChannelGuard,
    RateLimitService,
    NotificationQueueService,
    NotificationTemplateService,
    SlaService,
    TicketNumberService,
    FirebaseAuthService,
  ],
})
export class PublicTicketModule {}
