/**
 * This file contains constants, types, and functions related to AI inference.
 * It exports several types used to represent input and output data for the face detection and image
 * synthesis APIs.
 * It also contains a bunch of data preprocessing functions that are used to prepare data for the AI.
 */

import type sharp from 'sharp'
import { DOMAIN_URL } from './constants.server'

/* #region constants */
export const FACE_EMB_SEQ_LEN = 5
export const PUBLIC_TO_PRIVATE_MODEL_NAME: Record<PublicModelName, PrivateModelName> = {
  'Photorealistic 1': 'realisticVision',
  '3D Cartoon': 'disneyPixarA',
  'Photorealistic 2': 'aZovyaPhotoreal',
  '3D Animation': 'revAnimated',
  '2D Anime': 'anything',
}
export const MODELS: ModelRegistry = {
  realisticVision: {
    runpodEndpointId: 'okmpndf0qx8zhs',
    parameters: {
      guidance_scale: 7.5,
      controlnet_guidance_scale: 4.5,
      // bg_cond_scale: 0.5,
      face_cond_scale: 1,
    },
  },
  disneyPixarA: {
    runpodEndpointId: 'xgltn2vse1z89e',
    parameters: {
      guidance_scale: 3.5,
      controlnet_guidance_scale: 3.5,
      // bg_cond_scale: 0.5,
      face_cond_scale: 1,
    },
  },
  aZovyaPhotoreal: {
    runpodEndpointId: 'zvphwxorxtpju6',
    parameters: {
      guidance_scale: 7,
      controlnet_guidance_scale: 4.5,
      // bg_cond_scale: 0.5,
      face_cond_scale: 1,
    },
  },
  revAnimated: {
    runpodEndpointId: 'yqtmuzdu2si7mr',
    parameters: {
      guidance_scale: 7.5,
      controlnet_guidance_scale: 4.5,
      bg_cond_scale: 0.5,
      face_cond_scale: 1,
    },
  },
  anything: {
    runpodEndpointId: '4ll5ifqrj98awo',
    parameters: {
      guidance_scale: 5,
      controlnet_guidance_scale: 5,
      bg_cond_scale: 0.2,
      face_cond_scale: 1.2,
    },
  },
}

/* #endregion */

/* #region types */
// user-facing model names
export type PublicModelName =
  | 'Photorealistic 1'
  | '3D Cartoon'
  | 'Photorealistic 2'
  | '3D Animation'
  | '2D Anime'
export type PrivateModelName =
  | 'realisticVision'
  | 'disneyPixarA'
  | 'aZovyaPhotoreal'
  | 'revAnimated'
  | 'anything'
export type ModelMeta = {
  runpodEndpointId: string
  parameters: Partial<SynthesisInput>
  triggerPhrase?: string
}
export type ModelRegistry = {
  [modelName in PrivateModelName]: ModelMeta
}

/**
 * Type representing a bounding box.
 * Bounding box coordinates are represented as [x1, y1, x2, y2].
 */
export type BBox = [number, number, number, number]

/**
 * Type representing arbitrary 2D coordinates as [x, y].
 * Can also represent image size as [width, height].
 */
export type Vector2 = [number, number]

/**
 * Type representing the response of the runpod API.
 * If the status is 'IN_QUEUE' or 'CANCELLED', the response contains only the id and status fields.
 */
export type RunpodStatus = {
  id: string
  status: 'IN_QUEUE' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  delayTime?: number
  executionTime?: number
  input?: unknown
  output?: FaceDetectionOutput | SynthesisOutput
  error?: string
  webhook?: string
}

/**
 * Type representing the health of a runpod endpoint.
 */
export type RunpodHealth = {
  jobs: {
    completed: number
    failed: number
    inProgress: number
    inQueue: number
    retried: number
  }
  workers: {
    idle: number
    initializing: number
    ready: number
    running: number
    throttled: number
  }
}

/**
 * Type representing the output of the face detection API.
 * It's an array of face objects, each of which contains the following fields:
 * - embedding: the face embedding as a 512-dimensional vector
 * - bbox: the bounding box of the face with values constrained to the image size
 * - det_score: the face detection score in the range [0, 1]
 * - gender: 0=female, 1=male
 * - age: age in years
 */
export type FaceDetectionOutput = {
  embedding: number[]
  bbox: BBox
  det_score: number
  gender: number
  age: number
}[]

/**
 * Type representing the input of the image synthesis API. You can do txt2img and img2img.
 * Check `SYNTHESIS_SCHEMA` in the python code to see the full list of parameters.
 * If you don't specify a parameter, the default value in the python code will be used.
 */
export type SynthesisInput = {
  // txt2img params
  prompt: string
  negative_prompt?: string
  face_embeddings?: number[][]
  face_bboxes?: BBox[]
  width?: number
  height?: number
  scheduler?:
    | 'DDIM'
    | 'DDPM'
    | 'DEIS'
    | 'DPM-M'
    | 'DPM-S'
    | 'EULER-A'
    | 'EULER-D'
    | 'HEUN'
    | 'IPNDM'
    | 'KDPM2-A'
    | 'KDPM2-D'
    | 'PNDM'
    | 'K-LMS'
    | 'UNIPC'
  num_inference_steps?: number
  guidance_scale?: number
  controlnet_guidance_scale?: number
  bg_cond_scale?: number
  face_cond_scale?: number
  face_emb_scale?: number
  num_outputs?: number
  seed?: number

  // extra img2img params
  init_image?: string | null
  upscaler?: 'Lanczos' | 'Nearest' | '4x-UltraSharp' | null
  denoise_strength?: number
}

/**
 * Type representing the output of the image synthesis API.
 * It's an array of image objects, each of which contains the following fields:
 * - image: the URL of the synthesized image
 * - seed: the seed used to synthesize the image
 */
export type SynthesisOutput = {
  image: string
  seed: number
}[]

/* #endregion */

/* #region functions */

/**
 * Get the health of a runpod endpoint by ID. Timeout after 3 seconds.
 * @param runpodEndpointId the ID of the runpod endpoint
 * @returns the health of the runpod endpoint
 */
export async function getRunpodEndpointHealth(runpodEndpointId: string): Promise<RunpodHealth> {
  const endpoint = `https://api.runpod.ai/v2/${runpodEndpointId}/health`
  const runpodApiKey = process.env.RUNPOD_API_KEY
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runpodApiKey}`,
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(3_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RunpodHealth
  return data
}

/**
 * Treat the serverless endpoint like a function. You pass in the input and it returns the output.
 * Both input and output are JSON serializable objects.
 */
async function callRunpodEndpoint(
  runpodEndpointId: string,
  runpodApiKey: string,
  input: Record<string, unknown>,
  timeoutMs: number,
): Promise<FaceDetectionOutput | SynthesisOutput | undefined> {
  const endpoint = `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runpodApiKey}`,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RunpodStatus
  console.log('Runpod endpoint response:', data)
  if (data.error) {
    throw new Error(data.error)
  }
  if (data.status !== 'COMPLETED') {
    throw new Error(`Incomplete response status: ${data.status}`)
  }

  return data.output
}

/**
 * Submit runpod job and quickly return the job ID and status.
 * Input must be JSON serializable objects.
 * @param webhookRoute the pathname of the webhook route e.g. '/api/webhook' (must start with '/')
 */
async function callRunpodEndpointAsync(
  runpodEndpointId: string,
  runpodApiKey: string,
  input: Record<string, unknown>,
  webhookRoute: string,
): Promise<RunpodStatus> {
  const endpoint = `https://api.runpod.ai/v2/${runpodEndpointId}/run`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runpodApiKey}`,
  }
  const webhook = `https://${DOMAIN_URL}${webhookRoute}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, webhook }),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RunpodStatus
  console.log('Runpod endpoint response:', data)
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export async function detectFaces(
  runpodEndpointId: string,
  runpodApiKey: string,
  imageUrl: string,
): Promise<FaceDetectionOutput> {
  const input = { task: 'face_detection', image: imageUrl }
  const output = await callRunpodEndpoint(runpodEndpointId, runpodApiKey, input, 30_000)
  return output as FaceDetectionOutput
}

export async function detectFacesAsync(
  runpodEndpointId: string,
  runpodApiKey: string,
  imageUrl: string,
  webhookRoute: string,
): Promise<RunpodStatus> {
  const input = { task: 'face_detection', image: imageUrl }
  return await callRunpodEndpointAsync(runpodEndpointId, runpodApiKey, input, webhookRoute)
}

/**
 * Do txt2img, img2img, or upscaling here. Check the example synthesis input in mock-data.ts
 */
export async function synthesizeImages(
  runpodEndpointId: string,
  runpodApiKey: string,
  input: SynthesisInput,
): Promise<SynthesisOutput> {
  const recordInput = { ...input, task: 'synthesis' }
  const output = await callRunpodEndpoint(runpodEndpointId, runpodApiKey, recordInput, 60_000)
  return output as SynthesisOutput
}

/**
 * Do txt2img, img2img, or upscaling here. Check the example synthesis input in mock-data.ts
 */
export async function synthesizeImagesAsync(
  runpodEndpointId: string,
  runpodApiKey: string,
  input: SynthesisInput,
  webhookRoute: string,
): Promise<RunpodStatus> {
  const recordInput = { ...input, task: 'synthesis' }
  return await callRunpodEndpointAsync(runpodEndpointId, runpodApiKey, recordInput, webhookRoute)
}

/**
 * Check that we detected at least one face and no more than `maxFaces` faces.
 *
 * @param faces faces detected from detectFaces()
 * @param maxFaces maximum number of faces allowed (default: `FACE_EMB_SEQ_LEN`)
 * @throws {Error} if no faces were detected or if more than `FACE_EMB_SEQ_LEN` faces were detected
 * @deprecated just manually check the length of the array and throw an error yourself
 */
export function validateFaces(faces: FaceDetectionOutput, maxFaces?: number): void {
  maxFaces = maxFaces ?? FACE_EMB_SEQ_LEN
  if (faces.length === 0) {
    throw new Error(
      'We could not find a face in the photo. Maybe the face is too close to the camera or too far away. Please try a different photo.',
    )
  }
  if (faces.length > maxFaces) {
    throw new Error(
      `Only ${maxFaces} ${maxFaces == 1 ? 'face is' : 'faces are'} allowed but we detected` +
        ` ${faces.length} faces in your photo. Try a different photo with fewer faces.`,
    )
  }
}

export function extractBiggestFace(faces: FaceDetectionOutput): FaceDetectionOutput[number] {
  return faces.reduce((prev, curr) => {
    const prevArea = getBBoxArea(prev.bbox)
    const currArea = getBBoxArea(curr.bbox)
    return prevArea > currArea ? prev : curr
  })
}

/**
 * Get the area (`width * height`) of a bounding box.
 */
export function getBBoxArea(bbox: BBox): number {
  const [x1, y1, x2, y2] = bbox
  return (x2 - x1) * (y2 - y1)
}

/**
 * Resizes a bounding box after resizing an image.
 *
 * @param bbox The original bounding box coordinates `[x1, y1, x2, y2]`.
 * @param originalSize The original size of the image `[width, height]`.
 * @param newSize The new size of the image `[width, height]`.
 * @return The resized bounding box coordinates `[new_x1, new_y1, new_x2, new_y2]`.
 */
export function resizeBBox(bbox: BBox, originalSize: Vector2, newSize: Vector2): BBox {
  const [x1, y1, x2, y2] = bbox
  const new_x1 = (x1 * newSize[0]) / originalSize[0]
  const new_y1 = (y1 * newSize[1]) / originalSize[1]
  const new_x2 = (x2 * newSize[0]) / originalSize[0]
  const new_y2 = (y2 * newSize[1]) / originalSize[1]
  return [new_x1, new_y1, new_x2, new_y2]
}

/**
 * Translate bounding box coordinates by `[left, top]` and clip it to be within the crop region.
 * Think of this as cropping an image, not a bounding box. When you crop an image, you move from
 * one coordinate system to another. This function simply move the bounding box to be in the new
 * coordinate system.
 *
 * This function should be used along with `sharp().extract()`
 * @param bbox The original bounding box coordinates `[x1, y1, x2, y2]`.
 * @param region The region to crop the image to. The region is defined as `{ left, top, width, height }`.
 * @returns The translated and clipped bounding box coordinates `[new_x1, new_y1, new_x2, new_y2]`.
 */
export function cropBBox(bbox: BBox, { left, top, width, height }: sharp.Region): BBox {
  const [x1, y1, x2, y2] = bbox
  const new_x1 = x1 - left
  const new_y1 = y1 - top
  const new_x2 = x2 - left
  const new_y2 = y2 - top
  return clipBBox([new_x1, new_y1, new_x2, new_y2], width, height)
}

/**
 * Clips bounding box coordinates to be within the image boundaries.
 * @param bbox The bounding box to clip.
 * @param imageWidth The width of the image.
 * @param imageHeight The height of the image.
 * @returns The clipped bounding box. If the bounding box is completely outside the crop area,
 * 	its area will be zero.
 */
export function clipBBox(bbox: BBox, imageWidth: number, imageHeight: number): BBox {
  const [x1, y1, x2, y2] = bbox
  const new_x1 = Math.max(0, Math.min(x1, imageWidth))
  const new_y1 = Math.max(0, Math.min(y1, imageHeight))
  const new_x2 = Math.max(0, Math.min(x2, imageWidth))
  const new_y2 = Math.max(0, Math.min(y2, imageHeight))
  return [new_x1, new_y1, new_x2, new_y2]
}

/**
 * Linearly interpolates between two bounding boxes. The interpolation is controlled by the alpha value.
 *
 * @param startBox The start bounding box coordinates `[x1, y1, x2, y2]`.
 * @param endBox The end bounding box coordinates `[x1, y1, x2, y2]`.
 * @param alpha The interpolant. The first number is used for the x direction and the second
 * number is used for the y direction.
 * @returns The interpolated bounding box coordinates `[new_x1, new_y1, new_x2, new_y2]`.
 */
export function lerpBBox(startBox: BBox, endBox: BBox, alpha: Vector2): BBox {
  const alphas: BBox = [alpha[0], alpha[1], alpha[0], alpha[1]]
  const result: BBox = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    result[i] = startBox[i] + alphas[i] * (endBox[i] - startBox[i])
  }
  return result
}

/**
 * Returns the bounding box that encloses all the given bounding boxes.
 * If the array is empty, it returns `[Infinity, Infinity, -Infinity, -Infinity]`.
 * @param bboxes An array of bounding boxes to enclose.
 * @returns The bounding box that encloses all the given bounding boxes `[x1, y1, x2, y2]`.
 */
export function getEnclosingBBox(bboxes: BBox[]): BBox {
  return bboxes.reduce(
    ([x1, y1, x2, y2], [x1_, y1_, x2_, y2_]) => [
      Math.min(x1, x1_),
      Math.min(y1, y1_),
      Math.max(x2, x2_),
      Math.max(y2, y2_),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}

/**
 * Linearly interpolates between most top left bounding box and the most bottom right bounding box.
 * The interpolation is controlled by the alpha value. The resulting bounding box is guaranteed to
 * be inside the image if the alpha is between 0 and 1.
 *
 * @param imageWidth The width of the image.
 * @param imageHeight The height of the image.
 * @param boxWidth The width of the bounding box.
 * @param boxHeight The height of the bounding box.
 * @param boxAlpha The interpolant. The first number is used for the x direction and the second
 * number is used for the y direction.
 *
 * @returns The interpolated bounding box coordinates `[new_x1, new_y1, new_x2, new_y2]`.
 */
export function getBBoxFromAlpha(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
  boxAlpha: Vector2,
): BBox {
  const topLeftBox: BBox = [0, 0, boxWidth, boxHeight]
  const bottomRightBox: BBox = [
    imageWidth - boxWidth,
    imageHeight - boxHeight,
    imageWidth,
    imageHeight,
  ]
  return lerpBBox(topLeftBox, bottomRightBox, boxAlpha)
}

/**
 * Calculates the linear interpolant values of a bounding box relative to the size of an image.
 *
 * @param bbox The bounding box coordinates `[x1, y1, x2, y2]`.
 * @param imageWidth The width of the image.
 * @param imageHeight The height of the image.
 * @returns The alpha (linear-interpolant) values of the bounding box (alphaX, alphaY).
 */
export function getAlphaFromBBox(bbox: BBox, imageWidth: number, imageHeight: number): Vector2 {
  const [x1, y1, x2, y2] = bbox
  const sizeX = x2 - x1
  const sizeY = y2 - y1
  const alphaX = x1 / (imageWidth - sizeX)
  const alphaY = y1 / (imageHeight - sizeY)
  return [alphaX, alphaY]
}

/**
 * Translates a bounding box if it is outside the image, ensuring it stays within the image
 * boundaries. The bounding box must be smaller than the image otherwise it's impossible for the box
 * to stay within the image boundaries.
 * @param bbox - The bounding box to translate, in the format `[x1, y1, x2, y2]`.
 * @param imageWidth - The width of the image.
 * @param imageHeight - The height of the image.
 * @returns The translated bounding box, in the format `[x1, y1, x2, y2]`.
 */
export function shiftCoordinates(bbox: BBox, imageWidth: number, imageHeight: number): BBox {
  let [x1, y1, x2, y2] = bbox

  const bboxWidth = x2 - x1
  const bboxHeight = y2 - y1

  // Check if the bounding box is out of the image boundary and move it back into the image
  if (x1 < 0) {
    x1 = 0
    x2 = x1 + bboxWidth
  }
  if (y1 < 0) {
    y1 = 0
    y2 = y1 + bboxHeight
  }
  if (x2 > imageWidth) {
    x2 = imageWidth
    x1 = x2 - bboxWidth
  }
  if (y2 > imageHeight) {
    y2 = imageHeight
    y1 = y2 - bboxHeight
  }

  return [x1, y1, x2, y2]
}

/**
 * Calculates the maximum crop size for an image based on its dimensions and a given aspect ratio.
 * @param imageWidth The width of the original image in pixels.
 * @param imageHeight The height of the original image in pixels.
 * @param whAspectRatio The aspect ratio to use for the crop, expressed as a width-to-height ratio.
 * @returns A Vector2 tuple representing the maximum crop size, where the first element is the width
 * 	and the second element is the height.
 * @example getMaxCropSize(1000, 500, 1) // returns [500, 500]
 */
export function getMaxCropSize(
  imageWidth: number,
  imageHeight: number,
  whAspectRatio: number,
): Vector2 {
  let cropWidth = imageWidth
  let cropHeight = imageHeight
  if (imageWidth / imageHeight > whAspectRatio) {
    cropWidth = imageHeight * whAspectRatio
  } else {
    cropHeight = imageWidth / whAspectRatio
  }
  return [cropWidth, cropHeight]
}

/**
 * Calculates the crop region for an image which yields a new image with the desired aspect ratio.
 * The crop region will preserve relative position of the bounding box.
 *
 * For example, if the bounding box is around the top of the image, the crop region
 * will make sure the bounding box stays around the top of the crop region.
 * @param imageWidth The width of the original image to crop in pixels.
 * @param imageHeight The height of the original image to crop in pixels.
 * @param whAspectRatio The aspect ratio to use for the crop, expressed as a width-to-height ratio.
 * @param bbox The region of interest to crop around e.g. a face bounding box or enclosing
 * 	bounding box of several faces.
 * @returns An object containing the crop region, in the format `{ left, top, width, height }`.
 * 		The crop region is relative to the original image. At least one side of the crop region
 * 		will be equal to the original image size.
 * @deprecated use getRelativeCropRegion2() instead
 */
export function getResponsiveCropRegion(
  imageWidth: number,
  imageHeight: number,
  whAspectRatio: number,
  bbox: BBox,
): sharp.Region {
  const [x1, y1, x2, y2] = bbox
  const [cropWidth, cropHeight] = getMaxCropSize(imageWidth, imageHeight, whAspectRatio)
  const topLeftCrop = shiftCoordinates(
    [x2 - cropWidth, y2 - cropHeight, x2, y2], // shares bottom right corner with bbox
    imageWidth,
    imageHeight,
  )
  const bottomRightCrop = shiftCoordinates(
    [x1, y1, x1 + cropWidth, y1 + cropHeight], // shares top left corner with bbox
    imageWidth,
    imageHeight,
  )

  // lerp from bottomright crop to topleft crop
  const alpha = getAlphaFromBBox(bbox, imageWidth, imageHeight)
  const middleCrop = lerpBBox(bottomRightCrop, topLeftCrop, alpha)

  return {
    left: Math.round(middleCrop[0]),
    top: Math.round(middleCrop[1]),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  }
}

/**
 * Calculates the crop region for an image which yields a new image with the desired aspect ratio.
 * The crop region will preserve relative position of the bounding box's middle point.
 * You can also zoom in to the middle point of the bbox.
 *
 * For example, if the bounding box is around the top of the image, the crop region
 * will make sure the bounding box stays around the top of the crop region.
 * @param imageWidth The width of the original image to crop in pixels.
 * @param imageHeight The height of the original image to crop in pixels.
 * @param whAspectRatio The aspect ratio to use for the crop, expressed as a width-to-height ratio.
 * @param bbox The region of interest to crop around e.g. a face bounding box or enclosing
 * 	bounding box of several faces.
 * @zoom The zoom level of the crop region. A zoom level of 1 means no zoom. Set to be higher than 1
 *   to zoom in to the middle point of the bbox.
 * @returns An object containing the crop region, in the format `{ left, top, width, height }`.
 * 		The crop region is relative to the original image. At least one side of the crop region
 * 		will be equal to the original image size.
 */
export function getRelativeCropRegion(
  imageWidth: number,
  imageHeight: number,
  whAspectRatio: number,
  bbox: BBox,
  zoom: number,
): sharp.Region {
  const [x1, y1, x2, y2] = bbox
  const [x, y] = [(x1 + x2) / 2, (y1 + y2) / 2] // middle point of bbox
  const [xp, yp] = [x / imageWidth, y / imageHeight] // middle point of bbox as a ratio

  const [cropWidth, cropHeight] = getMaxCropSize(imageWidth, imageHeight, whAspectRatio)
  let left = x - xp * cropWidth
  let top = y - yp * cropHeight
  let width = cropWidth
  let height = cropHeight

  // zoom in to the middle point of the bbox
  zoom = 1 / zoom // invert zoom so that zoom < 1 means zooming in
  if (zoom < 1) {
    left = x - (x - left) * zoom
    top = y - (y - top) * zoom
    width *= zoom
    height *= zoom
  }

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  }
}

/**
 * Returns the closest supported resolution for a given image width and height.
 * @param imageWidth - The width of the image.
 * @param imageHeight - The height of the image.
 * @param supportedResolutions - A list of supported resolutions, in the format `[width, height]`.
 * @returns A Vector2 object representing the closest supported resolution.
 */
export function getClosestSupportedResolution(
  imageWidth: number,
  imageHeight: number,
  supportedResolutions: Vector2[],
): Vector2 {
  const ar = imageWidth / imageHeight
  const closest = supportedResolutions.reduce((prev, curr) => {
    const prevAr = prev[0] / prev[1]
    const currAr = curr[0] / curr[1]
    const prevRatio = Math.max(prevAr, ar) / Math.min(prevAr, ar)
    const currRatio = Math.max(currAr, ar) / Math.min(currAr, ar)
    return prevRatio < currRatio ? prev : curr
  })
  return closest
}
