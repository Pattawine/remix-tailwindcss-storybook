import { getAuth } from '@clerk/remix/ssr.server'
import type { DataFunctionArgs } from '@vercel/remix'
import { redirect } from '@vercel/remix'
import { ADMIN_USER_IDS } from '../core/constants.server'

/**
 * Return auth object with non-null userId.
 * If userId is null, redirect to sign-in page.
 *
 * @param args
 * @returns auth that has non-null userId
 */
export async function requireAuth(args: DataFunctionArgs) {
  const auth = await getAuth(args)
  if (!auth.userId) {
    let redirectPath = process.env.CLERK_SIGN_IN_URL || '/sign-in'

    // add redirect_url query param to the path
    redirectPath += `?redirect_url=${encodeURIComponent(args.request.url)}`

    throw redirect(redirectPath)
  }
  return auth
}

export function isAdmin(userId: string | null) {
  return Boolean(userId && ADMIN_USER_IDS.includes(userId))
}

export function getPrimaryEmail(user: {
  email_addresses: any[]
  primary_email_address_id: string
}) {
  const email = user.email_addresses.find((email) => email.id === user.primary_email_address_id)
  return email.email_address
}
