import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType } from '@kentos/database';
import type { ChannelIntakeEnvelope, IntakeChannel, PublicTicketAiIntakeResult } from '@kentos/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CitizenIdentityService } from './citizen-identity.service.js';
import { CreatePublicConversationDto } from './dto/create-public-conversation.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';
import { SendPublicConversationMessageDto } from './dto/send-public-conversation-message.dto.js';
import { OutboundDispatchService } from './outbound-dispatch.service.js';
import { PublicTicketAiService, PublicTicketService } from './public-ticket.service.js';

type ConversationContext = {
  messages?: Array<{ role: 'citizen' | 'assistant'; text: string; at: string }>;
  latestClassification?: PublicTicketAiIntakeResult['classification'];
  contact?: { displayName?: string | null; phone?: string | null; email?: string | null };
  ticket?: { trackingToken: string | null; createdAt: string };
};

@Injectable()
export class PublicConversationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PublicTicketAiService) private readonly ai: PublicTicketAiService,
    @Inject(PublicTicketService) private readonly tickets: PublicTicketService,
    @Inject(CitizenIdentityService) private readonly citizenIdentity: CitizenIdentityService,
    @Inject(OutboundDispatchService) private readonly outbound: OutboundDispatchService,
  ) {}

  async widgetSettings(tenantSlug: string) {
    const tenant = await this.requireTenant(tenantSlug);
    return {
      tenantSlug: tenant.slug,
      widgetEnabled: tenant.widgetEnabled,
      widgetTitle: tenant.widgetTitle,
      widgetWelcome: tenant.widgetWelcome,
      widgetAllowedOrigins: Array.isArray(tenant.widgetAllowedOrigins) ? tenant.widgetAllowedOrigins.map((origin) => String(origin)).filter(Boolean) : [],
    };
  }

  async start(tenantSlug: string, dto: CreatePublicConversationDto) {
    const tenant = await this.requireTenant(tenantSlug);
    const channel = dto.channel ?? ChannelType.WEB_CHAT;
    const contact = this.normalizeContact(dto.contact, dto.displayName);
    const citizen = await this.citizenIdentity.resolveCitizen({
      tenantId: tenant.id,
      contact,
      source: this.identitySourceForChannel(channel),
    });
    const now = new Date();
    const context: ConversationContext = {
      messages: dto.initialMessage ? [{ role: 'citizen', text: dto.initialMessage.trim(), at: now.toISOString() }] : [],
      contact,
    };

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        citizenId: citizen?.id,
        channel,
        externalConversationId: dto.externalConversationId?.trim() || undefined,
        context,
        lastMessageAt: dto.initialMessage ? now : null,
      },
    });

    return this.toResponse(conversation.id, channel, context, null, false);
  }

  async ingestEnvelope(envelope: ChannelIntakeEnvelope) {
    const tenant = envelope.tenantSlug
      ? await this.requireTenant(envelope.tenantSlug)
      : await this.requireTenantById(envelope.tenantId ?? '');

    // CSAT response detection: if message is a single digit 1-5 from a citizen
    // with a recently-resolved ticket, record the score and short-circuit.
    const csatResult = await this.tryRecordCsatResponse(tenant.id, envelope);
    if (csatResult) return csatResult;

    const inboundEvent = await this.recordInboundEvent(tenant.id, envelope);
    if (inboundEvent?.processedAt) {
      const existingConversation = await this.findConversationForEnvelope(tenant.id, envelope);
      if (existingConversation) {
        const context = this.readContext(existingConversation.context);
        return this.toResponse(existingConversation.id, existingConversation.channel as IntakeChannel, context, null, existingConversation.handoffRequested);
      }
    }

    const citizen = await this.citizenIdentity.resolveCitizen({
      tenantId: tenant.id,
      contact: envelope.citizenContact,
      source: this.identitySourceForChannel(envelope.channel),
    });
    const conversation = await this.findConversationForEnvelope(tenant.id, envelope) ?? await this.prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        citizenId: citizen?.id,
        channel: envelope.channel,
        externalConversationId: envelope.externalConversationId,
        context: { messages: [], contact: this.citizenIdentity.normalizeContact(envelope.citizenContact) },
      },
    });

    const result = await this.processMessage(tenant.slug, conversation.id, {
      text: envelope.text,
      displayName: envelope.citizenContact?.displayName ?? undefined,
      phone: envelope.citizenContact?.phone ?? undefined,
      email: envelope.citizenContact?.email ?? undefined,
    });
    if (inboundEvent && !inboundEvent.processedAt) {
      await this.prisma.channelEvent.update({
        where: { id: inboundEvent.id },
        data: { processedAt: new Date() },
      });
    }
    return result;
  }

  async sendMessage(tenantSlug: string, conversationId: string, dto: SendPublicConversationMessageDto) {
    return this.processMessage(tenantSlug, conversationId, dto);
  }

  private async processMessage(tenantSlug: string, conversationId: string, dto: SendPublicConversationMessageDto) {
    const tenant = await this.requireTenant(tenantSlug);
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId: tenant.id } });
    if (!conversation) throw new NotFoundException('Konusma bulunamadi.');

    const channel = conversation.channel as IntakeChannel;
    const context = this.readContext(conversation.context);
    const contact = this.mergeContact(context.contact, {
      displayName: dto.displayName,
      phone: dto.phone,
      email: dto.email,
    });
    const citizen = await this.citizenIdentity.resolveCitizen({
      tenantId: tenant.id,
      contact,
      source: this.identitySourceForChannel(channel),
      preferredCitizenId: conversation.citizenId,
    });
    const now = new Date();
    const text = dto.text.trim();
    const messages = [...(context.messages ?? []), { role: 'citizen' as const, text, at: now.toISOString() }];
    const existingTicket = this.readTicketContext(context.ticket);
    if (existingTicket.trackingToken) {
      const assistantMessage = `Bu konusmadan basvuru zaten olusturuldu. Takip kodunuz: ${existingTicket.trackingToken}.`;
      const nextContext: ConversationContext = {
        ...context,
        contact,
        messages: [...messages, { role: 'assistant' as const, text: assistantMessage, at: now.toISOString() }],
      };
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          citizenId: citizen?.id ?? conversation.citizenId,
          context: nextContext,
          handoffRequested: false,
          lastMessageAt: now,
          state: 'TICKET_CREATED',
        },
      });
      return this.toResponse(conversation.id, channel, nextContext, assistantMessage, false);
    }

    const departments = await this.listTenantDepartments(tenant.id);
    const categories = await this.listTenantCategories(tenant.id);
    // Çok-turlu intake: sınıflandırıcı tek mesaj görür; konuşmada bağlamın
    // kaybolmaması için son vatandaş mesajlarını birleştirip veriyoruz
    // (örn. önce "lamba yanmıyor", sonra "Atatürk Cad. No 25" → tek talep).
    const citizenTurns = messages.filter((message) => message.role === 'citizen').map((message) => message.text);
    const classificationText = citizenTurns.slice(-6).join('\n');
    const aiResult = await this.ai.classify({
      tenantContext: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        departments,
        categories,
      },
      message: {
        text: classificationText,
        channel,
        receivedAt: now.toISOString(),
        citizenContact: contact,
      },
    });

    const nextContext: ConversationContext = {
      ...context,
      messages,
      contact,
      latestClassification: aiResult.classification,
    };

    const handoffRequested = aiResult.classification.intent === 'human_handoff';
    let ticket = null;
    let assistantMessage = aiResult.classification.followUpQuestion;

    if (handoffRequested && !assistantMessage) {
      assistantMessage = 'Talebiniz belediye ekibine insan desteği isteği olarak iletildi. Kısa süre içinde sizinle paylaştığınız iletişim bilgisinden dönüş yapılacaktır.';
    }

    // Başvuru formuyla tutarlı: yalnızca açıklama zorunlu. Konum/iletişim/kategori
    // eksikse de talep oluşur (vatandaş takip koduyla izler, operatör tamamlar).
    // Aksi halde iletişim bırakmayan vatandaş maskottan asla talep açamaz (çıkmaz).
    const blockingMissing = aiResult.classification.missingFields.filter((field) => field === 'description');
    if (!blockingMissing.length && aiResult.classification.intent === 'new_ticket') {
      ticket = await this.tickets.create(tenantSlug, {
        description: aiResult.classification.description,
        title: aiResult.classification.title,
        displayName: contact.displayName ?? undefined,
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        addressText: aiResult.classification.addressText ?? undefined,
        latitude: aiResult.classification.location?.latitude,
        longitude: aiResult.classification.location?.longitude,
        channel: channel as CreatePublicTicketDto['channel'],
        attachmentIds: dto.attachmentIds,
      }, {
        preferredCitizenId: citizen?.id ?? conversation.citizenId,
      });
      nextContext.ticket = { trackingToken: ticket.trackingToken, createdAt: new Date().toISOString() };
      assistantMessage = `Başvurunuz oluşturuldu. Takip kodunuz: ${ticket.trackingToken}.`;
    }

    // Mascot: generate a natural-language reply for general questions (or any
    // turn that has no template reply yet) so the citizen always gets answered.
    if (!ticket && !handoffRequested && (aiResult.classification.intent === 'general_question' || !assistantMessage)) {
      const [faq, cannedReplies] = await Promise.all([
        this.listTenantFaq(tenant.id),
        this.listTenantCannedReplies(tenant.id),
      ]);
      const generated = await this.ai.answerConversation({
        tenantId: tenant.id,
        assistantName: tenant.widgetTitle,
        history: context.messages ?? [],
        message: text,
        faq,
        cannedReplies,
        departments,
        categories,
      });
      if (generated) assistantMessage = generated;
    }

    if (assistantMessage) messages.push({ role: 'assistant', text: assistantMessage, at: new Date().toISOString() });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        citizenId: citizen?.id ?? conversation.citizenId,
        context: nextContext,
        handoffRequested,
        lastMessageAt: now,
        state: ticket ? 'TICKET_CREATED' : 'OPEN',
      },
    });

    if (assistantMessage) {
      await this.outbound.dispatch({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        channel,
        conversationId: conversation.id,
        externalConversationId: conversation.externalConversationId,
        recipient: { phone: contact.phone, email: contact.email },
        text: assistantMessage,
      });
    }

    return this.toResponse(conversation.id, channel, nextContext, assistantMessage, handoffRequested);
  }

  private async requireTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');
    return tenant;
  }

  private async requireTenantById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');
    return tenant;
  }

  private readContext(value: unknown): ConversationContext {
    return value && typeof value === 'object' ? value as ConversationContext : {};
  }

  private async findConversationForEnvelope(tenantId: string, envelope: ChannelIntakeEnvelope) {
    return this.prisma.conversation.findFirst({
      where: {
        tenantId,
        channel: envelope.channel,
        externalConversationId: envelope.externalConversationId,
      },
    });
  }

  private async recordInboundEvent(tenantId: string, envelope: ChannelIntakeEnvelope) {
    if (!envelope.externalMessageId) return null;

    const where = {
      tenantId,
      channel: envelope.channel,
      provider: envelope.provider,
      externalEventId: envelope.externalMessageId,
    };
    const existing = await this.prisma.channelEvent.findFirst({ where, select: { id: true, processedAt: true } });
    if (existing) return existing;

    try {
      return await this.prisma.channelEvent.create({
        data: {
          ...where,
          payload: {
            direction: 'INBOUND',
            externalConversationId: envelope.externalConversationId,
            text: envelope.text,
            media: envelope.media ?? [],
            citizenContact: envelope.citizenContact,
            raw: envelope.raw ?? null,
          },
        },
        select: { id: true, processedAt: true },
      });
    } catch {
      return this.prisma.channelEvent.findFirst({ where, select: { id: true, processedAt: true } });
    }
  }

  private readTicketContext(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { trackingToken: null as string | null };
    const trackingToken = (value as { trackingToken?: unknown }).trackingToken;
    return { trackingToken: typeof trackingToken === 'string' ? trackingToken : null };
  }

  private normalizeContact(contact?: string | null, displayName?: string | null) {
    const normalizedContact = contact?.trim() || null;
    return this.citizenIdentity.normalizeContact({
      displayName,
      phone: normalizedContact,
      email: normalizedContact,
    });
  }

  private mergeContact(previous: ConversationContext['contact'], next: ConversationContext['contact']) {
    return this.citizenIdentity.normalizeContact({
      displayName: next?.displayName ?? previous?.displayName,
      phone: next?.phone ?? previous?.phone,
      email: next?.email ?? previous?.email,
    });
  }

  private identitySourceForChannel(channel: string) {
    if (channel === ChannelType.WHATSAPP) return 'WHATSAPP';
    if (channel === ChannelType.WEB_CHAT) return 'WEB_CHAT';
    if (channel === ChannelType.INSTAGRAM) return 'INSTAGRAM';
    if (channel === ChannelType.FACEBOOK) return 'FACEBOOK';
    if (channel === ChannelType.SMS) return 'SMS';
    if (channel === ChannelType.EMAIL) return 'EMAIL';
    return 'PUBLIC_WEB';
  }

  private async listTenantDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  private async listTenantCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, departmentId: true },
    });
  }

  private async listTenantFaq(tenantId: string) {
    return this.prisma.faqArticle.findMany({
      where: { tenantId, isPublished: true },
      orderBy: { viewCount: 'desc' },
      take: 12,
      select: { title: true, body: true },
    });
  }

  private async listTenantCannedReplies(tenantId: string) {
    return this.prisma.cannedReply.findMany({
      where: { tenantId, isActive: true, ownerId: null },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: { title: true, body: true },
    });
  }

  private async tryRecordCsatResponse(
    tenantId: string,
    envelope: ChannelIntakeEnvelope,
  ): Promise<Record<string, unknown> | null> {
    const text = envelope.text.trim();
    const score = parseInt(text, 10);
    if (isNaN(score) || score < 1 || score > 5 || text !== String(score)) return null;

    const phone = envelope.citizenContact?.phone?.trim();
    if (!phone) return null;

    // Look for the most recently resolved ticket for this citizen (last 48h, no score yet)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        tenantId,
        status: 'RESOLVED',
        csatScore: null,
        resolvedAt: { gte: cutoff },
        citizen: { phone },
      },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true, ticketNo: true },
    });

    if (!ticket) return null;

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { csatScore: score, csatRespondedAt: new Date() },
    });

    return { csatRecorded: true, ticketId: ticket.id, ticketNo: ticket.ticketNo, score };
  }

  private toResponse(
    conversationId: string,
    channel: IntakeChannel,
    context: ConversationContext,
    assistantMessage: string | null,
    handoffRequested: boolean,
  ) {
    return {
      conversationId,
      channel,
      state: context.ticket ? 'TICKET_CREATED' : 'OPEN',
      assistantMessage,
      missingFields: context.latestClassification?.missingFields ?? [],
      followUpQuestion: context.latestClassification?.followUpQuestion ?? null,
      trackingToken: context.ticket?.trackingToken ?? null,
      handoffRequested,
    };
  }
}
