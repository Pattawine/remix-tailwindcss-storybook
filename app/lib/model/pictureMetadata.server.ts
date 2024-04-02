import type { Prisma } from '@prisma/client'
import crypto from 'crypto'
import type sharp from 'sharp'
import { S3_BUCKET, SOURCE_PICTURES_FOLDER } from '../core/constants.server'
import { deleteFileFromBucket, uploadFileToBucket } from '../third-party/aws-utils.server'
import { prisma } from '../third-party/prisma.server'
import { generateUniqueFilename } from '../utils/general.server'
import {
  downscalePictureAndRotate,
  getImageSize,
  getImageSizeSharp,
  prepareImageBufferAndMeta,
} from '../utils/images.server'

export type PictureMetadataFull = Prisma.PictureMetadataGetPayload<{
  include: {
    faceDetectionJob: true
  }
}>

/**
 * Downscale the picture, then try to get picture metadata from the database given its hash.
 * If it doesn't exist, upload the picture to S3 and create a new picture metadata entry.
 * @param userId - The ID of the user who uploaded the picture.
 * @param picture - The picture file to upload.
 * @returns The picture metadata.
 * @throws If the picture metadata could not be created.
 */
export async function getOrUploadDownscaledPictureToS3(
  userId: string,
  picture: File,
): Promise<PictureMetadataFull> {
  const buffer = await picture.arrayBuffer()
  const [origWidth, origHeight] = await getImageSize(buffer)
  console.log(`Got picture to downscale with size ${origWidth}x${origHeight}`)

  // downscale picture
  const downscaleSharp = await downscalePictureAndRotate(buffer)
  const downscaledPicture = await downscaleSharp.toBuffer()
  const [width, height] = await getImageSize(downscaledPicture)
  console.log(`Downscaled picture to ${width}x${height}`)

  return await getOrUploadPictureToS3(userId, downscaleSharp, { origWidth, origHeight })
}

/**
 * Try to get picture metadata from the database given its hash. If it doesn't exist, upload the
 * picture to S3 and create a new picture metadata entry.
 * @param userId - The ID of the user who uploaded the picture.
 * @param picture - The picture file to upload as a Sharp object.
 * @returns The picture metadata.
 * @throws If the picture metadata could not be created.
 */
export async function getOrUploadPictureToS3(
  userId: string,
  picture: sharp.Sharp,
  { origWidth, origHeight }: { origWidth?: number; origHeight?: number } = {
    origWidth: undefined,
    origHeight: undefined,
  },
): Promise<PictureMetadataFull> {
  const [width, height] = await getImageSizeSharp(picture)
  console.log(`Got picture with size ${width}x${height}`)

  // get buffer and metadata
  const { buffer, mimeType, extension } = await prepareImageBufferAndMeta(picture, 'jpeg')

  // calculate hash from the processed picture
  const md5Hash = crypto.createHash('md5').update(buffer).digest('hex')

  // if the hash already exists in the database, return the metadata associated with it
  const meta = (await prisma.pictureMetadata.findUnique({
    where: { md5Hash },
  })) as PictureMetadataFull | null
  if (meta) {
    console.log(`Found existing picture with url ${meta.url}`)
    // we separate query commands because prisma doesn't work well with MongoDB when you use "include"
    // see: https://github.com/prisma/prisma/issues/15156
    meta.faceDetectionJob = await prisma.faceDetectionJob.findUnique({
      where: { pictureMetaId: meta.id },
    })
    return meta
  }

  // otherwise, upload the picture to S3 and create a new metadata entry
  const bucket = S3_BUCKET
  const folder = SOURCE_PICTURES_FOLDER
  const fileName = generateUniqueFilename(extension)
  const url = await uploadFileToBucket({
    bucket,
    folder,
    fileName,
    buffer,
    mimeType,
  })
  console.log(`Uploaded picture to S3 bucket with URL ${url}`)

  // could fail if a picture metadata entry with the same hash was created in the meantime
  // e.g. if two users upload the same picture at the same time or if the user uploads the same
  // picture on two different devices at the same time
  try {
    const createdMeta = await prisma.pictureMetadata.create({
      data: {
        userId,
        bucket,
        folder,
        fileName,
        fileSize: buffer.length,
        mimeType,
        origWidth: origWidth ?? width,
        origHeight: origHeight ?? height,
        width,
        height,
        md5Hash,
        url,
      },
    })
    return createdMeta as PictureMetadataFull
  } catch (error) {
    console.log(`Failed to create picture metadata: ${error}`)
    console.log('Deleting uploaded file...')
    await deleteFileFromBucket(bucket, folder, fileName)
    throw error
  }
}
