import 'dotenv/config';
import express from 'express';
import { JobScraper } from './scrapers/job-scraper.js';
import { YCScraper } from './scrapers/yc-scraper.js';

const app = express();
app.use(express.json());

app.post('/scrape/jobs', async (req, res) => {
  try {
    const jobTitle = req.body.jobTitle || req.query.jobTitle as string || 'Backend Engineer';
    const scraper = new JobScraper(jobTitle);
    await scraper.run();
    res.json({ success: true, message: 'Job scraping completed', jobTitle });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/scrape/yc', async (req, res) => {
  try {
    const jobTitle = req.body.jobTitle || req.query.jobTitle as string || 'Backend Engineer';
    const scraper = new YCScraper(jobTitle);
    await scraper.run();
    res.json({ success: true, message: 'YC scraping completed', jobTitle });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
