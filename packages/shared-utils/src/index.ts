export interface Article {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
}

export interface RedisArticle extends Omit<Article, 'tags'> {
  tags: string;
}

export const seedData: Article[] = [
  {
    id: '1',
    title: 'Introduction to Machine Learning',
    content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms.',
    author: 'John Doe',
    tags: ['ml', 'ai', 'tech']
  },
  {
    id: '2',
    title: 'Database Performance Optimization',
    content: 'Optimizing database queries and indexing strategies for better performance.',
    author: 'Jane Smith',
    tags: ['database', 'performance', 'sql']
  },
  {
    id: '3',
    title: 'Full Text Search Techniques',
    content: 'Exploring various full text search implementations across different databases.',
    author: 'Bob Johnson',
    tags: ['search', 'database', 'indexing']
  },
  {
    id: '4',
    title: 'Advanced Data Structures',
    content: 'Understanding complex data structures and their applications in modern software development.',
    author: 'Alice Chen',
    tags: ['algorithms', 'data-structures', 'programming']
  },
  {
    id: '5',
    title: 'Cloud Computing Fundamentals',
    content: 'An introduction to cloud computing concepts, services, and deployment models.',
    author: 'Robert Wilson',
    tags: ['cloud', 'aws', 'infrastructure']
  }
];

export const getRedisData = (): RedisArticle[] => {
  return seedData.map(article => ({
    ...article,
    tags: article.tags.join(',')
  }));
};

export const getClickHouseData = () => {
  return seedData.map(article => ({
    id: parseInt(article.id),
    title: article.title,
    content: article.content,
    author: article.author,
    tags: article.tags
  }));
};

export const getBenchmarkQueries = (): string[] => [
  'machine learning',
  'database',
  'search',
  'performance',
  'cloud computing',
  'algorithms'
];

export const getRandomQuery = (): string => {
  const queries = getBenchmarkQueries();
  return queries[Math.floor(Math.random() * queries.length)];
}; 