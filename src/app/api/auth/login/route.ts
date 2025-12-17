import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // TODO: Replace with actual user validation against your backend
    // This is a mock implementation for development
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Mock user validation - in production, validate against your database
    if (email && password.length >= 6) {
      // Return mock user data
      const user = {
        id: `user_${Date.now()}`,
        email: email,
        name: email.split('@')[0], // Use email prefix as name
      };

      return NextResponse.json(user);
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
