import { invariant } from '@epic-web/invariant'
import type { Prisma } from '@prisma/client'
import type { SynthesisOutput } from '../core/inference.server'
import { prisma } from '../third-party/prisma.server'

type CreationInput = Omit<Prisma.CreationCreateInput, 'images'> & { images: SynthesisOutput }

export type CreationJson = {
  id: string
  userId: string
  style: string
  prompt: string
  negPrompt: string | null
  sourcePictureUrl: string | null
  img2imgParams: {
    initPictureUrl: string
    denoiseStrength: number
    zoomFactor: number | null
  } | null
  synthInput: Prisma.JsonValue
  createdAt: string
  shareToken: string
  width: number | null
  height: number | null
} & {
  images: {
    url: string
    seed: number
  }[]
}

/**
 * Get paginated creations for a user sorted by createdAt in descending order.
 * You need to call prepare() before calling process(). Or you can call run() to run both.
 */
export function CreationPaginator(
  userId: string | '*',
  cursor: string | null,
  pageSize: number,
  options?: {
    select?: Prisma.CreationSelect | null | undefined
    include?: Prisma.CreationInclude | null | undefined
    skip?: number | undefined
    distinct?: Prisma.CreationScalarFieldEnum | Prisma.CreationScalarFieldEnum[] | undefined
  },
) {
  invariant(pageSize > 0, 'pageSize must be positive')

  type Creations = Prisma.PromiseReturnType<typeof prisma.creation.findMany>
  /**
   * Returns `PrismaPromise` that can be used to get the creations from the database. The result
   * will contain an extra creation to represent next cursor if there's a next page.
   */
  function prepare() {
    return getCreations(userId, {
      take: pageSize + 1, // Fetch an extra creation to check if there's a next page
      cursor: cursor ? { id: cursor } : undefined,
      ...options,
    })
  }

  /**
   * Pops the extra creation to extract the next cursor. The next cursor will be null if there's no
   * extra creation.
   */
  function process(creations: Creations) {
    let nextCursor = null
    if (creations.length > pageSize) {
      const nextItem = creations.pop()
      invariant(nextItem, 'nextItem must exist')
      nextCursor = nextItem.id
      invariant(nextCursor, 'nextItem.id must exist')
    }

    return {
      creations,
      nextCursor,
    }
  }

  async function run() {
    const creations = await prepare()
    return process(creations)
  }

  return {
    prepare,
    process,
    run,
  }
}

export function addCreation(creation: CreationInput) {
  return prisma.creation.create({
    data: {
      ...creation,
      images: creation.images.map(({ image, seed }) => ({ url: image, seed })),
    },
  })
}

export function getCreation(
  shareToken: string,
  options?:
    | {
        select?: Prisma.CreationSelect | null | undefined
        include?: Prisma.CreationInclude | null | undefined
        // where: Prisma.CreationWhereUniqueInput
      }
    | undefined,
) {
  return prisma.creation.findUnique({
    where: {
      shareToken,
    },
    ...options,
  })
}

export function getCreations(
  userId: string | '*',
  options?:
    | {
        select?: Prisma.CreationSelect | null | undefined
        include?: Prisma.CreationInclude | null | undefined
        // where?: Prisma.CreationWhereInput | undefined
        // orderBy?:
        //   | Prisma.CreationOrderByWithRelationInput
        //   | Prisma.CreationOrderByWithRelationInput[]
        //   | undefined
        cursor?: Prisma.CreationWhereUniqueInput | undefined
        take?: number | undefined
        skip?: number | undefined
        distinct?: Prisma.CreationScalarFieldEnum | Prisma.CreationScalarFieldEnum[] | undefined
      }
    | undefined,
) {
  // select all users
  if (userId === '*') {
    return prisma.creation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      ...options,
    })
  }

  return prisma.creation.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    ...options,
  })
}

export function getCreationsFromShareTokens(shareTokens: string[]) {
  return prisma.creation.findMany({
    where: {
      // do not use IN operator because it's not utilizing the index properly
      // this OR hack is a workaround suggested by https://github.com/prisma/prisma/discussions/22892#discussioncomment-8320854
      OR: shareTokens.map((shareToken) => ({ shareToken })),
    },
    select: { images: true, style: true, prompt: true },
    orderBy: { id: 'desc' },
  })

  // this raw query also works
  // return prisma.creation.aggregateRaw({
  //   pipeline: [
  //     { $match: { shareToken: { $in: shareTokens } } },
  //     { $sort: { _id: -1 } },
  //     {
  //       $project: {
  //         // _id: 1,
  //         // 'images.url': 1,
  //         // 'images.seed': 1,
  //         images: 1,
  //         style: 1,
  //         prompt: 1,
  //       },
  //     },
  //   ],
  // })
}

export function deleteCreations(userId: string) {
  return prisma.creation.deleteMany({
    where: {
      userId,
    },
  })
}

/**
 * Get creation jobs for a user sorted by ETA in ascending order
 */
export function getCreationJobs(userId: string) {
  return prisma.creationJob.findMany({
    where: {
      userId,
    },
    orderBy: {
      eta: 'asc',
    },
    select: {
      eta: true,
    },
  })
}

export function countCreationJobs(userId: string) {
  return prisma.creationJob.count({
    where: {
      userId,
    },
  })
}

export function getCreationJob(jobId: string) {
  return prisma.creationJob.findUnique({
    where: {
      id: jobId,
    },
  })
}

export function deleteCreationJob(jobId: string) {
  return prisma.creationJob.delete({
    where: {
      id: jobId,
    },
  })
}
