import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
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

// Check rate limit for IP address
async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const client = await clientPromise();
    const db = client.db('web');
    const rateLimitCollection = db.collection('rate_limits');
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
    
    const existingRecord = await rateLimitCollection.findOne({
      ipAddress,
      createdAt: { $gte: windowStart },
      type: 'contact'
    });
    
    if (existingRecord) {
      if (existingRecord.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil(
          (existingRecord.createdAt.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000 - now.getTime()) / 1000
        );
        return { allowed: false, retryAfter };
      }
      
      await rateLimitCollection.updateOne(
        { _id: existingRecord._id },
        { $inc: { requestCount: 1 } }
      );
    } else {
      await rateLimitCollection.insertOne({
        ipAddress,
        type: 'contact',
        createdAt: now,
        requestCount: 1
      });
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
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
    
    // Connect to MongoDB
    const client = await clientPromise();
    const db = client.db('web');
    const contactsCollection = db.collection('contacts');
    
    // Get user agent for analytics
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Insert contact submission
    await contactsCollection.insertOne({
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      createdAt: new Date(),
      ipAddress,
      userAgent,
      status: 'new'
    });
    
    // Create indexes if they don't exist (idempotent)
    try {
      await contactsCollection.createIndex({ email: 1 });
      await contactsCollection.createIndex({ createdAt: -1 });
      await contactsCollection.createIndex({ status: 1 });
    } catch (indexError) {
      // Index might already exist, ignore error
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Contact submission error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
