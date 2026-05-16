import { createClient } from '@supabase/supabase-js'
import { S3Storage } from './storage-s3'

const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.startsWith('http')) {
    return 'https://placeholder.supabase.co'; // Fallback to a valid URL format
  }
  return url;
};

const supabaseUrl = getSupabaseUrl();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Project operations
export async function saveProject(userId: string, name: string, canvasData: any) {
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

  if (error) {
    console.error('[v0] Error saving project:', error)
    return null
  }
  return data?.[0]
}

export async function updateProject(projectId: string, canvasData: any) {
  const { data, error } = await supabase
    .from('projects')
    .update({ canvas_data: canvasData, updated_at: new Date() })
    .eq('id', projectId)
    .select()

  if (error) {
    console.error('[v0] Error updating project:', error)
    return null
  }
  return data?.[0]
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) {
    console.error('[v0] Error fetching project:', error)
    return null
  }
  return data
}

export async function getUserProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[v0] Error fetching projects:', error)
    return []
  }
  return data || []
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    console.error('[v0] Error deleting project:', error)
    return false
  }
  return true
}

// Asset operations
export async function uploadAsset(
  userId: string,
  projectId: string,
  name: string,
  type: string,
  url: string,
  fileSize?: number
) {
  const { data, error } = await supabase
    .from('assets')
    .insert([
      {
        user_id: userId,
        project_id: projectId,
        name,
        type,
        url,
        file_size: fileSize,
      },
    ])
    .select()

  if (error) {
    console.error('[v0] Error uploading asset:', error)
    return null
  }
  return data?.[0]
}

export async function getProjectAssets(projectId: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[v0] Error fetching assets:', error)
    return []
  }
  return data || []
}

export async function deleteAsset(assetId: string) {
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)

  if (error) {
    console.error('[v0] Error deleting asset:', error)
    return false
  }
  return true
}

// Global/Admin Asset Operations
export async function uploadGlobalAsset(
  file: File,
  name: string,
  type: string,
  category: string
) {
  // 1. Upload file to S3
  const fileExt = file.name.split('.').pop();
  const fileName = `${type}s/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const publicUrl = await S3Storage.uploadFile(file, fileName, file.type);

  if (!publicUrl) {
    console.error('Error uploading file to S3');
    return null;
  }

  // 2. Initial DB Record
  const { data, error } = await supabase
    .from('assets')
    .insert([
      {
        name,
        type,
        category,
        url: publicUrl,
        user_id: (await supabase.auth.getUser()).data.user?.id, // Optional if allowed null
        project_id: null, // Indicates global asset
        file_size: file.size,
        is_public: true
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving asset record:', error);
    return null;
  }

  return data;
}

export async function getGlobalAssets(type?: string) {
  let query = supabase
    .from('assets')
    .select('*')
    .is('project_id', null) // Filter for global assets
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching global assets:', error);
    return [];
  }
  return data || [];
}
