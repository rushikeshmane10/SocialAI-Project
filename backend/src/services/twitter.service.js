import { ApiResponseError, TwitterApi } from "twitter-api-v2";
import { twitterCredentialsConfigured } from "../config/env.js";

export class TwitterServiceError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "TwitterServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientStatus(status) {
  return status === 429 || status === 503;
}

export async function postTweet(env, text) {
  if (!twitterCredentialsConfigured()) {
    throw new TwitterServiceError(
      "Twitter credentials are not configured on the server",
      503,
      "TWITTER_NOT_CONFIGURED",
    );
  }

  const client = new TwitterApi({
    appKey: env.TWITTER_API_KEY,
    appSecret: env.TWITTER_API_SECRET,
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessSecret: env.TWITTER_ACCESS_SECRET,
  });

  const rw = client.readWrite;
  let lastErr;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tweet = await rw.v2.tweet(text);
      const tweetId = tweet.data.id;
      return {
        tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
      };
    } catch (e) {
      lastErr = e;
      const status = e instanceof ApiResponseError ? e.code : 500;

      if (!isTransientStatus(status) || attempt === 2) {
        const msg = e instanceof Error ? e.message : "Twitter API error";
        const mapped = status === 401 || status === 403 ? 403 : status === 400 ? 400 : 502;
        throw new TwitterServiceError(msg, mapped, "TWITTER_ERROR");
      }

      const base = 500 * 2 ** attempt;
      const jitter = Math.floor(Math.random() * 200);
      await sleep(base + jitter);
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : "Twitter API error";
  throw new TwitterServiceError(msg, 502, "TWITTER_ERROR");
}
