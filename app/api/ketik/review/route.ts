import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { triggerKetikAIReview } from '@/app/actions/ketik-ai-review';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const result = await triggerKetikAIReview(sessionId);

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error, status: 'failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: result.status === 'skipped' ? 'completed' : result.status });
  } catch (error) {
    console.error('[Ketik Review Route] Failed to review session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to review session' },
      { status: 500 }
    );
  }
}
