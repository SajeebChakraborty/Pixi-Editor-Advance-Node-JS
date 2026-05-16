import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { width, height, layers, fps = 30, userId } = body;

    console.log('[Export API] Starting export job...', { width, height, layerCount: layers?.objects?.length });

    // 1. Create a job entry in the storage_jobs table (Queue system)
    const { data: job, error: jobError } = await supabase
        .from('storage_jobs')
        .insert([
            {
                user_id: userId,
                type: 'render_video',
                status: 'queued',
                payload: { width, height, layers, fps }
            }
        ])
        .select()
        .single();

    if (jobError) throw jobError;

    // In a real production environment, we would now trigger a background worker
    // via a webhook, message queue (Upstash/Redis), or Supabase Edge Function.
    
    // Simulate background trigger notification
    console.log(`[Queue] Job ${job.id} created and queued for background processing.`);

    // Return the jobId immediately (non-blocking)
    return NextResponse.json({ 
        success: true, 
        message: 'Video export job queued successfully in background',
        jobId: job.id,
        status: 'queued'
    });

  } catch (error) {
    console.error('[Export API] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
