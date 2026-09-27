import axios, { AxiosInstance } from 'axios';
import { SchedulingError, SchedulingErrorCode } from './errors';

export interface ZoomMeeting {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  agenda?: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password?: string;
  h323_password?: string;
  pstn_password?: string;
  encrypted_password?: string;
}

export class ZoomClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.zoom.us/v2',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a Zoom meeting for a user
   */
  async createMeeting(userId: string = 'me', meeting: {
    topic: string;
    type?: number;
    start_time?: string;
    duration?: number;
    timezone?: string;
    agenda?: string;
    password?: string;
    settings?: any;
  }): Promise<ZoomMeeting> {
    try {
      const response = await this.client.post(`/users/${userId}/meetings`, {
        ...meeting,
        type: meeting.type || 2, // 2 is scheduled, 1 is instant
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a meeting
   */
  async deleteMeeting(meetingId: number | string) {
    try {
      await this.client.delete(`/meetings/${meetingId}`);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Gets specific meeting details
   */
  async getMeeting(meetingId: number | string): Promise<ZoomMeeting> {
    try {
      const response = await this.client.get(`/meetings/${meetingId}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Formats Zoom API errors into standard SchedulingErrors
   */
  private handleError(error: any): SchedulingError {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) return new SchedulingError('Zoom: Unauthorized', SchedulingErrorCode.UNAUTHORIZED);
      if (status === 403) return new SchedulingError('Zoom: Forbidden access', SchedulingErrorCode.FORBIDDEN);
      if (status === 404) return new SchedulingError('Zoom: Meeting not found', SchedulingErrorCode.NOT_FOUND);
      if (status === 429) return new SchedulingError('Zoom: Rate limit reached', SchedulingErrorCode.PROVIDER_ERROR, data);
      
      return new SchedulingError(`Zoom API error: ${status}`, SchedulingErrorCode.PROVIDER_ERROR, data);
    }
    return new SchedulingError('Zoom: Network error or timeout', SchedulingErrorCode.INTERNAL_ERROR);
  }
}
