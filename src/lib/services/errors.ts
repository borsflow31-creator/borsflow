/**
 * A rejected create/update that the caller should show to the user as-is, with
 * the HTTP status a route would answer with. Anything else thrown by a service
 * is an unexpected failure.
 */
export class ServiceError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
    this.name = 'ServiceError'
  }
}
