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

async function testConnection() {
  console.log('🔍 Testing MongoDB connection...\n');

  // Check environment variables
  console.log('Environment variables:');
  console.log(`  MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
  console.log(`  MONGODB_CLUSTER: ${process.env.MONGODB_CLUSTER || '❌ Not set'}`);
  console.log(`  MONGODB_USERNAME: ${process.env.MONGODB_USERNAME || process.env.DB_USERNAME || '❌ Not set'}`);
  console.log(`  MONGODB_PASSWORD: ${process.env.MONGODB_PASSWORD || process.env.DB_PASSWORD ? '✅ Set (hidden)' : '❌ Not set'}`);
  console.log('');

  let uri: string;
  try {
    uri = getMongoUri();
    console.log('📝 Constructed MongoDB URI:');
    // Mask password in output
    const maskedUri = uri.replace(/:([^:@]+)@/, ':***@');
    console.log(`  ${maskedUri}\n`);
  } catch (error) {
    console.error('❌ Error constructing URI:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  let client: MongoClient | null = null;
  try {
    console.log('🔌 Attempting to connect...');
    
    // Try with different connection options
    const options = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    };
    
    client = new MongoClient(uri, options);
    
    // Set connection timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      )
    ]);

    console.log('✅ Connected successfully!\n');

    // Test basic operations
    console.log('🧪 Testing database operations...');
    
    const db = client.db('web');
    const dbName = db.databaseName;
    console.log(`  Database name: ${dbName}`);

    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`  Collections found: ${collections.length}`);
    if (collections.length > 0) {
      console.log(`  Collection names: ${collections.map(c => c.name).join(', ')}`);
    }

    // Test signups collection
    const signupsCollection = db.collection('signups');
    const signupCount = await signupsCollection.countDocuments();
    console.log(`  Signups count: ${signupCount}`);

    // Test rate_limits collection
    const rateLimitsCollection = db.collection('rate_limits');
    const rateLimitCount = await rateLimitsCollection.countDocuments();
    console.log(`  Rate limits count: ${rateLimitCount}`);

    console.log('\n✅ All tests passed! MongoDB connection is working correctly.');

  } catch (error) {
    console.error('\n❌ Connection failed!');
    
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`);
      
      // Provide helpful error messages
      if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
        console.error('\n💡 Authentication Error - Possible causes:');
        console.error('   1. Username or password is incorrect');
        console.error('   2. Database user doesn\'t exist in MongoDB Atlas');
        console.error('   3. User doesn\'t have proper permissions');
        console.error('\n   To fix:');
        console.error('   - Go to MongoDB Atlas → Database Access');
        console.error('   - Verify the username matches exactly (case-sensitive)');
        console.error('   - Reset the password if needed');
        console.error('   - Make sure user has "Read and write to any database" permission');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('\n💡 Tip: Check your MONGODB_CLUSTER value - the cluster hostname might be incorrect');
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Tip: Check your network connection and MongoDB Atlas IP whitelist');
      } else if (error.message.includes('IP') || error.message.includes('whitelist')) {
        console.error('\n💡 Tip: Add your IP address to MongoDB Atlas Network Access whitelist');
        console.error('   - Go to MongoDB Atlas → Network Access');
        console.error('   - Add your current IP or use 0.0.0.0/0 for all IPs (development only)');
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed.');
    }
  }
}

// Run the test
testConnection().catch(console.error);
