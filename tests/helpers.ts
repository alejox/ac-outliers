import { scoreVideos, type Channel, type ScoredVideo, type Video } from '../shared/outliers'

export const NOW = new Date('2026-11-24T12:00:00Z')
export const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

let seq = 0
export function video(over: Partial<Video> = {}): Video {
  seq += 1
  return {
    id: `v${seq}`,
    channelId: 'c1',
    title: 't',
    thumbnailUrl: null,
    publishedAt: daysAgo(30),
    durationSeconds: 600,
    isShort: false,
    categoryId: null,
    views: 1000,
    likes: null,
    comments: null,
    ...over,
  }
}

export const scored = (videos: Video[]): ScoredVideo[] => scoreVideos(videos, NOW)

export function channel(over: Partial<Channel> = {}): Channel {
  return {
    id: 'c1',
    title: 'Canal',
    handle: null,
    thumbnailUrl: null,
    subscriberCount: 1000,
    viewCount: 50_000,
    videoCount: 20,
    lastSyncedAt: null,
    isMine: false,
    ...over,
  }
}
