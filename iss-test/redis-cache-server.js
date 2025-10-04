import express from "express";
import redis from "redis";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Redis client setup
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  retry_strategy: (options) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      console.error("Redis server refused connection");
      return new Error("Redis server refused connection");
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error("Retry time exhausted");
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

// Redis connection events
redisClient.on("connect", () => {
  console.log("✅ Connected to Redis server");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

redisClient.on("ready", () => {
  console.log("🚀 Redis client ready");
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Cache key generation
function generateCacheKey(query) {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  return `chatbot:${hash}`;
}

// Calculate similarity between queries
function calculateSimilarity(query1, query2) {
  const words1 = new Set(query1.toLowerCase().split(/\s+/));
  const words2 = new Set(query2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

// API Routes

// Health check
app.get("/health", async (req, res) => {
  try {
    await redisClient.ping();
    res.json({
      status: "healthy",
      redis: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

// Cache a chatbot response
app.post("/api/cache", async (req, res) => {
  try {
    const { query, response, metadata = {} } = req.body;

    if (!query || !response) {
      return res.status(400).json({ error: "Query and response are required" });
    }

    const cacheKey = generateCacheKey(query);
    const cacheData = {
      query: query.trim(),
      response,
      metadata: {
        timestamp: Date.now(),
        responseTime: metadata.responseTime || 0,
        tokenCount: metadata.tokenCount || response.length,
        apiVersion: metadata.apiVersion || "gemini-2.5-flash",
        ...metadata,
      },
      hitCount: 1,
      lastAccessed: Date.now(),
      createdAt: new Date().toISOString(),
    };

    // Store in Redis with 7-day expiration
    await redisClient.setEx(
      cacheKey,
      7 * 24 * 60 * 60,
      JSON.stringify(cacheData)
    );

    // Update cache statistics
    await updateCacheStats("add");

    res.json({
      success: true,
      cacheKey,
      message: "Response cached successfully",
      expiresIn: "7 days",
    });
  } catch (error) {
    console.error("Cache storage error:", error);
    res.status(500).json({ error: "Failed to cache response" });
  }
});

// Retrieve cached response
app.get("/api/cache/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const cacheKey = generateCacheKey(query);

    const cached = await redisClient.get(cacheKey);

    if (!cached) {
      await updateCacheStats("miss");
      return res.json({ found: false, fromCache: false });
    }

    const cacheData = JSON.parse(cached);

    // Update hit statistics
    cacheData.hitCount = (cacheData.hitCount || 0) + 1;
    cacheData.lastAccessed = Date.now();

    // Update cache with new statistics
    await redisClient.setEx(
      cacheKey,
      7 * 24 * 60 * 60,
      JSON.stringify(cacheData)
    );
    await updateCacheStats("hit");

    res.json({
      found: true,
      fromCache: true,
      response: cacheData.response,
      metadata: cacheData.metadata,
      hitCount: cacheData.hitCount,
      lastAccessed: cacheData.lastAccessed,
    });
  } catch (error) {
    console.error("Cache retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve cached response" });
  }
});

// Find similar cached responses
app.post("/api/cache/similar", async (req, res) => {
  try {
    const { query, threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Get all cache keys
    const keys = await redisClient.keys("chatbot:*");
    const results = [];

    for (const key of keys) {
      try {
        const cached = await redisClient.get(key);
        if (cached) {
          const cacheData = JSON.parse(cached);
          const similarity = calculateSimilarity(query, cacheData.query);

          if (similarity >= threshold) {
            results.push({
              similarity,
              response: cacheData.response,
              originalQuery: cacheData.query,
              metadata: cacheData.metadata,
              hitCount: cacheData.hitCount,
            });
          }
        }
      } catch (e) {
        // Skip invalid entries
        continue;
      }
    }

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    res.json({
      found: results.length > 0,
      matches: results,
      query,
      threshold,
    });
  } catch (error) {
    console.error("Similar search error:", error);
    res.status(500).json({ error: "Failed to find similar responses" });
  }
});

// Get cache statistics
app.get("/api/cache/stats", async (req, res) => {
  try {
    const statsKey = "chatbot:stats";
    const stats = await redisClient.get(statsKey);

    if (stats) {
      res.json(JSON.parse(stats));
    } else {
      const defaultStats = {
        totalCached: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
        lastUpdated: Date.now(),
      };
      res.json(defaultStats);
    }
  } catch (error) {
    console.error("Stats retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve cache statistics" });
  }
});

// Clear all cache
app.delete("/api/cache/clear", async (req, res) => {
  try {
    const keys = await redisClient.keys("chatbot:*");
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    // Reset stats
    await redisClient.del("chatbot:stats");

    res.json({
      success: true,
      cleared: keys.length,
      message: `Cleared ${keys.length} cached responses`,
    });
  } catch (error) {
    console.error("Cache clear error:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

// Get all cached responses (for debugging)
app.get("/api/cache/all", async (req, res) => {
  try {
    const keys = await redisClient.keys("chatbot:*");
    const responses = [];

    for (const key of keys) {
      try {
        const cached = await redisClient.get(key);
        if (cached) {
          const cacheData = JSON.parse(cached);
          responses.push({
            key,
            query: cacheData.query,
            response: cacheData.response.substring(0, 100) + "...",
            metadata: cacheData.metadata,
            hitCount: cacheData.hitCount,
            lastAccessed: cacheData.lastAccessed,
          });
        }
      } catch (e) {
        continue;
      }
    }

    responses.sort((a, b) => b.lastAccessed - a.lastAccessed);

    res.json({
      total: responses.length,
      responses,
    });
  } catch (error) {
    console.error("Get all cache error:", error);
    res.status(500).json({ error: "Failed to retrieve cached responses" });
  }
});

// Store chat history
app.post("/api/chat/history", async (req, res) => {
  try {
    const { sessionId, messages } = req.body;

    if (!sessionId || !messages) {
      return res
        .status(400)
        .json({ error: "Session ID and messages are required" });
    }

    const historyKey = `chat:history:${sessionId}`;
    const historyData = {
      sessionId,
      messages,
      lastUpdated: Date.now(),
      messageCount: messages.length,
    };

    // Store chat history with 30-day expiration
    await redisClient.setEx(
      historyKey,
      30 * 24 * 60 * 60,
      JSON.stringify(historyData)
    );

    res.json({
      success: true,
      sessionId,
      messageCount: messages.length,
      message: "Chat history saved",
    });
  } catch (error) {
    console.error("Chat history save error:", error);
    res.status(500).json({ error: "Failed to save chat history" });
  }
});

// Retrieve chat history
app.get("/api/chat/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const historyKey = `chat:history:${sessionId}`;

    const history = await redisClient.get(historyKey);

    if (!history) {
      return res.json({ found: false, messages: [] });
    }

    const historyData = JSON.parse(history);

    res.json({
      found: true,
      sessionId,
      messages: historyData.messages,
      messageCount: historyData.messageCount,
      lastUpdated: historyData.lastUpdated,
    });
  } catch (error) {
    console.error("Chat history retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve chat history" });
  }
});

// Helper function to update cache statistics
async function updateCacheStats(action) {
  try {
    const statsKey = "chatbot:stats";
    let stats = await redisClient.get(statsKey);

    if (stats) {
      stats = JSON.parse(stats);
    } else {
      stats = {
        totalCached: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
        lastUpdated: Date.now(),
      };
    }

    switch (action) {
      case "add":
        stats.totalCached++;
        break;
      case "hit":
        stats.cacheHits++;
        break;
      case "miss":
        stats.cacheMisses++;
        break;
    }

    stats.lastUpdated = Date.now();
    stats.hitRate =
      (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100 || 0;

    await redisClient.setEx(statsKey, 30 * 24 * 60 * 60, JSON.stringify(stats));
  } catch (error) {
    console.error("Stats update error:", error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Redis Cache Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Redis UI: http://localhost:8081`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down Redis Cache Server...");
  await redisClient.quit();
  process.exit(0);
});
