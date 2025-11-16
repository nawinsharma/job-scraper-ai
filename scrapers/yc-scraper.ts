import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class YCScraper {
  private urls = new Set<string>();
  private outputPath: string;
  private startTime: number;
  private newJobsAdded = 0;
  private jobTitle: string;

  constructor(jobTitle: string) {
    this.jobTitle = jobTitle;
    const sanitizedTitle = jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    this.outputPath = join(process.cwd(), `yc_${sanitizedTitle}_jobs.txt`);
    this.startTime = Date.now();
  }

  private loadExistingJobs(): void {
    if (!existsSync(this.outputPath)) return;

    const content = readFileSync(this.outputPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('Jobs') || line.includes('Last Updated:') || line.includes('===') ||
          !line.trim()) continue;

      const url = line.trim();
      if (url.startsWith('http')) this.urls.add(url);
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
    const prompt = `Extract ONLY job URLs for ${this.jobTitle} roles from YC Work at a Startup. Return ONLY URLs, one per line. Be strict - only ${this.jobTitle}-related jobs.\n\n${JSON.stringify(batch, null, 2)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Extract ${this.jobTitle} job URLs only from YC. Return ONLY URLs.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    if (!response.ok || !data.choices?.[0]?.message?.content) return [];

    return data.choices[0].message.content.trim()
      .split('\n')
      .filter((l: string) => l.trim().startsWith('http'));
  }

  private processExtracted(extracted: string[]): void {
    for (const url of extracted) {
      const trimmed = url.trim();
      if (!trimmed.startsWith('http') || this.urls.has(trimmed)) continue;
      this.urls.add(trimmed);
      this.newJobsAdded++;
    }
  }

  private saveResults(): void {
    const sorted = Array.from(this.urls).sort();
    const header = `${this.jobTitle} Jobs - YC Work at a Startup\nLast Updated: ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
    const content = header + sorted.join('\n');
    writeFileSync(this.outputPath, content);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run(): Promise<void> {
    this.loadExistingJobs();

    const query = process.env.YC_SEARCH_QUERY || `ycombinator jobs ${this.jobTitle.toLowerCase()}`;
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

