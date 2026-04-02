import { NextRequest, NextResponse } from 'next/server';
import { buildSteps } from '@/lib/ukkonen';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const txt = typeof body.txt === 'string' ? body.txt.slice(0, 20) : '';

  if (txt.length === 0) {
    return NextResponse.json({ error: 'txt is required' }, { status: 400 });
  }

  const steps = buildSteps(txt);
  return NextResponse.json({ steps });
}
