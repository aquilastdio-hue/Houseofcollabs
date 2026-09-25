import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './client'
import { AppError, toAppError } from '@/lib/errors'

type FunctionErrorBody = { error?: string; code?: string }

/**
 * Invokes a Supabase Edge Function with the current session JWT and turns
 * error responses (`{ error, code }`) into user-safe AppErrors.
 */
export async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: body ?? {} })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let payload: FunctionErrorBody | null = null
      try {
        payload = (await (error.context as Response).json()) as FunctionErrorBody
      } catch {
        payload = null
      }
      const status = (error.context as Response).status
      throw new AppError(payload?.error ?? 'The request could not be completed. Please try again.', {
        code: payload?.code ?? 'FUNCTION_ERROR',
        status,
        kind: status === 401 ? 'auth' : status === 403 ? 'permission' : status === 404 ? 'not_found' : status === 422 || status === 400 ? 'validation' : 'server',
      })
    }
    throw toAppError(error)
  }
  return data as T
}
