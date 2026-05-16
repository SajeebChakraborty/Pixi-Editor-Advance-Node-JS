import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
  console.error('Supabase credentials missing or invalid')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const templatesDir = path.join(process.cwd(), 'templates_seed')

async function seedTemplates() {
  const files = fs.readdirSync(templatesDir)
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    
    console.log(`Seeding dynamic template: ${file}`)
    const filePath = path.join(templatesDir, file)
    const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    
    const { data, error } = await supabase
      .from('templates')
      .upsert([
        {
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          width: templateData.width,
          height: templateData.height,
          layers: templateData.layers,
          published: true,
          tags: [templateData.category, 'detailed', 'pro']
        }
      ], { onConflict: 'name' })

    if (error) {
      console.error(`Error seeding ${file}:`, error.message)
    } else {
      console.log(`Successfully seeded ${file}`)
    }
  }
}

seedTemplates()
  .then(() => console.log('Seeding completed!'))
  .catch(err => console.error('Seeding failed:', err))
