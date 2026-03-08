import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

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

async function setupIndexes() {
  console.log('🔍 Setting up MongoDB indexes...\n');

  let client: MongoClient | null = null;

  try {
    const uri = getMongoUri();
    client = new MongoClient(uri);
    await client.connect();

    console.log('✅ Connected to MongoDB\n');

    const db = client.db('web');

    // Setup indexes for signups collection
    console.log('📝 Setting up indexes for signups collection...');
    const signupsCollection = db.collection('signups');
    
    try {
      await signupsCollection.createIndex({ email: 1 }, { unique: true });
      console.log('  ✅ Created unique index on email');
    } catch (error: any) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ⚠️  Index on email already exists (may have different options)');
      } else if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ Index on email already exists');
      } else {
        throw error;
      }
    }

    try {
      await signupsCollection.createIndex({ createdAt: 1 });
      console.log('  ✅ Created index on createdAt');
    } catch (error: any) {
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ Index on createdAt already exists');
      } else {
        throw error;
      }
    }

    // Setup indexes for contacts collection
    console.log('\n📝 Setting up indexes for contacts collection...');
    const contactsCollection = db.collection('contacts');
    
    try {
      await contactsCollection.createIndex({ email: 1 });
      console.log('  ✅ Created index on email');
    } catch (error: any) {
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ Index on email already exists');
      } else {
        throw error;
      }
    }

    try {
      await contactsCollection.createIndex({ createdAt: -1 });
      console.log('  ✅ Created index on createdAt (descending)');
    } catch (error: any) {
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ Index on createdAt already exists');
      } else {
        throw error;
      }
    }

    try {
      await contactsCollection.createIndex({ status: 1 });
      console.log('  ✅ Created index on status');
    } catch (error: any) {
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ Index on status already exists');
      } else {
        throw error;
      }
    }

    // Setup TTL index for rate_limits collection
    console.log('\n📝 Setting up TTL index for rate_limits collection...');
    const rateLimitCollection = db.collection('rate_limits');
    const RATE_LIMIT_WINDOW_HOURS = 1;
    
    try {
      await rateLimitCollection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: RATE_LIMIT_WINDOW_HOURS * 60 * 60 }
      );
      console.log(`  ✅ Created TTL index on createdAt (expires after ${RATE_LIMIT_WINDOW_HOURS} hour)`);
    } catch (error: any) {
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('  ✅ TTL index on createdAt already exists');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All indexes set up successfully!');

  } catch (error) {
    console.error('\n❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Run the setup
setupIndexes().catch(console.error);
