import { MongoClient } from 'mongodb';

// Construct MongoDB URI from environment variables with connection pooler optimization
function getMongoUri(): string {
  // Option 1: Use full connection string if provided
  if (process.env.MONGODB_URI) {
    const uri = process.env.MONGODB_URI;
    // Add connection pooler parameters if not already present
    if (uri.includes('?')) {
      // URI already has query params, check if pooler params exist
      if (!uri.includes('maxPoolSize') && !uri.includes('minPoolSize')) {
        return `${uri}&maxPoolSize=10&minPoolSize=1&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000`;
      }
      return uri;
    } else {
      // No query params, add them
      return `${uri}?maxPoolSize=10&minPoolSize=1&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000`;
    }
  }

  // Option 2: Construct from components
  const cluster = process.env.MONGODB_CLUSTER;
  const username = process.env.MONGODB_USERNAME || process.env.DB_USERNAME;
  const password = process.env.MONGODB_PASSWORD || process.env.DB_PASSWORD;

  if (!cluster || !username || !password) {
    throw new Error(
      'MongoDB configuration missing. Please provide either:\n' +
      '  - MONGODB_URI (full connection string), or\n' +
      '  - MONGODB_CLUSTER, MONGODB_USERNAME (or DB_USERNAME), and MONGODB_PASSWORD (or DB_PASSWORD)'
    );
  }

  // Construct URI with connection pooler settings for faster connections
  // maxPoolSize and minPoolSize help with connection reuse
  // serverSelectionTimeoutMS and connectTimeoutMS ensure fast failure detection
  return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/?appName=Cluster0&maxPoolSize=10&minPoolSize=1&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000`;
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

// Reset connection cache (call this when connection errors occur)
function resetConnection() {
  client = null;
  clientPromise = null;
}

// Create a new connection with optimized settings
function createConnection(uri: string): Promise<MongoClient> {
  const newClient = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
  });
  
  return newClient.connect().then((connectedClient) => {
    client = connectedClient;
    return connectedClient;
  });
}

function getMongoClient(): Promise<MongoClient> {
  // Construct URI lazily (only when connecting, not at module load)
  let uri: string;
  try {
    uri = getMongoUri();
  } catch (error) {
    return Promise.reject(error);
  }

  if (!uri) {
    return Promise.reject(new Error('MongoDB URI could not be constructed. Please check your .env.local configuration.'));
  }

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
      _mongoClient?: MongoClient;
    };

    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClient = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
      });
      globalWithMongo._mongoClientPromise = globalWithMongo._mongoClient.connect();
    }
    return globalWithMongo._mongoClientPromise;
  } else {
    // In production/serverless, cache the client promise at module level
    // This ensures connection reuse across requests in the same serverless function instance
    
    // If we have a cached promise, return it optimistically (no health check)
    if (clientPromise) {
      return clientPromise;
    }
    
    // No cached connection, create new one
    clientPromise = createConnection(uri);
    
    // Handle initial connection errors - reset promise on failure so next call can retry
    clientPromise.catch((error) => {
      console.error('MongoDB initial connection failed:', error);
      resetConnection();
      // Re-throw so caller can handle it
      throw error;
    });
    
    return clientPromise;
  }
}

// Helper to check if error is connection-related
export function isConnectionError(error: any): boolean {
  return (
    error.name === 'MongoServerSelectionError' ||
    error.name === 'MongoNetworkError' ||
    error.name === 'MongoTimeoutError' ||
    error.name === 'MongoNotConnectedError' ||
    error.message?.toLowerCase().includes('connection') ||
    error.message?.toLowerCase().includes('timeout') ||
    error.message?.toLowerCase().includes('not connected') ||
    error.message?.toLowerCase().includes('server selection')
  );
}

// Export both the getter and reset function
export default getMongoClient;
export { resetConnection };
