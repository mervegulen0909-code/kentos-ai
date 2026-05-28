import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DuplicateCandidate {
  id: string;
  ticketNo: string;
  title: string;
  similarity: number;
}

@Injectable()
export class SemanticDuplicateService {
  private readonly logger = new Logger(SemanticDuplicateService.name);
  private get db(): any { return this.prisma; }

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async embed(text: string): Promise<number[]> {
    // Anthropic doesn't have a native embedding API — use a simple hash-based vector as fallback
    // In production, integrate with OpenAI text-embedding-3-small or a local model
    try {
      // Attempt to call a real embedding provider if configured
      if (process.env.OPENAI_API_KEY) {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
        });
        if (res.ok) {
          const data = await res.json() as { data: Array<{ embedding: number[] }> };
          return data.data[0]!.embedding;
        }
      }
    } catch (e) {
      this.logger.warn('Embedding call failed, using Anthropic AI similarity instead');
    }
    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findDuplicates(user: AuthenticatedUser, ticketId: string): Promise<DuplicateCandidate[]> {
    const ticket = await this.db.ticket.findFirst({ where: { id: ticketId, tenantId: user.tenantId } });
    if (!ticket) return [];

    const inputText = `${ticket.title} ${ticket.description}`;

    // Try vector-based similarity first
    const embedding = await this.embed(inputText);

    if (embedding.length > 0) {
      return this.findByVector(user.tenantId, ticketId, embedding);
    }

    // Fallback: use Anthropic to identify duplicates from recent tickets
    return this.findByAi(user.tenantId, ticketId, inputText);
  }

  private async findByVector(tenantId: string, excludeId: string, embedding: number[]): Promise<DuplicateCandidate[]> {
    // Store embedding on current ticket
    await this.db.ticket.update({
      where: { id: excludeId },
      data: { embeddingJson: JSON.stringify(embedding) },
    });

    // Fetch recent tickets with stored embeddings
    const candidates = await this.db.ticket.findMany({
      where: { tenantId, id: { not: excludeId }, embeddingJson: { not: null } },
      select: { id: true, ticketNo: true, title: true, embeddingJson: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return candidates
      .map((c: { id: string; ticketNo: string; title: string; embeddingJson: string }) => ({
        id: c.id,
        ticketNo: c.ticketNo,
        title: c.title,
        similarity: this.cosineSimilarity(embedding, JSON.parse(c.embeddingJson)),
      }))
      .filter((c: DuplicateCandidate) => c.similarity > 0.85)
      .sort((a: DuplicateCandidate, b: DuplicateCandidate) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  private async findByAi(tenantId: string, excludeId: string, inputText: string): Promise<DuplicateCandidate[]> {
    const candidates = await this.db.ticket.findMany({
      where: { tenantId, id: { not: excludeId } },
      select: { id: true, ticketNo: true, title: true, description: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (candidates.length === 0) return [];

    const prompt = `Aşağıdaki başvuruya benzer (muhtemel duplicate) başvuruları tespit et.

YENİ BAŞVURU:
${inputText}

MEVCUT BAŞVURULAR (JSON):
${JSON.stringify(candidates.map((c: { id: string; ticketNo: string; title: string; description: string }) => ({ id: c.id, ticketNo: c.ticketNo, title: c.title })))}

0.85'ten yüksek benzerlik skoru olan başvuruların id'lerini ve tahmini skorlarını JSON array olarak döndür:
[{"id":"...","similarity":0.92}, ...]
Hiç yoksa boş array döndür: []`;

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return [];

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) return [];
      const data = await res.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content[0]?.type === 'text' ? data.content[0].text : '[]';
      const match = text.match(/\[[\s\S]*\]/);
      const results: Array<{ id: string; similarity: number }> = match ? JSON.parse(match[0]) : [];

      return results
        .map((r) => {
          const candidate = candidates.find((c: { id: string; ticketNo: string; title: string }) => c.id === r.id);
          return candidate ? { id: candidate.id, ticketNo: candidate.ticketNo, title: candidate.title, similarity: r.similarity } : null;
        })
        .filter(Boolean) as DuplicateCandidate[];
    } catch {
      return [];
    }
  }

  async markAsDuplicate(user: AuthenticatedUser, ticketId: string, duplicateOfTicketId: string) {
    return this.db.ticket.update({
      where: { id: ticketId, tenantId: user.tenantId },
      data: { duplicateOfTicketId },
    });
  }
}
