import { Redis } from '@upstash/redis/cloudflare'
import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'

export const runtime = 'edge'

const app = new Hono().basePath('/api')

type EnvConfig = {
  NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: string
  NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: string
}

app.use('/*', cors())
app.get('/search', async c => {
  try {
    const start = performance.now()
    // ---------------------

    const {
      NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
      NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
    } = env<EnvConfig>(c)

    const redis = new Redis({
      token: NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
      url: NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
    })

    const query = c.req.query('q')?.toUpperCase()

    if (!query) {
      return c.json({ message: 'Invalid search query' }, { status: 400 })
    }

    const res = []
    const rank = await redis.zrank('terms', query)

    if (rank !== null && rank !== undefined) {
      const temp = await redis.zrange<string[]>('terms', rank, rank + 100)

      for (const el of temp) {
        if (!el.startsWith(query)) {
          break
        }

        if (el.endsWith('*')) {
          res.push(el.substring(0, el.length - 1))
        }
      }
    }

    // ------------------------
    const end = performance.now()

    return c.json({
      results: res,
      duration: end - start,
    })
  } catch (err) {
    console.error(err)

    return c.json(
      { results: [], message: 'Something went wrong.' },
      {
        status: 500,
      },
    )
  }
})

export const GET = handle(app)
export default app as never
