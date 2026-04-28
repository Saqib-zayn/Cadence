import { Redis } from "@upstash/redis";
import { timingSafeEqual } from 'node:crypto';
import process from "node:process";

const LIMITS = {
  "generate-context": 25,
  transcribe: 20,
  analyse: 20,
};

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_TOKEN,
    });
  }

  return redis;
}

export async function checkRateLimit(deviceId, endpoint, bypassToken) {
  if (bypassToken) {
    const a = Buffer.from(bypassToken);
    const b = Buffer.from(process.env.DEV_PASSWORD || '');
    if (a.length > 0 && a.length === b.length && timingSafeEqual(a, b)) {
      return { allowed: true, remaining: 999 };
    }
  }

  const limit = LIMITS[endpoint];

  if (!limit) {
    throw new Error(`Unknown rate limit endpoint: ${endpoint}`);
  }

  if (!deviceId) {
    return { allowed: false, remaining: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  const key = `cadence:${endpoint}:${deviceId}:${today}`;
  const count = await getRedis().incr(key);

  if (count === 1) {
    await getRedis().expire(key, 86400);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  };
}
