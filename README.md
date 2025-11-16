# Job Scraper API

Express API for scraping jobs using Firecrawl and OpenAI.

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Run server
bun start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scrape/jobs` | Scrape jobs from LinkedIn |
| `POST` | `/scrape/yc` | Scrape jobs from YC Work at a Startup |

## Usage

### Default (Backend Engineer)

```bash
# Scrape backend engineer jobs from LinkedIn
curl -X POST http://localhost:3000/scrape/jobs

# Scrape backend engineer jobs from YC
curl -X POST http://localhost:3000/scrape/yc
```

### Custom Job Title

Pass job title via query parameter or request body:

```bash
# Via query parameter
curl -X POST "http://localhost:3000/scrape/jobs?jobTitle=Software%20Engineer"
curl -X POST "http://localhost:3000/scrape/yc?jobTitle=Data%20Engineer"

# Via request body (JSON)
curl -X POST http://localhost:3000/scrape/jobs \
  -H "Content-Type: application/json" \
  -d '{"jobTitle": "Full Stack Engineer"}'

curl -X POST http://localhost:3000/scrape/yc \
  -H "Content-Type: application/json" \
  -d '{"jobTitle": "Backend Engineer"}'
```

## Output Files

Results are saved to dynamically named files based on the job title:
- LinkedIn jobs: `{job_title}_companies.txt` (e.g., `backend_engineer_companies.txt`)
- YC jobs: `yc_{job_title}_jobs.txt` (e.g., `yc_backend_engineer_jobs.txt`)

Job titles are sanitized for filenames (spaces and special characters become underscores).

## Environment Variables

Required:
- `FIRECRAWL_API_KEY` - Your Firecrawl API key
- `OPENAI_API_KEY` - Your OpenAI API key

Optional:
- `PORT` - Server port (default: `3000`)
- `SEARCH_QUERY` - Search query for job scraper
- `YC_SEARCH_QUERY` - Search query for YC scraper
- `SEARCH_LIMIT` - Max results (default: `20`)
- `BATCH_SIZE` - Batch size for processing (default: `10`)
