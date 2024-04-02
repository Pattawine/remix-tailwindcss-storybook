import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'
import ms from 'ms'
import { getIpAddress } from '../utils/general.server'

type Unit = 'ms' | 's' | 'm' | 'h' | 'd'
type Duration = `${number} ${Unit}` | `${number}${Unit}`
interface Redis {
  sadd: <TData>(key: string, ...members: TData[]) => Promise<number>
  eval: <TArgs extends unknown[], TData = unknown>(
    ...args: [script: string, keys: string[], args: TArgs]
  ) => Promise<TData>
}

type RateLimiterConfig = {
  redis: Redis
  timeout?: number | undefined
  analytics?: boolean | undefined
  prefix: string
  tokens: number
  window: Duration
}

export const FREE_USER_LIMIT = 20

/**
 * Rate limiter for DDOS protection, should be used to limit random requests to the API endpoints
 * based on IP address.
 */
const ratelimitDDOS = createFixedWindowRatelimit({
  redis: kv,
  timeout: 1000,
  analytics: true,
  prefix: 'ratelimit:ddos',
  tokens: 100,
  window: '1m',
})

/**
 * Rate limiter for free tier, should be used to limit avatar creations based on user ID
 */
const ratelimitFree = createFixedWindowRatelimit({
  redis: kv,
  timeout: 1000,
  analytics: true,
  prefix: 'ratelimit:free',
  tokens: FREE_USER_LIMIT,
  window: '1h',
})

/**
 * Create a fixed window rate limiter with Upstash Redis as the backend.
 * This returns a rate limiter object which extends the original ratelimit object by adding
 * a `getRedisKey` function and a `getRemaining` function.
 */
export function createFixedWindowRatelimit(config: RateLimiterConfig) {
  const { redis, timeout, analytics, prefix, tokens, window } = config

  const ratelimit = new Ratelimit({
    redis,
    timeout,
    analytics,
    prefix,
    limiter: Ratelimit.fixedWindow(tokens, window),
  })

  const getRedisKey = (identifier: string) => {
    return getFixedWindowKey(prefix, identifier, window)
  }

  const getRemaining = async (identifier: string) => {
    const key = getRedisKey(identifier)
    return await getFixedWindowLimitRemaining(key, tokens)
  }

  return {
    limit: ratelimit.limit.bind(ratelimit),
    blockUntilReady: ratelimit.blockUntilReady.bind(ratelimit),
    getRedisKey,
    getRemaining,
  }
}

/**
 * Limit requests based on IP address. If the limit is reached, it will throw an error.
 * Don't forget to await this function. Should be used on API endpoints.
 * @param request
 */
export async function limitDDOS(request: Request) {
  const ipAddress = getIpAddress(request)
  const { success } = await ratelimitDDOS.limit(ipAddress)
  if (!success) throw new Response('Too many requests.', { status: 429 })
}

/**
 * Try to rate limit a free user based on primary email or user ID (if email is not available).
 * Don't forget to await this function. Should be used on AI image creation.
 * @param sessionClaims session claims from Clerk, containing the user ID and primaryEmail
 */
export function limitFreeUser(sessionClaims: { primaryEmail?: string; sub: string }) {
  const identifier = sessionClaims.primaryEmail || sessionClaims.sub
  console.log('Rate limiting free user:', identifier)
  return ratelimitFree.limit(identifier)
}

/**
 * Get redis key for fixed window rate limiter
 * @param prefix e.g. 'ratelimit:free'
 * @param identifier e.g. user ID or email
 * @param window time e.g. '1m'
 * @returns a key in the form of "prefix:identifier:timestamp"
 */
function getFixedWindowKey(prefix: string, identifier: string, window: string) {
  const intervalDuration = ms(window)
  const key = [prefix, identifier, Math.floor(Date.now() / intervalDuration)].join(':')
  return key
}

/**
 * Get the remaining limit for a fixed window rate limiter without actually consuming the tokens.
 * @param key redis key in the form of "prefix:identifier:timestamp"
 * @param tokens max number of tokens
 * @returns remaining number of tokens in the window, or 0 if the limit is reached
 */
async function getFixedWindowLimitRemaining(key: string, tokens: number) {
  const used = await kv.get<number>(key)
  let remaining = tokens - (used ?? 0)
  if (remaining < 0) remaining = 0
  return remaining
}
