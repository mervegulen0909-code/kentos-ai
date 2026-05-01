import { z } from 'zod';

export const intakeClassificationSchema = z.object({
  language: z.enum(['tr', 'en', 'unknown']),
  intent: z.enum(['new_ticket', 'status_query', 'add_info', 'human_handoff', 'general_question', 'unsupported']),
  title: z.string().min(1),
  description: z.string().min(1),
  requestType: z.enum(['complaint', 'request', 'question', 'emergency_flag', 'other']),
  categoryCode: z.string().nullable(),
  departmentCode: z.string().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  urgencyReason: z.string().nullable(),
  addressText: z.string().nullable(),
  neighborhoodName: z.string().nullable(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracyMeters: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  citizenContact: z.object({
    phone: z.string().nullable(),
    email: z.string().email().nullable(),
    displayName: z.string().nullable(),
  }),
  missingFields: z.array(z.enum(['description', 'location', 'contact', 'category', 'photo'])),
  followUpQuestion: z.string().nullable(),
  statusTicketNo: z.string().nullable(),
  safetyFlags: z.array(z.enum(['threat', 'injury', 'fire', 'violence', 'animal_danger', 'none'])),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string(),
});

export type IntakeClassification = z.infer<typeof intakeClassificationSchema>;
