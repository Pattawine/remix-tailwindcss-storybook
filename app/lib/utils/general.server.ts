import { v4 as uuidv4 } from 'uuid'

export function getIpAddress(request: Request) {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for') ?? ''
}

/**
 * Generate a unique filename with the current timestamp and a random UUID.
 */
export function generateUniqueFilename(extension: string) {
  const time = new Date().toISOString().replace(/[:.]/g, '-') // e.g. 2023-07-29T17-55-55-555Z
  const filename = `${time}_${uuidv4().slice(0, 8)}.${extension}`
  return filename
}
