/**
 * Design decisions:
 * - A user can have only one subscription at a time.
 * - Store only subscription ID in the database, but not the whole subscription object.
 * - Rely on Stripe to store the subscription object and query it when needed.
 * - Whenever a subscription is created/deleted in Stripe, we update subscription ID in database.
 * - If the subscription on Stripe has invalid structure, we throw a fatal error.
 * - Product price used in the subscription must have metadata `plan` to link it to the plan.
 */
import { invariant } from '@epic-web/invariant'
import Stripe from 'stripe'
import type { PlanName } from '../core/constants'
import { PLAN_NAMES } from '../core/constants'
import { REDIRECT_URL } from '../core/constants.server'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

export type PlanDetails = {
  tier: number
  productId: string
  priceId: string
  portalConfigId?: string // browse to /stripe/create_portal_configs route to get this
}
// TODO: update these plan details on livemode
export const PLANS: Record<PlanName, PlanDetails> = {
  BASIC: {
    tier: 1,
    productId: 'prod_PXOwNKRJ5Wuxyq',
    priceId: 'price_1OiK8yErPsDcirQXfSO1qVHZ',
    portalConfigId: 'bpc_1OlaNyErPsDcirQXMKEeIOkB',
  },
  PRO: {
    tier: 2,
    productId: 'prod_PXOybpmYbB750c',
    priceId: 'price_1OiKApErPsDcirQXNTHQMaGd',
    portalConfigId: 'bpc_1OlaNyErPsDcirQXKN7ymab4',
  },
  PREMIUM: {
    tier: 3,
    productId: 'prod_PaRKpLn7lNv5mo',
    priceId: 'price_1OlGS4ErPsDcirQXpDSMqgiP',
    portalConfigId: 'bpc_1OlaNzErPsDcirQXD7HDAlPr',
  },
} as const

export type SolidSubscription = {
  id: string
  customerId: string
  userId: string
  planName: PlanName
  status: Stripe.Subscription.Status
}

/**
 * Create billing portal configuration for the customer to manage their subscription.
 * Crucially, we allow the customer to switch to a new plan, but only to plans with a higher tier.
 * We also allow the customer to update their payment method and cancel their subscription.
 * We disallow updating the email, but allow updating the name, address, and phone number.
 * @param currentPlan - The current plan of the customer
 * @param options - Additional options to enable only subscription update and cancellation
 */
export async function createPortalConfig(
  currentPlan: PlanName,
  options = { enableOnlySubscription: false },
) {
  // set plans that the user is allowed to switch to (no downgrades allowed)
  const allowedPlans = PLAN_NAMES.filter((plan) => PLANS[plan].tier >= PLANS[currentPlan].tier)
  const { enableOnlySubscription } = options

  return stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'SolidTen partners with Stripe for simplified billing.',
      // TODO: update these legal URLs
      privacy_policy_url: undefined,
      terms_of_service_url: undefined,
    },
    features: {
      invoice_history: { enabled: !enableOnlySubscription },
      customer_update: {
        enabled: !enableOnlySubscription,
        allowed_updates: ['name', 'address', 'phone'],
      },
      payment_method_update: { enabled: true },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: allowedPlans.map((plan) => ({
          product: PLANS[plan].productId,
          prices: [PLANS[plan].priceId],
        })),
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
      },
      subscription_pause: { enabled: false },
    },
    expand: ['features.subscription_update.products'],
  })
}

/**
 * Create a billing portal session with default configuration for the customer to manage their
 * subscription, update payment method, and cancel subscription.
 */
export async function createPortalSession(customerId: string, redirectRoute: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: REDIRECT_URL + redirectRoute,
  })
}

/**
 * Create a billing portal session for the customer to update their subscription to a new plan.
 * Allowed plans are those with a higher tier than the current plan.
 *
 * If the customer is on the top tier plan, they cannot switch to another plan, so we will show
 * the billing portal without subscription update flow.
 * @param subscription - The current subscription object from Stripe to extract the customer id,
 * plan, and subscription id.
 * @param redirectRoute - Route to redirect to e.g. '/membership'
 * @returns The billing portal session object from Stripe
 */
export async function createSubscriptionUpdateFlow(
  subscription: Stripe.Subscription,
  redirectRoute: string,
) {
  const customer = subscription.customer
  const customerId = typeof customer === 'string' ? customer : customer.id
  const plan = getPlanName(subscription)

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: PLANS[plan].portalConfigId,
    return_url: REDIRECT_URL + redirectRoute,
    flow_data: isTopTierPlan(plan)
      ? undefined
      : {
          type: 'subscription_update',
          subscription_update: {
            subscription: subscription.id,
          },
          after_completion: {
            type: 'redirect',
            redirect: {
              return_url: REDIRECT_URL + redirectRoute,
            },
          },
        },
  })
}

/**
 * Create a checkout session for the customer to subscribe to a plan.
 * @param customer - The customer id
 * @param planName - The plan to subscribe to
 * @param redirectRoute - Route to redirect to. It must have no search params e.g. '/membership'
 * @returns The checkout session object from Stripe
 */
export async function createCheckoutSession(
  customer: string,
  planName: PlanName,
  redirectRoute: string,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer,
    mode: 'subscription',
    line_items: [
      {
        price: PLANS[planName].priceId,
        quantity: 1,
      },
    ],
    // {CHECKOUT_SESSION_ID} is a string literal; do not change it!
    // the actual Session ID is returned in the query parameter when your customer
    // is redirected to the success page.
    success_url: REDIRECT_URL + redirectRoute + '?success=true&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: REDIRECT_URL + redirectRoute + '?canceled=true',
  })
}

/**
 * Get the subscription object from Stripe and extract the relevant fields for use in solid 10.
 * Validate the subscription object and throw an error if it is invalid.
 * @param subscription - The subscription object from Stripe.
 * @returns
 * @throws InvariantError if the subscription object is invalid e.g. has more than one item or
 * the plan is invalid or the user id is not found in the metadata.
 */
export async function extractSolidSubscription(
  subscription: Stripe.Subscription,
): Promise<SolidSubscription> {
  invariant(
    subscription.items.data.length === 1,
    `Subscription has more than one item: ${subscription.id}`,
  )
  const customer = subscription.customer
  const customerId = typeof customer === 'string' ? customer : customer.id
  return {
    id: subscription.id,
    customerId,
    userId: await getUserIdFromCustomer(customer),
    planName: getPlanName(subscription),
    status: subscription.status,
  }
}

/**
 * Get the user id by looking up the customer in Stripe and returning the userId from the metadata.
 * @throws Error if the customer is not found, is deleted, or the userId is not found in the metadata.
 */
export async function getUserIdFromCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string> {
  if (typeof customer === 'string') {
    customer = await stripe.customers.retrieve(customer)
    invariant(customer, `Customer not found for id: ${customer.id}`)
  }
  invariant(!customer.deleted, `Customer is deleted for id: ${customer.id}`)
  const userId = customer.metadata.userId
  invariant(userId, `userId not found for customerId: ${customer.id}`)
  return userId
}

export function isValidPlanName(plan: any): plan is PlanName {
  return plan in PLANS
}

export function isTopTierPlan(plan: PlanName) {
  return PLANS[plan].tier === Math.max(...Object.values(PLANS).map((p) => p.tier))
}

export function getPlanName(subscription: Stripe.Subscription) {
  const plan = subscription.items.data[0].price.metadata.plan
  invariant(isValidPlanName(plan), `Invalid plan: ${plan}`)
  return plan
}
