import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/shared/lib/auth/session.server';

const BACKEND_URL = process.env.BACKEND_URL ?? '';

/**
 * BFF upload endpoint.
 * Accepts multipart/form-data and proxies it to the backend /upload.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    // TODO: Adjust backend upload endpoint path if needed
    const backendResponse = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!backendResponse.ok) {
      const errorBody = await backendResponse.text();
      return NextResponse.json(
        { error: 'Upload failed', details: errorBody },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
