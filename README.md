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

## Workflow Diagram

```
User sends POST request with jobTitle
    ↓
Extract jobTitle (from query param, body, or default: "Backend Engineer")
    ↓
Initialize Scraper with jobTitle
    ↓
Create output filename (sanitize jobTitle: "Backend Engineer" → "backend_engineer_companies.txt")
    ↓
Check if output file exists
    ├─→ Yes: Load existing companies/URLs into memory
    └─→ No: Start with empty set
    ↓
Build search query
    ├─ LinkedIn: site:linkedin.com/jobs "{jobTitle}"
    └─ YC: ycombinator jobs {jobTitle}
    ↓
Call Firecrawl API (Search with query + limit: 50 results)
    ↓
Check if results found
    ├─→ No: Return empty response
    └─→ Yes: Continue
    ↓
Split results into batches (default: 10 per batch)
    ↓
For each batch:
    ├─→ Send batch to OpenAI GPT-4o-mini with extraction prompt
    ├─→ OpenAI filters & extracts relevant job postings
    ├─→ Wait 2 seconds (rate limiting)
    └─→ Repeat for next batch
    ↓
Process all extracted results
    ↓
For each extracted result:
    ├─→ Parse company name + URL (or just URL for YC)
    ├─→ Check if URL already exists
    │   ├─→ Yes: Skip duplicate
    │   └─→ No: Add to collection
    └─→ Repeat for next result
    ↓
Sort results alphabetically
    ↓
Write to output file (with header + timestamp)
    ↓
Return JSON response: { success: true, jobTitle: "..." }
```

### Detailed Workflow Steps

1. **Request Reception**
   - API receives POST request with optional `jobTitle`
   - Extracts job title from query param, body, or uses default

2. **Initialization**
   - Creates scraper instance with job title
   - Generates sanitized filename (e.g., `backend_engineer_companies.txt`)
   - Loads existing data from file (if exists) to prevent duplicates

3. **Search Phase**
   - Builds search query: `site:linkedin.com/jobs "{jobTitle}"` or `ycombinator jobs {jobTitle}`
   - Calls Firecrawl API with limit (default: 50 results)
   - Receives raw search results

4. **AI Processing Phase**
   - Splits results into batches (default: 10 per batch)
   - For each batch:
     - Sends to OpenAI GPT-4o-mini with extraction prompt
     - AI filters and extracts only relevant job postings
     - Waits 2 seconds between batches (rate limiting)

5. **Data Processing**
   - Parses extracted data (company name + URL or URL only)
   - Checks for duplicates against existing URLs
   - Adds only new entries to collection

6. **Output Generation**
   - Sorts results alphabetically
   - Writes to file with header containing job title and timestamp
   - Returns JSON response with success status

### Example: Scraping "Software Engineer" Jobs

```
Request: POST /scrape/jobs?jobTitle=Software Engineer
    ↓
Filename: software_engineer_companies.txt
    ↓
Search: site:linkedin.com/jobs "Software Engineer" (50 results)
    ↓
Batches: 5 batches × 10 results each
    ↓
Batch 1 → OpenAI → Extract 8 relevant jobs → Wait 2s
Batch 2 → OpenAI → Extract 7 relevant jobs → Wait 2s
Batch 3 → OpenAI → Extract 9 relevant jobs → Wait 2s
Batch 4 → OpenAI → Extract 6 relevant jobs → Wait 2s
Batch 5 → OpenAI → Extract 8 relevant jobs
    ↓
Total: 38 extracted jobs
    ↓
Deduplicate: Remove 5 duplicates → 33 new jobs
    ↓
Save: Write 33 jobs to software_engineer_companies.txt
    ↓
Response: { success: true, jobTitle: "Software Engineer" }
```

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
