import { SEED_PASSWORD } from './constants'
import { moveMoney, serviceClient, userClient } from './db'
import {
  PWA_SCREENSHOT_BUCKETS,
  PWA_SCREENSHOT_MANUAL_SOURCE,
  PWA_SCREENSHOT_GIVE_AMOUNT,
} from './pwaScreenshots'

/** Target Float after rebalance capture (~same magnitude as `rebalance` seed). */
export const PWA_SCREENSHOT_REBALANCE_TARGET_FLOAT = -245

/** Set-aside from Float that brings green demo data to the target negative Float. */
export function pwaScreenshotRebalanceMoveAmount(): number {
  const allocated = PWA_SCREENSHOT_BUCKETS.reduce((sum, bucket) => sum + bucket.amount, 0)
  const greenFloat =
    PWA_SCREENSHOT_MANUAL_SOURCE.amount - allocated - PWA_SCREENSHOT_GIVE_AMOUNT
  return greenFloat - PWA_SCREENSHOT_REBALANCE_TARGET_FLOAT
}

/** Moves extra cash into 🏠 Rent so Float turns red — run after the green Buckets PNG. */
export async function applyPwaScreenshotRebalance(adminEmail: string): Promise<void> {
  const amount = pwaScreenshotRebalanceMoveAmount()
  const rentName =
    PWA_SCREENSHOT_BUCKETS.find((bucket) => bucket.name.includes('Rent'))?.name ??
    PWA_SCREENSHOT_BUCKETS[1]!.name

  const adminClient = await userClient(adminEmail, SEED_PASSWORD)
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('applyPwaScreenshotRebalance: not signed in')

  const svc = serviceClient()
  const { data: member, error: memberError } = await svc
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .single()
  if (memberError) throw memberError

  const { data: rentBucket, error: bucketError } = await svc
    .from('buckets')
    .select('id')
    .eq('family_id', member.family_id)
    .eq('name', rentName)
    .single()
  if (bucketError) throw bucketError

  await moveMoney(adminClient, {
    fromBucketId: null,
    toBucketId: rentBucket.id,
    amount,
    note: 'Set aside for rebalance screenshot',
  })
}
