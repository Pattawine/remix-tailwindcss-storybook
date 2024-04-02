import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { invariant } from '@epic-web/invariant'
import path from 'path'

// check API reference here: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
const s3 = new S3Client({})

export type S3UploadFileOptions = {
  bucket: string
  folder: string
  fileName: string
  buffer: Buffer
  mimeType: string
  signUrl?: boolean
}

/**
 * Returns the key for an object in an S3 bucket.
 *
 * @param {string} folder - The folder path of the object in the S3 bucket e.g. 'myFolder/mySubFolder'.
 * @param {string} filename - The name of the object in the S3 bucket e.g. 'myFile.png'.
 * @returns {string} The key for the object in the S3 bucket e.g. 'myFolder/mySubFolder/myFile.png'.
 */
export function getObjectKey(folder: string, filename: string): string {
  return path.join(folder, filename).replaceAll('\\', '/') // s3 expects forward slashes
}

/**
 * Returns the public URL of an object in an S3 bucket e.g. https://my-bucket.s3.amazonaws.com/my-folder/my-file.png
 *
 * @param {string} bucket - The name of the S3 bucket.
 * @param {string} folder - The folder path of the object in the S3 bucket.
 * @param {string} filename - The name of the object in the S3 bucket.
 * @returns {string} The public URL of the object in the S3 bucket.
 */
export function getObjectUrl(bucket: string, folder: string, filename: string): string {
  return `https://${bucket}.s3.amazonaws.com/${getObjectKey(folder, filename)}`
}

/**
 * Returns the components of an S3 object URL.
 * @param url - The URL of the S3 object.
 * @returns The bucket, folder, and filename of the S3 object.
 * @example
 * getObjectComponents('https://my-bucket.s3.amazonaws.com/my-folder/my-file.png')
 * returns { bucket: 'my-bucket', folder: 'my-folder', filename: 'my-file.png' }
 * getObjectComponents('https://my-bucket.s3.amazonaws.com/my-file.png')
 * returns { bucket: 'my-bucket', folder: '', filename: 'my-file.png' }
 */
export function getObjectComponents(url: string): {
  bucket: string
  folder: string
  filename: string
} {
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '')
  const bucket = urlWithoutProtocol.split('.')[0]
  const key = urlWithoutProtocol.split(`${bucket}.s3.amazonaws.com/`)[1]
  const folder = path.dirname(key)
  const filename = path.basename(key)
  return { bucket, folder, filename }
}

/**
 * Retrieves the components of objects from the given URLs.
 * @param urls - An array of URLs representing the objects.
 * @returns An object containing the buckets, folders, and filenames of the objects.
 */
export function getObjectsComponents(urls: string[]): {
  buckets: string[]
  folders: string[]
  filenames: string[]
} {
  const buckets: string[] = []
  const folders: string[] = []
  const filenames: string[] = []
  urls.forEach((url) => {
    const { bucket, folder, filename } = getObjectComponents(url)
    buckets.push(bucket)
    folders.push(folder)
    filenames.push(filename)
  })
  return { buckets, folders, filenames }
}

/**
 * Removes the signed information from a presigned URL. This is useful for displaying public URLs.
 * If the URL is not signed, it will be returned as is.
 */
export function removeSign(url: string): string {
  return url.split('?')[0]
}

/**
 * Upload a file to an S3 bucket and return a URL to the file. The URL will be presigned if `signUrl`
 * is true.
 */
export async function uploadFileToBucket({
  bucket,
  folder,
  fileName,
  buffer,
  mimeType,
  signUrl = false,
}: S3UploadFileOptions) {
  // Upload the file to the S3 bucket
  const key = getObjectKey(folder, fileName)
  const response = await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  )

  // return URL to the file
  if (signUrl) {
    // Generate a presigned URL for the uploaded image that expires in 7 days
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    return await getSignedUrl(s3, command, { expiresIn: 604800 })
  } else {
    return getObjectUrl(bucket, folder, fileName)
  }
}

/**
 * Deletes an object from an S3 bucket.
 *
 * @param bucket - The name of the S3 bucket.
 * @param folder - The folder path of the object in the S3 bucket.
 * @param filename - The name of the object in the S3 bucket.
 * @returns A promise that resolves when the object is deleted.
 */
export function deleteFileFromBucket(bucket: string, folder: string, filename: string) {
  return s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: getObjectKey(folder, filename),
    }),
  )
}

/**
 * Deletes multiple objects from an S3 bucket.
 *
 * @param bucket - The name of the S3 bucket.
 * @param folders - The folder paths of the objects in the S3 bucket.
 * @param filenames - The names of the objects in the S3 bucket.
 * @returns A promise that resolves when the objects are deleted.
 */
export function deleteFilesFromBucket(bucket: string, folders: string[], filenames: string[]) {
  invariant(
    folders.length === filenames.length,
    'The number of folders must be equal to the number of filenames',
  )

  return s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: filenames.map((filename, index) => ({
          Key: getObjectKey(folders[index], filename),
        })),
      },
    }),
  )
}
