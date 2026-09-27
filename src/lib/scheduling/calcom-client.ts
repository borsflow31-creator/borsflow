import axios, { AxiosInstance } from 'axios';
import { SchedulingError, SchedulingErrorCode } from './errors';

export interface CalComBooking {
  id: number;
  uid: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: {
    name: string;
    email: string;
    timeZone: string;
  }[];
  user: {
    name: string;
    email: string;
    timeZone: string;
  };
  eventTypeId: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export class CalComClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.cal.com/v2',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetches all bookings for the user
   */
  async getBookings(params: {
    status?: string;
    take?: number;
    skip?: number;
  } = {}): Promise<CalComBooking[]> {
    try {
      const response = await this.client.get('/bookings', { params });
      // v2 response shape: { status: 'success', data: [...] }
      return response.data?.data ?? [];
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Cancels a booking via UID (v2 uses POST /bookings/:uid/cancel)
   */
  async cancelBooking(uid: string, reason?: string) {
    try {
      const response = await this.client.post(`/bookings/${uid}/cancel`, { reason });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Gets specific booking details
   */
  async getBooking(uid: string): Promise<CalComBooking> {
    try {
      const response = await this.client.get(`/bookings/${uid}`);
      // v2 response shape: { status: 'success', data: { ... } }
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Formats API errors into standard SchedulingErrors
   */
  private handleError(error: any): SchedulingError {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) return new SchedulingError('Cal.com: Unauthorized', SchedulingErrorCode.UNAUTHORIZED);
      if (status === 403) return new SchedulingError('Cal.com: Forbidden access', SchedulingErrorCode.FORBIDDEN);
      if (status === 404) return new SchedulingError('Cal.com: Booking not found', SchedulingErrorCode.NOT_FOUND);

      return new SchedulingError(`Cal.com API error: ${status}`, SchedulingErrorCode.PROVIDER_ERROR, error.response.data);
    }
    return new SchedulingError('Cal.com: Network error or timeout', SchedulingErrorCode.INTERNAL_ERROR);
  }
}
