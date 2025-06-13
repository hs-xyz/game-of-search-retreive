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

const titleTemplates = [
  'Introduction to',
  'Advanced',
  'Understanding',
  'Mastering',
  'Deep Dive into',
  'Complete Guide to',
  'Best Practices for',
  'Fundamentals of',
  'Modern',
  'Building'
];

const subjects = [
  'Machine Learning',
  'Database Design',
  'Web Development',
  'Cloud Computing',
  'Data Structures',
  'Algorithms',
  'Software Architecture',
  'DevOps',
  'Artificial Intelligence',
  'Cybersecurity',
  'Mobile Development',
  'Frontend Frameworks',
  'Backend Systems',
  'Microservices',
  'Performance Optimization'
];

const contentTemplates = [
  'Exploring the fundamental concepts and practical applications in modern software development.',
  'A comprehensive overview of techniques and methodologies used by industry professionals.',
  'Understanding core principles and implementing effective solutions for complex problems.',
  'Detailed analysis of best practices and optimization strategies for enterprise applications.',
  'Examining advanced patterns and architectural decisions in scalable system design.',
  'Practical implementation guide with real-world examples and case studies.',
  'Strategic approaches to solving common challenges in distributed systems.',
  'In-depth exploration of tools and frameworks for efficient development workflows.'
];

const authors = [
  'John Doe',
  'Jane Smith',
  'Bob Johnson',
  'Alice Chen',
  'Robert Wilson',
  'Sarah Davis',
  'Michael Brown',
  'Emily Taylor',
  'David Martinez',
  'Lisa Anderson'
];

const tagGroups = [
  ['ml', 'ai', 'tech'],
  ['database', 'performance', 'sql'],
  ['search', 'indexing', 'optimization'],
  ['algorithms', 'data-structures', 'programming'],
  ['cloud', 'aws', 'infrastructure'],
  ['web', 'frontend', 'javascript'],
  ['backend', 'api', 'server'],
  ['devops', 'docker', 'kubernetes'],
  ['security', 'encryption', 'auth'],
  ['mobile', 'ios', 'android']
];

const seededRandom = (seed: number) => {
  let x = Math.sin(seed) * 100000;
  return x - Math.floor(x);
};

const generateArticle = (index: number): Article => {
  const seed = index + 1;
  const titleTemplate = titleTemplates[Math.floor(seededRandom(seed * 2) * titleTemplates.length)];
  const subject = subjects[Math.floor(seededRandom(seed * 3) * subjects.length)];
  const content = contentTemplates[Math.floor(seededRandom(seed * 4) * contentTemplates.length)];
  const author = authors[Math.floor(seededRandom(seed * 5) * authors.length)];
  const tags = tagGroups[Math.floor(seededRandom(seed * 6) * tagGroups.length)];

  return {
    id: (index + 1).toString(),
    title: `${titleTemplate} ${subject}`,
    content,
    author,
    tags
  };
};

export const generateSeedData = (count: number = 1000000): Article[] => {
  return Array.from({ length: count }, (_, index) => generateArticle(index));
};

export const seedData = generateSeedData();

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
  'performance'
];

export const getRandomQuery = (): string => {
  const queries = getBenchmarkQueries();
  return queries[Math.floor(Math.random() * queries.length)];
};

export const calculateBenchmarkStats = (durations: number[]) => {
  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const average = total / durations.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    totalDuration: `${total}ms`,
    averageDuration: `${Math.round(average)}ms`,
    minDuration: `${Math.min(...durations)}ms`,
    maxDuration: `${Math.max(...durations)}ms`,
    medianDuration: `${Math.round(median)}ms`,
    standardDeviation: `${Math.round(standardDeviation)}ms`,
    durations
  };
}; 