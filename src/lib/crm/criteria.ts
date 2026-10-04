/**
 * Criteria evaluation.
 *
 * One evaluator, shared by segmentation (which rows belong to a segment),
 * automations (trigger conditions, step send-conditions, exit criteria) and
 * search-brief matching (which new listings fit a buyer's brief). A fork would
 * drift, and the three would stop agreeing on what "matches" means.
 *
 * Subject-agnostic by construction: it reads dotted field paths off whatever
 * object it is handed, so the same operators work on a lead, a property, an
 * interest or a mandate. There is deliberately no subjectType parameter --
 * knowing the type would invite per-type branches inside the one function that
 * must never grow them. Deciding which rows to hand in, with which relations
 * included, is the subject loader's job (src/lib/crm/subject-registry.ts).
 *
 * Pure: no prisma, no server-only imports, so the segment builder and the board
 * can import it directly and it can be exercised without a database.
 */

// Criteria structure
export interface Criteria {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'is_empty' | 'is_not_empty'
  value: any
  /** Always AND-ed, regardless of the rule's logicOperator */
  required?: boolean
}

/**
 * Check if a subject matches a set of criteria.
 */
export function matchesCriteria(
  subject: any,
  criteria: Criteria[],
  logicOperator: 'AND' | 'OR'
): boolean {
  if (!Array.isArray(criteria) || criteria.length === 0) return true
  // Required criteria (the pipeline/stage pick) scope the segment, so they
  // must match even when the remaining conditions are combined with OR.
  const required = criteria.filter(c => c.required)
  if (!required.every(criterion => matchesCriterion(subject, criterion))) return false
  const rest = criteria.filter(c => !c.required)
  if (rest.length === 0) return true
  if (logicOperator === 'AND') {
    return rest.every(criterion => matchesCriterion(subject, criterion))
  } else {
    return rest.some(criterion => matchesCriterion(subject, criterion))
  }
}

/**
 * Check if a subject matches a single criterion.
 */
export function matchesCriterion(subject: any, criterion: Criteria): boolean {
  const fieldValue = getFieldValue(subject, criterion.field)

  // The UI sends every value as text; compare numbers and dates by value, not
  // by strict identity with that text (which never matched).
  const asComparable = (v: any): number | null => {
    if (v instanceof Date) return v.getTime()
    if (typeof v === 'number') return v
    return null
  }
  const fieldNum = asComparable(fieldValue)
  const inputNum = fieldNum === null ? null
    : fieldValue instanceof Date ? Date.parse(String(criterion.value))
    : Number(criterion.value)
  const typed = fieldNum !== null && inputNum !== null && !Number.isNaN(inputNum)
  // A date "equals" a day, not an exact millisecond
  const sameDay = fieldValue instanceof Date && typed
    ? fieldValue.toISOString().slice(0, 10) === new Date(inputNum!).toISOString().slice(0, 10)
    : null

  switch (criterion.operator) {
    case 'equals':
      return sameDay ?? (typed ? fieldNum === inputNum : fieldValue === criterion.value)
    case 'not_equals':
      return sameDay !== null ? !sameDay : typed ? fieldNum !== inputNum : fieldValue !== criterion.value
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(criterion.value).toLowerCase())
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(criterion.value).toLowerCase())
    case 'starts_with':
      return String(fieldValue).toLowerCase().startsWith(String(criterion.value).toLowerCase())
    case 'ends_with':
      return String(fieldValue).toLowerCase().endsWith(String(criterion.value).toLowerCase())
    case 'greater_than':
      return typed ? fieldNum! > inputNum! : Number(fieldValue) > Number(criterion.value)
    case 'less_than':
      return typed ? fieldNum! < inputNum! : Number(fieldValue) < Number(criterion.value)
    // Case-insensitive: new leads default to stage "new" while pipelines name it "New"
    case 'in':
      return Array.isArray(criterion.value) && criterion.value.some((v: any) => String(v).toLowerCase() === String(fieldValue ?? '').toLowerCase())
    case 'not_in':
      return Array.isArray(criterion.value) && !criterion.value.some((v: any) => String(v).toLowerCase() === String(fieldValue ?? '').toLowerCase())
    case 'is_null':
    // SegmentModal labels these "is empty" / "is not empty"; accept both spellings
    // so criteria saved from the UI actually evaluate.
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_null':
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return false
  }
}

/**
 * Read a dotted field path off a subject: `stage`, `pipeline.name`,
 * `property.city`, `mandate.lead.email`, `customFields.heating`.
 *
 * Exported because brief matching builds its match reasons by reading individual
 * fields, and the criteria builder previews values with it.
 */
export function getFieldValue(subject: any, field: string): any {
  const parts = field.split('.')
  let value = subject

  for (const part of parts) {
    if (value === null || value === undefined) {
      return null
    }
    value = value[part]
  }

  return value
}

/**
 * Parse a stringified JSON column into a known shape, falling back rather than
 * throwing. Criteria, stage lists and trigger conditions are all stored as text,
 * and a malformed one must not take out the request that reads it.
 */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}
