import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Company {
  displayName: string;
  url: string;
}

export class JobScraper {
  private companies = new Map<string, Company>();
  private urls = new Set<string>();
  private outputPath: string;
  private startTime: number;
  private newCompaniesAdded = 0;
  private jobTitle: string;

  constructor(jobTitle: string) {
    this.jobTitle = jobTitle;
    const sanitizedTitle = jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    this.outputPath = join(process.cwd(), `${sanitizedTitle}_companies.txt`);
    this.startTime = Date.now();
  }

  private loadExistingCompanies(): void {
    if (!existsSync(this.outputPath)) return;

    const content = readFileSync(this.outputPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('Companies') || line.includes('Query:') || 
          line.includes('Started:') || line.includes('Last Updated:') ||
          line.includes('===') || !line.trim()) continue;

      const match = line.match(/^(.+?)\s*-\s*(https?:\/\/.+)$/);
      if (match) {
        const company = match[1]!.trim();
        const url = match[2]!.trim();
        const normalizedCompany = company.toLowerCase();
        const key = normalizedCompany === 'unknown' ? url : normalizedCompany;
        this.companies.set(key, { displayName: company, url });
        this.urls.add(url);
      } else if (line.trim().startsWith('http')) {
        const url = line.trim();
        this.companies.set(url, { displayName: 'Unknown', url });
        this.urls.add(url);
      }
    }
  }

  private async searchFirecrawl(query: string, limit: number): Promise<any[]> {
    const response = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, limit })
    });

    const data = await response.json() as { success?: boolean; data?: { web?: any[] } };
    return data.success && data.data?.web ? data.data.web : [];
  }

  private async extractWithChatGPT(batch: any[]): Promise<string[]> {
    const prompt = `Extract company names and job URLs for ${this.jobTitle} roles. Return format: "CompanyName - URL" or just URL if no company name. Only include ${this.jobTitle}-related jobs.\n\n${JSON.stringify(batch, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Extract ${this.jobTitle} job postings only.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    if (!response.ok || !data.choices?.[0]?.message?.content) return [];

    return data.choices[0].message.content.trim().split('\n').filter((l: string) => l.trim());
  }

  private processExtracted(extracted: string[]): void {
    for (const line of extracted) {
      const match = line.match(/^(.+?)\s*-\s*(https?:\/\/.+)$/);
      if (match) {
        const company = match[1]!.trim();
        const url = match[2]!.trim();
        if (this.urls.has(url)) continue;
        const normalizedCompany = company.toLowerCase();
        const key = normalizedCompany === 'unknown' ? url : normalizedCompany;
        this.companies.set(key, { displayName: company, url });
        this.urls.add(url);
        this.newCompaniesAdded++;
      } else if (line.trim().startsWith('http')) {
        const url = line.trim();
        if (this.urls.has(url)) continue;
        this.companies.set(url, { displayName: 'Unknown', url });
        this.urls.add(url);
        this.newCompaniesAdded++;
      }
    }
  }

  private saveResults(): void {
    const sorted = Array.from(this.companies.entries())
      .sort((a, b) => a[1].displayName.toLowerCase().localeCompare(b[1].displayName.toLowerCase()));

    const header = `${this.jobTitle} Companies\nLast Updated: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
    const content = header + sorted.map(([_, data]) => 
      data.displayName.toLowerCase() === 'unknown' ? data.url : `${data.displayName} - ${data.url}`
    ).join('\n');

    writeFileSync(this.outputPath, content);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(): Promise<void> {
    this.loadExistingCompanies();

    const query = process.env.SEARCH_QUERY || `site:linkedin.com/jobs "${this.jobTitle}"`;
    const limit = parseInt(process.env.SEARCH_LIMIT || '50');
    const batchSize = parseInt(process.env.BATCH_SIZE || '10');

    const results = await this.searchFirecrawl(query, limit);
    if (results.length === 0) return;

    const allExtracted: string[] = [];
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const extracted = await this.extractWithChatGPT(batch);
      allExtracted.push(...extracted);
      if (i + batchSize < results.length) await this.delay(2000);
    }

    this.processExtracted(allExtracted);
    this.saveResults();
  }
}

