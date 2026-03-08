import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { resetConnection, isConnectionError } from '@/lib/mongodb';
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

// Check rate limit for IP address using atomic operation
async function checkRateLimit(ipAddress: string, db: any): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const rateLimitCollection = db.collection('rate_limits');
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
    
    // Use findOneAndUpdate with upsert for atomic operation (single round trip)
    const result = await rateLimitCollection.findOneAndUpdate(
      {
        ipAddress,
        createdAt: { $gte: windowStart }
      },
      {
        $setOnInsert: { createdAt: now },
        $inc: { requestCount: 1 }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    
    const record = result.value || result;
    
    // Check if rate limit exceeded
    if (record && record.requestCount > RATE_LIMIT_MAX_REQUESTS) {
      const retryAfter = Math.ceil(
        (record.createdAt.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000 - now.getTime()) / 1000
      );
      return { allowed: false, retryAfter };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request (fail open)
    return { allowed: true };
  }
}

// Helper to execute MongoDB operation with automatic retry on connection failure
async function withMongoRetry<T>(
  operation: (db: any) => Promise<T>
): Promise<T> {
  let retries = 2; // Try original connection, then retry once with new connection
  
  while (retries > 0) {
    try {
      const client = await clientPromise();
      const db = client.db('web');
      return await operation(db);
    } catch (error: any) {
      // Check if it's a connection-related error
      if (isConnectionError(error) && retries > 1) {
        // Connection error - reset cache and retry once with fresh connection
        console.warn('MongoDB connection error detected, resetting and retrying:', error.message);
        resetConnection();
        retries--;
        continue;
      }
      
      // Not a connection error, or already retried - throw it
      throw error;
    }
  }
  
  throw new Error('Failed to connect to MongoDB after retries');
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body first (before any DB calls)
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

    // Get client IP
    const ipAddress = getClientIP(request);
    
    // Execute operations with automatic retry on connection failure
    const result = await withMongoRetry(async (db) => {
      // Check rate limit (using shared db connection)
      const rateLimitCheck = await checkRateLimit(ipAddress, db);
      if (!rateLimitCheck.allowed) {
        return { type: 'rateLimited', retryAfter: rateLimitCheck.retryAfter };
      }
      
      // Try to insert signup
      const signupsCollection = db.collection('signups');
      try {
        await signupsCollection.insertOne({
          email: trimmedEmail,
          createdAt: new Date(),
          ipAddress,
          userAgent: request.headers.get('user-agent') || 'unknown',
          status: 'pending'
        });
        return { type: 'success' };
      } catch (error: any) {
        // If duplicate key error (email already exists), that's fine - return success
        if (error.code === 11000 || error.codeName === 'DuplicateKey') {
          return { type: 'success' };
        }
        // Re-throw other errors
        throw error;
      }
    });
    
    // Handle rate limit response
    if (result.type === 'rateLimited') {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': result.retryAfter?.toString() || '3600'
          }
        }
      );
    }
    
    // Return success
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle duplicate key error gracefully (email already exists)
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      return NextResponse.json({ success: true });
    }
    
    // Check if it's a connection error after retries
    if (isConnectionError(error)) {
      return NextResponse.json(
        { error: 'Database connection error. Please try again later.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
