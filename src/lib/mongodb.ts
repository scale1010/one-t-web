import { MongoClient } from 'mongodb';

// Construct MongoDB URI from environment variables
function getMongoUri(): string {
  // Option 1: Use full connection string if provided
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
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

  // Construct URI in the format: mongodb+srv://username:password@cluster/?appName=Cluster0
  return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}/?appName=Cluster0`;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

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
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri);
    return client.connect();
  }
}

// Export a function that returns the promise, so errors are caught at call time
export default getMongoClient;
