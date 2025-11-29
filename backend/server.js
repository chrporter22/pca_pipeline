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

// GET all PCA records (optionally filter by symbol or time)
app.get('/api/pca', async (req, res) => {
    try {
        const keys = await client.keys('pca:*');
        const values = await Promise.all(keys.map(key => client.get(key)));

        const parsed = values.map(v => JSON.parse(v));
        res.json(parsed);
    } catch (error) {
        console.error('Error fetching from Redis:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

