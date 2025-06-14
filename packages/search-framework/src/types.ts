export interface SearchResult {
  results: any[];
  total: number;
  duration: string;
  database: string;
  query?: string;
  searchType?: string;
}

export interface BenchmarkResult {
  query: string;
  category: string;
  description: string;
  expectedResults: 'low' | 'medium' | 'high';
  resultCount: number;
  iterations: number;
  totalDuration: string;
  averageDuration: string;
  minDuration: string;
  maxDuration: string;
  medianDuration: string;
  standardDeviation: string;
  durations: number[];
}

export interface BenchmarkResponse {
  database: string;
  benchmarks: BenchmarkResult[];
  averageDuration: string;
}

export interface AllRecordsResult {
  results: any[];
  total: number;
  offset: number;
  limit: number;
  duration: string;
  database: string;
}

export interface DatabaseAdapter {
  name: string;
  
  initialize(): Promise<void>;
  
  search(query: string, limit: number): Promise<Omit<SearchResult, 'database' | 'query' | 'duration'>>;
  
  getAllRecords(limit: number, offset: number): Promise<Omit<AllRecordsResult, 'database' | 'duration'>>;
  
  benchmark?(queries: string[]): Promise<Omit<BenchmarkResponse, 'database'>>;
  
  searchVariants?: {
    [variantName: string]: (query: string, limit: number) => Promise<Omit<SearchResult, 'database' | 'query' | 'duration' | 'searchType'>>;
  };
}

export interface SearchAppConfig {
  adapter: DatabaseAdapter;
  port?: number;
  enableLogging?: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  database: string;
  timestamp: string;
  uptime: string;
} 