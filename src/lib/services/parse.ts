import { parseNumericField } from '@/lib/products'
import { ServiceError } from './errors'

/**
 * Body-field readers for the real-estate services.
 *
 * Every reader distinguishes three states, because an update must tell them apart:
 *   undefined  the field was not sent: leave the column alone
 *   null       the field was sent empty: clear the column
 *   a value    the field was sent: validate and set it
 *
 * Invalid input throws ServiceError(400) naming the field, which the route turns
 * into `{ error }`. There is no zod in this codebase; this is the same hand-rolled
 * validation the existing routes use, kept in one place so properties, mandates and
 * offers judge a value the same way.
 */

type Input = Record<string, unknown>

export function has(input: Input, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined
}

export function readNumber(
  input: Input,
  key: string,
  label: string,
  options: { min?: number; integer?: boolean; required?: boolean } = {}
): number | null | undefined {
  if (!has(input, key)) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return undefined
  }
  const result = parseNumericField(input[key], label, options)
  if (!result.ok) throw new ServiceError(result.message)
  return result.value
}

export function readString(
  input: Input,
  key: string,
  label: string,
  options: { max?: number; required?: boolean } = {}
): string | null | undefined {
  if (!has(input, key)) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return undefined
  }
  const raw = input[key]
  if (raw === null) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return null
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new ServiceError(`${label} must be text`)
  }
  const value = String(raw).trim()
  if (!value) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return null
  }
  if (options.max && value.length > options.max) {
    throw new ServiceError(`${label} can be at most ${options.max} characters`)
  }
  return value
}

export function readBoolean(input: Input, key: string, label: string): boolean | undefined {
  if (!has(input, key)) return undefined
  const raw = input[key]
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new ServiceError(`${label} must be true or false`)
}

export function readEnum<T extends string>(
  input: Input,
  key: string,
  label: string,
  allowed: readonly T[],
  options: { required?: boolean; nullable?: boolean } = {}
): T | null | undefined {
  if (!has(input, key)) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return undefined
  }
  const raw = input[key]
  if ((raw === null || raw === '') && options.nullable) return null
  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) return raw as T
  throw new ServiceError(`${label} must be one of: ${allowed.join(', ')}`)
}

export function readDate(
  input: Input,
  key: string,
  label: string,
  options: { required?: boolean } = {}
): Date | null | undefined {
  if (!has(input, key)) {
    if (options.required) throw new ServiceError(`${label} is required`)
    return undefined
  }
  const raw = input[key]
  if (raw === null || raw === '') {
    if (options.required) throw new ServiceError(`${label} is required`)
    return null
  }
  const date = raw instanceof Date ? raw : new Date(String(raw))
  if (Number.isNaN(date.getTime())) throw new ServiceError(`${label} must be a valid date`)
  return date
}

/** An id column: a non-empty string, or null to clear. */
export function readId(input: Input, key: string, label: string): string | null | undefined {
  if (!has(input, key)) return undefined
  const raw = input[key]
  if (raw === null || raw === '') return null
  if (typeof raw !== 'string') throw new ServiceError(`${label} is invalid`)
  return raw
}

/** Drop every undefined entry, so the result is exactly what was sent. */
export function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}
