import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId, projectId, name, canvasData } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    let result
    if (projectId) {
      // Update existing project
      const { data, error } = await supabase
        .from('projects')
        .update({
          name,
          canvas_data: canvasData,
          updated_at: new Date(),
        })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new project
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            user_id: userId,
            name,
            canvas_data: canvasData,
          },
        ])
        .select()
        .single()

      if (error) throw error
      result = data
    }

    console.log('[v0] Project saved:', result.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error saving project:', error)
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 }
    )
  }
}
