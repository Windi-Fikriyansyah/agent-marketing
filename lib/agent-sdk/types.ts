import { z } from 'zod'
import { AgentResponse } from './schema/routine'

/**
 * 8 Execution Steps from "How Agent SDK Works"
 */
export type StepName =
  | 'user_request'
  | 'reason_plan'
  | 'check_instructions'
  | 'pick_tools'
  | 'run_tools'
  | 'review_results'
  | 'ask_approval'
  | 'final_response'

export interface AgentStepTrace {
  step: StepName
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'waiting_approval' | 'skipped' | 'failed'
  details?: any
  timestamp: string
}

export interface ApprovalRequest {
  id: string
  toolName: string
  parameters: Record<string, any>
  reason: string
  timestamp: string
}

export interface AgentExecutionContext {
  agentId: string
  agentName?: string
  systemPrompt?: string | null
  userId: string
  conversationId?: string
  sessionId?: string
  composioSession?: any
}

export interface AgentToolDefinition {
  name: string
  description: string
  parameters: z.ZodObject<any>
  requireApproval?: boolean
  execute: (args: any, context: AgentExecutionContext) => Promise<any>
}

export interface RecurringTaskSchema {
  instruction: string
  route: string
  date?: string
  time: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual'
}

export interface AgentRuntimeConfig {
  agentId: string
  name: string
  instructions: string
  model?: string
  tools?: AgentToolDefinition[]
  temperature?: number
  maxTurns?: number
  composioSessionId?: string | null
  connectedTools?: string[]
  userId?: string
}

export interface AgentStreamEvent {
  type:
    | 'step_start'
    | 'step_update'
    | 'step_complete'
    | 'approval_required'
    | 'connect_required'
    | 'token'
    | 'final_response'
    | 'error'
  step?: StepName
  stepNumber?: number
  trace?: AgentStepTrace
  data?: any
  taskSchema?: RecurringTaskSchema
  agentResponse?: AgentResponse
}
