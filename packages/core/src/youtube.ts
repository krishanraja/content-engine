import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export interface YoutubeUploadInput {
  accessToken: string
  videoPath: string
  title: string
  description: string
  categoryId?: string
}

export async function uploadPrivateYoutubeVideo(input: YoutubeUploadInput): Promise<unknown> {
  const metadataResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: { title: input.title, description: input.description, categoryId: input.categoryId || '28' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!metadataResponse.ok) throw new Error(`YouTube resumable session failed: ${metadataResponse.status} ${await metadataResponse.text()}`)
  const uploadUrl = metadataResponse.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL')
  const info = await stat(input.videoPath)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4', 'content-length': String(info.size) },
    body: createReadStream(input.videoPath) as unknown as BodyInit,
    duplex: 'half',
    signal: AbortSignal.timeout(3_600_000),
  } as RequestInit & { duplex: 'half' })
  if (!uploadResponse.ok) throw new Error(`YouTube upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`)
  const result = await uploadResponse.json() as { status?: { privacyStatus?: string } }
  if (result.status?.privacyStatus !== 'private') throw new Error('YouTube response did not confirm private status')
  return result
}
