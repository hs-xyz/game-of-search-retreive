import { Client } from '@elastic/elasticsearch';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, getBenchmarkQueries } from 'shared-utils';

export class ElasticsearchAdapter implements DatabaseAdapter {
  public readonly name = 'Elasticsearch';
  private client!: Client;
  private indexName = 'articles';

  async initialize(): Promise<void> {
    this.client = new Client({
      node: 'http://elasticsearch:9200'
    });

    await this.client.indices.delete({ index: this.indexName }).catch(() => {});

    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              article_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'stop',
                  'snowball'
                ]
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'integer' },
            title: { 
              type: 'text',
              analyzer: 'article_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            content: { 
              type: 'text',
              analyzer: 'article_analyzer'
            },
            author: { 
              type: 'text',
              analyzer: 'article_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            tags: { 
              type: 'keyword'
            },
            searchable_text: {
              type: 'text',
              analyzer: 'article_analyzer'
            },
            created_at: { type: 'date' }
          }
        }
      }
    });

    console.log('Elasticsearch index created with optimized mapping');
    await this.seedData();
  }

  private async seedData(): Promise<void> {
    console.log('Seeding Elasticsearch with 100k articles...');
    const articles = generatedArticles;

    const batchSize = 1000;
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      const body = batch.flatMap(article => [
        { index: { _index: this.indexName, _id: article.id } },
        {
          ...article,
          id: parseInt(article.id),
          searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`,
          created_at: new Date()
        }
      ]);

      await this.client.bulk({ body });
      
      if ((i + batchSize) % 10000 === 0) {
        console.log(`Indexed ${Math.min(i + batchSize, articles.length)} articles...`);
      }
    }

    await this.client.indices.refresh({ index: this.indexName });
    console.log(`Seeded ${articles.length} articles to Elasticsearch with enhanced features`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const searchBody = {
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query,
                fields: ['title^3', 'content', 'author^2'],
                type: 'phrase' as const,
                boost: 10
              }
            },
            {
              multi_match: {
                query,
                fields: ['title^3', 'content', 'author^2', 'searchable_text'],
                type: 'best_fields' as const,
                boost: 5,
                fuzziness: 'AUTO'
              }
            },
            {
              multi_match: {
                query,
                fields: ['title^3', 'content', 'author^2'],
                type: 'cross_fields' as const,
                boost: 3
              }
            },
            {
              multi_match: {
                query,
                fields: ['title^3', 'content', 'author^2', 'searchable_text'],
                type: 'most_fields' as const,
                boost: 1
              }
            },
            {
              terms: {
                tags: query.toLowerCase().split(/\s+/),
                boost: 2
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      highlight: {
        fields: {
          title: {},
          content: { fragment_size: 150, number_of_fragments: 1 }
        }
      },
      size: limit,
      sort: [
        '_score',
        { 'id': 'asc' }
      ]
    };

    const response = await this.client.search({
      index: this.indexName,
      body: searchBody
    });

    const results = (response.hits?.hits || []).map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      highlight: hit.highlight
    }));

    const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

    return {
      results,
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const response = await this.client.search({
      index: this.indexName,
      body: {
        query: { match_all: {} },
        from: offset,
        size: limit,
        sort: [{ id: 'asc' }]
      }
    });

    const results = (response.hits?.hits || []).map((hit: any) => hit._source);
    const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

    return {
      results,
      total,
      offset,
      limit
    };
  }

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['title^3', 'content', 'author^2', 'searchable_text'],
              type: 'best_fields' as const,
              fuzziness: 'AUTO'
            }
          },
          size: 0
        }
      });
      
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: (response.hits?.total as any)?.value || response.hits?.total || 0,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }

  public searchVariants = {
    phrase: async (query: string, limit: number) => {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query,
              fields: ['title^2', 'content', 'author'],
              type: 'phrase'
            }
          },
          size: limit
        }
      });

      const results = response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      }));

      const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

      return { results, total };
    },

    bool: async (query: string, limit: number) => {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              should: [
                { match: { title: { query, boost: 2 } } },
                { match: { content: query } },
                { match: { author: query } }
              ]
            }
          },
          size: limit
        }
      });

      const results = response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      }));

      const total = (response.hits?.total as any)?.value || response.hits?.total || 0;

      return { results, total };
    }
  };
} 