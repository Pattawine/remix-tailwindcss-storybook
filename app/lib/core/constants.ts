import type { Vector2 } from './inference.server'

// list constants that can be accessed from both server and client
export const PUSHER_KEY = 'a0c5c37df15e5a50aa1e'
export const PUSHER_CLUSTER = 'us2'
export const PLAN_NAMES = ['BASIC', 'PRO', 'PREMIUM'] as const
export type PlanName = (typeof PLAN_NAMES)[number]

/**
 * The maximum number of concurrent creation jobs that can be run at the same time for each user.
 */
export const MAX_CONCURRENCY = 3

/**
 * List of supported resolutions for image synthesis (width x height)
 */
export const SUPPORTED_RESOLUTIONS: Vector2[] = [
  [768, 512],
  // [704, 512],
  [640, 512],
  // [576, 512], // landscape ⬆
  [512, 512], // square
  // [512, 576], // portrait ⬇
  [512, 640],
  // [512, 704],
  [512, 768],
]

// map from "width x height" to [width, height]
export const SUPPORTED_RESOLUTIONS_MAP: Record<string, Vector2> = {}
for (const [width, height] of SUPPORTED_RESOLUTIONS) {
  SUPPORTED_RESOLUTIONS_MAP[`${width}x${height}`] = [width, height]
}
