import express, { Request, Response } from 'express';
import cors from 'cors';
import { getBenchmarkQueries, calculateBenchmarkStats } from 'shared-utils';
import { 
  DatabaseAdapter, 
  SearchAppConfig, 
  HealthResponse,
  SearchResult,
  AllRecordsResult,
  BenchmarkResponse
} from './types';

export class SearchApp {
  private app: express.Application;
  private adapter: DatabaseAdapter;
  private port: number;
  private enableLogging: boolean;
  private startTime: number;

  constructor(config: SearchAppConfig) {
    this.app = express();
    this.adapter = config.adapter;
    this.port = config.port || 3000;
    this.enableLogging = config.enableLogging ?? true;
    this.startTime = Date.now();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    if (this.enableLogging) {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private setupRoutes(): void {
    this.app.get('/health', this.handleHealth.bind(this));
    this.app.get('/search', this.handleSearch.bind(this));
    this.app.get('/all-records', this.handleAllRecords.bind(this));
    this.app.get('/benchmark', this.handleBenchmark.bind(this));

    if (this.adapter.searchVariants) {
      Object.keys(this.adapter.searchVariants).forEach(variant => {
        this.app.get(`/search-${variant}`, this.handleSearchVariant.bind(this, variant));
      });
    }

    this.app.use(this.handleNotFound.bind(this));
    this.app.use(this.handleError.bind(this));
  }

  private async handleHealth(req: Request, res: Response): Promise<void> {
    const uptime = Date.now() - this.startTime;
    const response: HealthResponse = {
      status: 'healthy',
      database: this.adapter.name,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 1000)}s`
    };
    res.json(response);
  }

  private async handleSearch(req: Request, res: Response): Promise<void> {
    const { q, limit = 10 } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ 
        error: 'Query parameter "q" is required and must be a string' 
      });
      return;
    }

    try {
      const start = Date.now();
      const result = await this.adapter.search(q, Number(limit));
      const duration = Date.now() - start;

      const response: SearchResult = {
        ...result,
        query: q,
        duration: `${duration}ms`,
        database: this.adapter.name
      };

      res.json(response);
    } catch (error) {
      this.handleAdapterError(res, 'Search failed', error);
    }
  }

  private async handleAllRecords(req: Request, res: Response): Promise<void> {
    const { limit = 10, offset = 0 } = req.query;

    try {
      const start = Date.now();
      const result = await this.adapter.getAllRecords(Number(limit), Number(offset));
      const duration = Date.now() - start;

      const response: AllRecordsResult = {
        ...result,
        duration: `${duration}ms`,
        database: this.adapter.name
      };

      res.json(response);
    } catch (error) {
      this.handleAdapterError(res, 'Failed to fetch records', error);
    }
  }

  private async handleBenchmark(req: Request, res: Response): Promise<void> {
    try {
      let result;
      
      if (this.adapter.benchmark) {
        result = await this.adapter.benchmark([]);
      } else {
        result = await this.runFrameworkBenchmark();
      }
      
      const response: BenchmarkResponse = {
        ...result,
        database: this.adapter.name
      };

      res.json(response);
    } catch (error) {
      this.handleAdapterError(res, 'Benchmark failed', error);
    }
  }

  private async runFrameworkBenchmark(): Promise<Omit<BenchmarkResponse, 'database'>> {
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];
    const ITERATIONS = 100;

    for (const query of benchmarkQueries) {
      const durations: number[] = [];
      let lastResultCount = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        try {
          const start = Date.now();
          const result = await this.adapter.search(query, 50000);
          const duration = Date.now() - start;
          durations.push(duration);
          lastResultCount = result.total;
        } catch (error: any) {
          console.error(`Benchmark error for query "${query}" iteration ${i + 1}:`, error.message);
          durations.push(0);
        }
      }

      const stats = calculateBenchmarkStats(durations);
      results.push({
        query,
        resultCount: lastResultCount,
        iterations: ITERATIONS,
        ...stats
      });
    }

    const totalAverage = results.reduce((sum, r) => {
      const avg = parseInt(r.averageDuration.replace('ms', ''));
      return sum + avg;
    }, 0) / results.length;

    return {
      benchmarks: results,
      averageDuration: `${Math.round(totalAverage)}ms`
    };
  }

  private async handleSearchVariant(variant: string, req: Request, res: Response): Promise<void> {
    const { q, limit = 10 } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ 
        error: 'Query parameter "q" is required and must be a string' 
      });
      return;
    }

    const variantFunction = this.adapter.searchVariants?.[variant];
    if (!variantFunction) {
      res.status(404).json({ 
        error: `Search variant "${variant}" not found` 
      });
      return;
    }

    try {
      const start = Date.now();
      const result = await variantFunction(q, Number(limit));
      const duration = Date.now() - start;

      const response: SearchResult = {
        ...result,
        query: q,
        duration: `${duration}ms`,
        database: this.adapter.name,
        searchType: variant
      };

      res.json(response);
    } catch (error) {
      this.handleAdapterError(res, `Search variant "${variant}" failed`, error);
    }
  }

  private handleNotFound(req: Request, res: Response): void {
    res.status(404).json({ 
      error: 'Endpoint not found',
      availableEndpoints: this.getAvailableEndpoints()
    });
  }

  private handleError(error: any, req: Request, res: Response, next: any): void {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }

  private handleAdapterError(res: Response, message: string, error: any): void {
    console.error(`${message}:`, error);
    res.status(500).json({ 
      error: message, 
      details: error.message || error 
    });
  }

  private getAvailableEndpoints(): string[] {
    const baseEndpoints = ['/health', '/search', '/all-records', '/benchmark'];
    const variantEndpoints = this.adapter.searchVariants 
      ? Object.keys(this.adapter.searchVariants).map(v => `/search-${v}`)
      : [];
    
    return [...baseEndpoints, ...variantEndpoints];
  }

  public async start(): Promise<void> {
    try {
      console.log(`Initializing ${this.adapter.name}...`);
      await this.adapter.initialize();
      
      this.app.listen(this.port, () => {
        console.log(`${this.adapter.name} search app running on port ${this.port}`);
        console.log(`Available endpoints: ${this.getAvailableEndpoints().join(', ')}`);
      });
    } catch (error) {
      console.error(`Failed to start ${this.adapter.name} app:`, error);
      process.exit(1);
    }
  }
} 