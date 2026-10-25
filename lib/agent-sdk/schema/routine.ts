import { z } from 'zod'

/**
 * Image 2: agent-response-schema.ts
 * Structured Routine & Agent Response Schema
 */
export const routineSchema = z.object({
  name: z.string(),
  goal: z.string(),
  // Generated for this routine only.
  instructions: z.string(),
  schedule: z.object({
    startDate: z.string(), // YYYY-MM-DD
    time: z.string(), // HH:MM
    timezone: z.string(), // e.g. "Asia/Jakarta" or "America/New_York"
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    weekdays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])),
  }),
  tools: z.array(
    z.object({
      slug: z.string(),
      reason: z.string(),
    })
  ),
})

export const agentResponseSchema = z.object({
  type: z.enum([
    'message',
    'clarification',
    'clarification_required',
    'routine',
    'tool_connection',
    'connection_required',
    'selection_required',
    'confirmation_required',
    'completed',
  ]),
  message: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()).optional(),
      fieldType: z.enum(['time', 'options', 'channel', 'text', 'date']).optional(),
      defaultValue: z.string().optional(),
    })
  ),
  routine: routineSchema.nullable().optional(),
  suggestedTools: z
    .array(
      z.object({
        slug: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  assumptions: z.array(z.string()).optional(),
})

export type RoutineDraft = z.infer<typeof routineSchema>
export type AgentResponse = z.infer<typeof agentResponseSchema>
