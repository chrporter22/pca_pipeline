const express = require('express');
const redis = require('redis');
const cors = require('cors');

const app = express();
const port = 3001;

// Redis client
const client = redis.createClient({ url: 'redis://redis:6379' });

client.connect()
  .then(() => console.log('Connected to Redis'))
  .catch(err => console.error('Redis connection error:', err));

app.use(cors());

/**
 * GET /api/pca
 * Returns most recent PCA rows from Redis ZSETs
 * Structure:
 *   pca:BTCUSDT -> ZSET(score=timestamp, value=JSON)
 */
app.get('/api/pca', async (req, res) => {
  try {
    // Fetch all PCA ZSET keys
    const keys = await client.keys('pca:*');

    if (!keys.length) {
      return res.json([]);
    }

    const allRows = [];

    for (const key of keys) {
      // Get up to 1000 most recent entries per symbol
      const rows = await client.zRange(
        key,
        0,
        999,
        { REV: true }
      );

      for (const row of rows) {
        try {
          allRows.push(JSON.parse(row));
        } catch (e) {
          console.warn(`Invalid JSON in ${key}`);
        }
      }
    }

    res.json(allRows);

  } catch (error) {
    console.error('Error fetching from Redis:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

