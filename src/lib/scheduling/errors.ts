export enum SchedulingErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class SchedulingError extends Error {
  public code: SchedulingErrorCode;
  public details?: any;

  constructor(message: string, code: SchedulingErrorCode = SchedulingErrorCode.INTERNAL_ERROR, details?: any) {
    super(message);
    this.name = 'SchedulingError';
    this.code = code;
    this.details = details;
  }
}

export function handleSchedulingError(error: any): SchedulingError {
  if (error instanceof SchedulingError) return error;
  
  if (error.response) {
    // Handling axios/fetch errors from providers
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401) return new SchedulingError('Provider auth failed', SchedulingErrorCode.UNAUTHORIZED, data);
    if (status === 403) return new SchedulingError('Protocol forbidden', SchedulingErrorCode.FORBIDDEN, data);
    if (status === 404) return new SchedulingError('Resource not found on provider', SchedulingErrorCode.NOT_FOUND, data);
    
    return new SchedulingError(`Provider returned error: ${status}`, SchedulingErrorCode.PROVIDER_ERROR, data);
  }
  
  return new SchedulingError(error.message || 'An unknown error occurred', SchedulingErrorCode.INTERNAL_ERROR);
}
