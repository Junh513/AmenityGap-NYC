import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.get('/api/amenities', async (req, res) => {
  const { type } = req.query;
  const limit = 1000;
  let offset = 0;
  let allData = [];

  try {
    while (true) {
      let query = supabase
        .from('amenities')
        .select('*')
        .range(offset, offset + limit - 1);

      if (type) query = query.eq('amenity_type', type);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      if (!data || data.length === 0) break;

      allData = allData.concat(data);

      if (data.length < limit) break;
      offset += limit;
    }

    res.json(allData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Backend running on http://localhost:3001'));