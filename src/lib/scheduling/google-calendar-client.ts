import axios from 'axios';
import { SchedulingError, SchedulingErrorCode } from './errors';

export interface GoogleCalendarEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: {
    email: string;
    responseStatus?: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    resource?: boolean;
    optional?: boolean;
    comment?: string;
    additionalGuests?: number;
  }[];
  conferenceData?: {
    conferenceId: string;
    conferenceSolution: {
      key: {
        type: string;
      };
      name: string;
      iconUri: string;
    };
    entryPoints: {
      entryPointType: string;
      uri: string;
      label?: string;
      pin?: string;
      accessCode?: string;
      meetingCode?: string;
      passcode?: string;
      password?: string;
    }[];
  };
  creator: {
    email: string;
  };
}

export class GoogleCalendarClient {
  private baseURL = 'https://www.googleapis.com/calendar/v3';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Helper for axios requests with auth
   */
  private async request(method: string, url: string, data?: any, params?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${url}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
        params
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Lists events for a specific calendar
   */
  async listEvents(calendarId: string = 'primary', params: any = {}): Promise<GoogleCalendarEvent[]> {
    const data = await this.request('GET', `/calendars/${calendarId}/events`, null, params);
    return data.items;
  }

  /**
   * Creates a new event, optionally with conference data (Meet)
   */
  async createEvent(calendarId: string = 'primary', event: any): Promise<GoogleCalendarEvent> {
    const params = { conferenceDataVersion: 1 };
    return await this.request('POST', `/calendars/${calendarId}/events`, event, params);
  }

  /**
   * Deletes an event from the calendar
   */
  async deleteEvent(calendarId: string = 'primary', eventId: string) {
    await this.request('DELETE', `/calendars/${calendarId}/events/${eventId}`);
  }

  /**
   * Gets details of a specific event
   */
  async getEvent(calendarId: string = 'primary', eventId: string): Promise<GoogleCalendarEvent> {
    return await this.request('GET', `/calendars/${calendarId}/events/${eventId}`);
  }

  /**
   * Formats Google API errors into standard SchedulingErrors
   */
  private handleError(error: any): SchedulingError {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) return new SchedulingError('Google: Unauthorized access', SchedulingErrorCode.UNAUTHORIZED);
      if (status === 403) return new SchedulingError('Google: Forbidden access', SchedulingErrorCode.FORBIDDEN);
      if (status === 404) return new SchedulingError('Google: Event not found', SchedulingErrorCode.NOT_FOUND);
      
      return new SchedulingError(`Google API error: ${status}`, SchedulingErrorCode.PROVIDER_ERROR, data);
    }
    return new SchedulingError('Google: Network error or timeout', SchedulingErrorCode.INTERNAL_ERROR);
  }
}
