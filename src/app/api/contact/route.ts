import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { resetConnection, isConnectionError } from '@/lib/mongodb';
import validator from 'validator';

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

// Helper function to get client IP address
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
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
        type: 'contact',
        createdAt: { $gte: windowStart }
      },
      {
        $setOnInsert: { createdAt: now, type: 'contact' },
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
    
    const { name, email, message } = body;
    
    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Validate and sanitize inputs
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMessage = message.trim();

    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Name must be between 1 and 100 characters' },
        { status: 400 }
      );
    }

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be between 10 and 5000 characters' },
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
      
      // Insert contact submission
      const contactsCollection = db.collection('contacts');
      await contactsCollection.insertOne({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
        createdAt: new Date(),
        ipAddress,
        userAgent: request.headers.get('user-agent') || 'unknown',
        status: 'new'
      });
      
      return { type: 'success' };
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
    console.error('Contact submission error:', error);
    
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
