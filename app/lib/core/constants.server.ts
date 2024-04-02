export const S3_BUCKET = 'solidten-storage'
export const CODE_NAME = 'solidten'
export const DOMAIN_NAME = 'www.solidten.ai'
export const SOURCE_PICTURES_FOLDER = 'source_pictures'
export const LOCALHOST_URL = 'http://localhost:3000'

/**
 * Domain URL is in the form "subdomain.domain.tld" without the protocol or a trailing slash.
 */
export const DOMAIN_URL = process.env.VERCEL ? process.env.VERCEL_URL : process.env.NGROK_URL
export const DOMAIN_URL_PUBLIC = process.env.VERCEL ? DOMAIN_NAME : process.env.NGROK_URL

/**
 * Redirect URL contains the protocol e.g. "https://subdomain.domain.tld" without a trailing slash.
 */
export const REDIRECT_URL =
  process.env.NODE_ENV === 'production' ? `https://${DOMAIN_NAME}` : LOCALHOST_URL
export const MAX_IMAGE_SIZE = 800
export const RUNPOD_SECRET_PHRASE = 'bro-trust-me-i-am-the-real-runpod'
export const ADMIN_USER_IDS = [
  'user_2XhWnGamD0NfVP8NCGjEl7Y8bCt', // Off on development mode
  'user_2Y5TFr7AAxjAjxvR4AQv1svYbd4', // Off on production mode
  // 'user_2YAKE2cR6JmoTsuFmqJVdrGBpKY', // Or on production mode
]
export const FOUND_KV_TOKEN = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN

/**
 * The estimated duration of a cold start in milliseconds.
 */
export const COLD_START_DURATION = 5_000

/**
 * The estimated duration of a creation job in milliseconds.
 */
export const JOB_DURATION = 10_000

/**
 * The max duration a user can wait for a job to finish. We can use this to calculate the max
 * server load ratio.
 */
export const MAX_USER_WAIT_DURATION = 10 * 60 * 1000

/**
 * The max ratio between the number of jobs in queue and the number of workers for each endpoint.
 * If the server load ratio is too high, we can reject new jobs.
 */
export const MAX_SERVER_LOAD_RATIO = MAX_USER_WAIT_DURATION / JOB_DURATION
