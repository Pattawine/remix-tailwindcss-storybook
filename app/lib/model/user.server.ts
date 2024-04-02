/**
 * Design decisions:
 * - Clerk database is the source of truth for users.
 * - User model and Stripe customers are kept in sync to Clerk database (currently it's only email)
 * - A customer is lazily created when the user tries to upgrade their membership.
 * - The customer is eagerly updated/deleted when the user is updated/deleted.
 * - The customer contains metadata `userId` to link it to the user.
 */
import { invariant, invariantResponse } from '@epic-web/invariant'
import type { Prisma } from '@prisma/client'
import type Stripe from 'stripe'
import { prisma } from '../third-party/prisma.server'
import { stripe } from '../third-party/stripe.server'

/**
 * Try to find a customer by their userId. If not found, create a new customer in Stripe and return it.
 * Note that subscriptions are expanded in the customer object.
 * @param userId - The user id, we are assuming it is a valid user id.
 * @param createParams - Additional parameters to create the customer in Stripe e.g. name, address, etc.
 * @returns stripe.Customer
 */
export async function getOrCreateCustomer(
  userId: string,
  createParams?: Stripe.CustomerCreateParams,
) {
  // get customer id and email from user
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      customerId: true,
      email: true,
    },
  })
  // this can happen when the 'user.created' event is not yet processed by inngest
  if (!user) {
    console.error(`User not found for id: ${userId}`)
  }
  invariantResponse(
    user,
    "As your account is new, we're still finalizing some details. Please check back in a few seconds to upgrade your membership.",
    {
      status: 500,
    },
  )
  invariant(user.email, `User email not found for id: ${userId}`)

  // return customer if found
  if (user.customerId) {
    const customer = await stripe.customers.retrieve(user.customerId, { expand: ['subscriptions'] })
    invariant(customer, `Customer not found for id: ${user.customerId}`)
    if (!customer.deleted) {
      return customer as Stripe.Response<Stripe.Customer> & {
        subscriptions: Stripe.ApiList<Stripe.Subscription>
      }
    }

    // customer is deleted, so create a new one
    console.warn(`Customer is deleted for id: ${user.customerId}`)
  }

  // create customer in stripe and save customerId to user
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId },
    ...createParams,
    expand: ['subscriptions'],
  })
  await updateUser(userId, { customerId: customer.id })
  return customer as Stripe.Response<Stripe.Customer> & {
    subscriptions: Stripe.ApiList<Stripe.Subscription>
  }
}

/**
 * Update a user in the database and their customer in Stripe.
 */
export async function updateUser(userId: string, data: Prisma.UserUpdateInput) {
  const user = await prisma.user.update({ where: { id: userId }, data })
  if (user.customerId && data.email) {
    await stripe.customers.update(user.customerId, { email: user.email })
  }
  return user
}

/**
 * Delete a user from the database and their customer in Stripe.
 */
export async function deleteUser(userId: string) {
  // delete customer in stripe
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      customerId: true,
    },
  })
  if (user?.customerId) {
    try {
      await stripe.customers.del(user.customerId)
    } catch (error) {
      // thrown probably because the customer doesn't exist
      console.error(`Failed to delete customer in stripe: ${user.customerId}`, error)
    }
  }

  // delete user in db
  return await prisma.user.delete({ where: { id: userId } })
}
