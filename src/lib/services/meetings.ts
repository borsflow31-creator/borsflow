import { prisma } from '@/lib/prisma'
import { ZoomClient } from '@/lib/scheduling/zoom-client'
import { decrypt } from '@/lib/encryption'
import { leadBelongsToWorkspace } from '@/lib/api/workspace'
import { ServiceError } from './errors'
import { notify } from '@/lib/notifications/notify'

/**
 * Create a meeting, and a Zoom meeting for it when `platform` is 'zoom' and the
 * workspace has Zoom connected. The caller must already have checked access.
 */
export async function createMeeting(params: {
  workspaceId: string
  userId: string
  title: string
  startTime: string | Date
  /** Minutes. Routes may pass the raw body value, so strings are accepted. */
  duration: number | string
  platform?: string | null
  leadId?: string | null
}) {
  const { workspaceId, userId, title, startTime, platform, leadId } = params
  const duration = Number(params.duration)

  const start = new Date(startTime)
  if (isNaN(start.getTime())) {
    throw new ServiceError('startTime is not a valid date')
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ServiceError('duration must be a positive number of minutes')
  }

  if (leadId && !(await leadBelongsToWorkspace(leadId, workspaceId))) {
    throw new ServiceError('Lead not found in this workspace')
  }

  let meetingUrl = ''
  let platformMeetingId = ''

  // If Zoom is requested, create it via Zoom API
  if (platform === 'zoom') {
    const config = await prisma.videoConferenceConfig.findFirst({
      where: { workspaceId, platform: 'zoom', isActive: true },
    })

    if (config?.accessToken) {
      const zoomClient = new ZoomClient(decrypt(config.accessToken))
      try {
        const zoomMeeting = await zoomClient.createMeeting('me', {
          topic: title,
          start_time: start.toISOString(),
          duration: duration,
        })
        meetingUrl = zoomMeeting.join_url
        platformMeetingId = String(zoomMeeting.id)
      } catch (err: any) {
        console.error('Zoom meeting creation failed:', err.message)
      }
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      workspaceId,
      title,
      startTime: start,
      endTime: new Date(start.getTime() + duration * 60000),
      duration,
      platform: platform || 'in_person',
      meetingType: platform ? 'online' : 'in_person',
      meetingUrl,
      platformMeetingId,
      leadId,
      userId,
      createdById: userId,
    },
  })

  // Fire-and-forget: notify the host. A no-op today (the caller is always the
  // host), but keeps this correct once a meeting can be booked for someone else.
  void notify({
    recipients: [userId],
    type: 'meetings.booked',
    workspaceId,
    actorId: userId,
    title: `Meeting booked: ${title}`,
    body: start.toLocaleString(),
    href: `/meetings?workspace=${workspaceId}`,
  })

  return meeting
}
