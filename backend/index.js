import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// Helper function to copy cache files pulled from firebase
const FRONTEND_CACHE_DIR = path.join(__dirname, '..', 'frontend', 'amenitygap-app', 'public', 'cache');

if (!fs.existsSync(FRONTEND_CACHE_DIR)) fs.mkdirSync(FRONTEND_CACHE_DIR, { recursive: true });

function syncToFrontend(filename) {
  const src = path.join(CACHE_DIR, filename);
  const dest = path.join(FRONTEND_CACHE_DIR, filename);
  fs.copyFileSync(src, dest);
}

const app = express();
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.get('/api/amenity-types', async (req, res) => {
  const cacheFile = path.join(CACHE_DIR, 'amenity-types.json');
  const limit = 1000;
  let offset = 0;
  let allData = [];

  try {
    while (true) {
      const { data, error } = await supabase
        .from('amenities')
        .select('amenity_type')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }

    const types = [...new Set(allData.map(d => d.amenity_type))];
    fs.writeFileSync(cacheFile, JSON.stringify(types));
    syncToFrontend('amenity-types.json');
    res.json(types);
  } catch (err) {
    console.error('Supabase fetch failed, trying cache:', err.message);
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      res.json(cached);
    } else {
      res.status(500).json({ error: 'No data available' });
    }
  }
});

app.get('/api/amenities', async (req, res) => {
  const { type } = req.query;
  const cacheFile = path.join(CACHE_DIR, `${type || 'all'}.json`);
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
      if (error) throw error;

      if (!data || data.length === 0) break;

      allData = allData.concat(data);

      if (data.length < limit) break;
      offset += limit;
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allData));
    syncToFrontend(`${type || 'all'}.json`);
    res.json(allData);
  } catch (err) {
    console.error('Supabase fetch failed, trying cache:', err.message);
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      res.json(cached);
    } else {
      res.status(500).json({ error: 'No data available' });
    }
  }
});

app.get('/api/population', async (req, res) => {
  const resParam = parseInt(req.query.res ?? '8', 10);
  if (![7, 8, 9].includes(resParam)) {
    return res.status(400).json({ error: 'res must be 7, 8, or 9' });
  }

  const table = `h3_population_res${resParam}`;
  const cacheFile = path.join(CACHE_DIR, `population-res${resParam}.json`);
  const limit = 1000;
  let offset = 0;
  let allData = [];

  try {
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('h3_index,population')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allData));
    syncToFrontend(`population-res${resParam}.json`);
    res.json(allData);
  } catch (err) {
    console.error('Supabase fetch failed, trying cache:', err.message);
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      res.json(cached);
    } else {
      res.status(500).json({ error: 'No data available' });
    }
  }
});

app.get('/api/cell-metadata', async (req, res) => {
  const cacheFile = path.join(CACHE_DIR, 'cell-metadata.json')
  const frontendFile = path.join(FRONTEND_CACHE_DIR, 'cell-metadata.json')

  // Try backend cache first, then frontend public
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    syncToFrontend('cell-metadata.json')
    return res.json(cached)
  }
  if (fs.existsSync(frontendFile)) {
    const cached = JSON.parse(fs.readFileSync(frontendFile, 'utf-8'))
    return res.json(cached)
  }
  res.status(500).json({ error: 'No metadata available' })
})


app.get('/api/jobs', async (req, res) => {
  const resParam = parseInt(req.query.res ?? '8', 10);
  if (![7, 8, 9].includes(resParam)) {
    return res.status(400).json({ error: 'res must be 7, 8, or 9' });
  }

  const table = `h3_jobs_res${resParam}`;
  const cacheFile = path.join(CACHE_DIR, `jobs-res${resParam}.json`);
  const limit = 1000;
  let offset = 0;
  let allData = [];

  try {
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('h3_index,jobs')
        .range(offset, offset + limit - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allData));
    syncToFrontend(`jobs-res${resParam}.json`);
    res.json(allData);
  } catch (err) {
    console.error('Supabase fetch failed, trying cache:', err.message);
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      res.json(cached);
    } else {
      res.status(500).json({ error: 'No data available' });
    }
  }
});

app.listen(3001, () => console.log('Backend running on http://localhost:3001'));