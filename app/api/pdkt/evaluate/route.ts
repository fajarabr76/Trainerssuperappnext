import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { processPdktEvaluation } from '@/app/(main)/pdkt/services/evaluationService';

export async function POST(req: Request) {
  try {
    const { historyId } = await req.json();

    if (!historyId) {
      return NextResponse.json({ success: false, error: 'historyId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const evaluation = await processPdktEvaluation(historyId, user.id);

    return NextResponse.json({ success: true, evaluation });
  } catch (error: any) {
    console.error('[PDKT Evaluate Route] Failed to evaluate session:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
