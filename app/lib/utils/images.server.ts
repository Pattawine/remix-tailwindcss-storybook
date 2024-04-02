import type { FormatEnum } from 'sharp'
import sharp from 'sharp'
import { MAX_IMAGE_SIZE } from '~/lib/core/constants.server'
import type { Vector2 } from '../core/inference.server'

/**
 * Fail on truncated images. This is to allow us to load broken Samsung images.
 * @see https://github.com/lovell/sharp/issues/2780#issuecomment-1403891250
 */
export const FAIL_ON = 'truncated'

/**
 * Downscale picture to save bandwidth and rotate based on EXIF orientation
 * @param picture An array buffer of the picture (e.g. from `await File.arrayBuffer()`)
 * @returns A sharp object that can be used to process the picture
 */
export function downscalePictureAndRotate(picture: ArrayBuffer) {
  const processingPicture = sharp(picture, { failOn: FAIL_ON })
    // set max width and height to save bandwidth while preserving aspect ratio
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    // rotate picture based on EXIF orientation (important for photos taken with mobile phones)
    .rotate()
  return processingPicture
}

/**
 * Prepare the image buffer and metadata for uploading to S3.
 */
export async function prepareImageBufferAndMeta(
  image: File | sharp.Sharp,
  imageFormat: keyof FormatEnum,
) {
  // Check image format
  if (imageFormat && ['png', 'jpeg', 'bmp', 'webp', 'gif'].indexOf(imageFormat) < 0) {
    throw new Error('Unsupported image format: ' + imageFormat)
  }

  // Prepare the image buffer and metadata
  let buffer: Buffer
  let mimeType: string
  let extension: string

  // convert image to specified format
  const sharpInstance =
    image instanceof File ? sharp(await image.arrayBuffer(), { failOn: FAIL_ON }) : image
  buffer = await sharpInstance.toFormat(imageFormat).toBuffer()
  mimeType = `image/${imageFormat}`
  extension = imageFormat

  return { buffer, mimeType, extension }
}

/**
 * Check if a file is an image.
 * @param file The file to check.
 * @returns Whether the file is an image.
 * @see https://github.com/lovell/sharp/issues/1298#issuecomment-405900215
 */
export async function isImageFile(file: File) {
  try {
    await sharp(await file.arrayBuffer(), { failOn: FAIL_ON }).stats()
    return true
  } catch (err) {
    console.error('Error checking if file is an image:', err)
    return false
  }
}
/**
 * Gets the `[width, height]` dimensions of an image. Will return [0, 0] if the image is invalid.
 *
 * @param image the image to get the size of
 * @returns the size of the image as [width, height]
 */
export async function getImageSize(image: File | Buffer | ArrayBuffer | string): Promise<Vector2> {
  if (image instanceof File) {
    image = await image.arrayBuffer()
  }
  return getImageSizeSharp(sharp(image, { failOn: FAIL_ON }))
}

/**
 * Gets the `[width, height]` dimensions of an image. Will return [0, 0] if the image is invalid.
 *
 * @param image the image to get the size of as a Sharp instance
 * @returns the size of the image as [width, height]
 */
export async function getImageSizeSharp(image: sharp.Sharp): Promise<Vector2> {
  // this is wrong because it doesn't take into account resizing
  // check this issue: https://github.com/lovell/sharp/issues/3120
  // const meta = await image.metadata()
  // return [meta.width ?? 0, meta.height ?? 0]
  const { info } = await image.toBuffer({ resolveWithObject: true })
  return [info.width ?? 0, info.height ?? 0]
}
