import { PrismaClient } from '@prisma/client'

import { singleton } from '../utils/singleton.server'

const LOG_QUERY = process.env.PRISMA_LOG_QUERY === '1'

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton(
  'prisma',
  () =>
    new PrismaClient({
      log: LOG_QUERY ? [{ emit: 'event', level: 'query' }] : [],
    }),
)
const prismaState = singleton('prismaState', () => ({ isListenerSetup: false }))

prisma.$connect()

if (LOG_QUERY && !prismaState.isListenerSetup) {
  prisma.$on('query', (e) => {
    console.log('Query: ' + e.query)
    console.log('Duration: ' + e.duration + 'ms')
  })
  prismaState.isListenerSetup = true
}

export { prisma }
