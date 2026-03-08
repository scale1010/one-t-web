import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import validator from 'validator';

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

// Helper function to get client IP address
function getClientIP(request: NextRequest): string {
  // Check for forwarded IP (from Vercel/proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP if multiple are present
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to other headers
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Last resort fallback
  return 'unknown';
}

// Validate email format
function isValidEmail(email: string): boolean {
  return validator.isEmail(email) && email.length <= 254;
}

// Check rate limit for IP address
async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const client = await clientPromise();
    const db = client.db('web');
    const rateLimitCollection = db.collection('rate_limits');
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
    
    // Find existing rate limit record for this IP
    const existingRecord = await rateLimitCollection.findOne({
      ipAddress,
      createdAt: { $gte: windowStart }
    });
    
    if (existingRecord) {
      if (existingRecord.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        // Calculate retry after time
        const retryAfter = Math.ceil(
          (existingRecord.createdAt.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000 - now.getTime()) / 1000
        );
        return { allowed: false, retryAfter };
      }
      
      // Increment request count
      await rateLimitCollection.updateOne(
        { _id: existingRecord._id },
        { $inc: { requestCount: 1 } }
      );
    } else {
      // Create new rate limit record
      await rateLimitCollection.insertOne({
        ipAddress,
        createdAt: now,
        requestCount: 1
      });
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request (fail open)
    return { allowed: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check MongoDB connection first
    try {
      await clientPromise();
    } catch (mongoError) {
      console.error('MongoDB connection error:', mongoError);
      return NextResponse.json(
        { error: 'Database connection error. Please check your configuration.' },
        { status: 500 }
      );
    }

    // Get client IP
    const ipAddress = getClientIP(request);
    
    // Check rate limit
    const rateLimitCheck = await checkRateLimit(ipAddress);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitCheck.retryAfter?.toString() || '3600'
          }
        }
      );
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { email } = body;
    
    // Validate email presence
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    const client = await clientPromise();
    const db = client.db('web');
    const signupsCollection = db.collection('signups');
    
    // Check if email already exists
    const existingSignup = await signupsCollection.findOne({ email: trimmedEmail });
    
    if (existingSignup) {
      // Return success even if email exists (don't reveal existence)
      return NextResponse.json({ success: true });
    }
    
    // Get user agent for analytics
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Insert new signup
    await signupsCollection.insertOne({
      email: trimmedEmail,
      createdAt: new Date(),
      ipAddress,
      userAgent,
      status: 'pending'
    });
    
    // Create indexes if they don't exist (idempotent)
    try {
      await signupsCollection.createIndex({ email: 1 }, { unique: true });
      await signupsCollection.createIndex({ createdAt: 1 });
    } catch (indexError) {
      // Index might already exist, ignore error
    }
    
    // Create TTL index on rate_limits collection for auto-cleanup
    try {
      const rateLimitCollection = db.collection('rate_limits');
      await rateLimitCollection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: RATE_LIMIT_WINDOW_HOURS * 60 * 60 }
      );
    } catch (indexError) {
      // Index might already exist, ignore error
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
