import type { Canvas } from 'fabric'
import { supabase } from './supabase'
import { uploadTemplateAction } from '@/app/actions/templates'

export interface TemplateLayer {
  id: string
  type: 'text' | 'image' | 'shape'
  name: string
  locked: boolean
  properties: Record<string, any>
  isPlaceholder?: boolean
}

export interface Template {
  id: string
  name: string
  description: string
  width: number
  height: number
  category: string
  layers: TemplateLayer[]
  thumbnail?: string
  tags?: string[]
  published?: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Mock template data
export const TEMPLATE_LIBRARY: Template[] = [
  {
    id: 'template-1',
    name: 'Social Media Post',
    description: 'Standard Instagram/TikTok post',
    width: 1080,
    height: 1080,
    category: 'social',
    layers: [
      {
        id: 'bg-1',
        type: 'shape',
        name: 'Background',
        locked: true,
        properties: {
          fill: '#f3f4f6',
          width: 1080,
          height: 1080,
        },
      },
      {
        id: 'img-1',
        type: 'image',
        name: 'Main Image',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 54,
          top: 54,
          width: 972,
          height: 600,
          fill: '#e5e7eb',
        },
      },
      {
        id: 'text-1',
        type: 'text',
        name: 'Title',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 54,
          top: 700,
          fontSize: 48,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#1f2937',
          text: 'Your Title Here',
        },
      },
    ],
  },
  {
    id: 'template-2',
    name: 'Video Thumbnail',
    description: 'YouTube/streaming video thumbnail',
    width: 1280,
    height: 720,
    category: 'video',
    layers: [
      {
        id: 'bg-2',
        type: 'shape',
        name: 'Background',
        locked: true,
        properties: {
          fill: '#1f2937',
          width: 1280,
          height: 720,
        },
      },
      {
        id: 'img-2',
        type: 'image',
        name: 'Thumbnail Image',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 40,
          top: 40,
          width: 1200,
          height: 640,
        },
      },
      {
        id: 'text-2',
        type: 'text',
        name: 'Main Title',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 40,
          top: 600,
          fontSize: 60,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#ffffff',
          text: 'TITLE',
        },
      },
    ],
  },
  {
    id: 'template-3',
    name: 'Product Showcase',
    description: 'Showcase product with text overlay',
    width: 1080,
    height: 1080,
    category: 'product',
    layers: [
      {
        id: 'bg-3',
        type: 'shape',
        name: 'Background',
        locked: false,
        properties: {
          fill: '#ffffff',
          width: 1080,
          height: 1080,
        },
      },
      {
        id: 'img-3',
        type: 'image',
        name: 'Product Image',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 162,
          top: 108,
          width: 756,
          height: 756,
        },
      },
      {
        id: 'text-3',
        type: 'text',
        name: 'Product Name',
        locked: false,
        isPlaceholder: true,
        properties: {
          left: 54,
          top: 900,
          fontSize: 40,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          fill: '#000000',
          text: 'Product Name',
        },
      },
    ],
  },
]

export class TemplateManager {
  /**
   * Get all templates from Supabase or localStorage
   */
  static async getTemplates(): Promise<Template[]> {
    // 1. Try localStorage first (Admin's local changes)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pixigen_templates');
      if (saved) {
        return JSON.parse(saved);
      }
    }

    // 2. Try Supabase
    if (supabase && !(process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('placeholder')) {
      try {
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data) {
          const fetched = data.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            width: t.width,
            height: t.height,
            category: t.category,
            layers: t.layers as TemplateLayer[],
            thumbnail: t.thumbnail_url
          }));
          return fetched;
        }
      } catch (e) {
        console.warn('Supabase fetch failed, falling back to mock');
      }
    }

    return TEMPLATE_LIBRARY;
  }

  /**
   * Save a template to Supabase or localStorage
   */
  static async saveTemplate(template: Omit<Template, 'id'>): Promise<Template | null> {
    const newId = `template-${Date.now()}`;
    const newTemplate: Template = { ...template, id: newId };

    // 1. Save to Supabase if possible
    if (supabase && !(process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('placeholder')) {
      try {
        const { data, error } = await supabase
          .from('templates')
          .insert([
            {
              id: newId,
              name: template.name,
              description: template.description,
              width: template.width,
              height: template.height,
              category: template.category,
              layers: template.layers,
              thumbnail_url: template.thumbnail,
              tags: template.tags || [],
              published: template.published || false
            }
          ])
          .select()

        if (!error && data) {
          // Sync with local anyway
          this.syncToLocal(newTemplate);
          return newTemplate;
        }
      } catch (e) {
        console.warn('Supabase save failed, using local only');
      }
    }

    // 2. Save to localStorage
    this.syncToLocal(newTemplate);
    return newTemplate;
  }

  /**
   * Upload a complete template with thumbnail and JSON layout
   */
  static async  uploadTemplate(
    name: string,
    description: string,
    category: string,
    tags: string[],
    thumbnailFile: File | null,
    jsonFile: File | null,
    published: boolean = false
  ): Promise<Template | null> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("category", category);
    formData.append("tags", JSON.stringify(tags));
    formData.append("published", published.toString());
    if (thumbnailFile) formData.append("thumbnailFile", thumbnailFile);
    if (jsonFile) formData.append("jsonFile", jsonFile);

    const result = await uploadTemplateAction(formData);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  private static syncToLocal(template: Template) {
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem('pixigen_templates');
    const templates = existing ? JSON.parse(existing) : [...TEMPLATE_LIBRARY];
    const index = templates.findIndex((t: Template) => t.id === template.id);
    
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.unshift(template);
    }
    
    localStorage.setItem('pixigen_templates', JSON.stringify(templates));
  }

  /**
   * Delete a template from Supabase or localStorage
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    // 1. Delete from local anyway
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pixigen_templates');
      if (saved) {
        const templates = JSON.parse(saved);
        const filtered = templates.filter((t: Template) => t.id !== id);
        localStorage.setItem('pixigen_templates', JSON.stringify(filtered));
      }
    }

    // 2. Delete from Supabase
    if (supabase && !(process.env.NEXT_PUBLIC_SUPABASE_URL || '').includes('placeholder')) {
      try {
        const { error } = await supabase
          .from('templates')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting template from Supabase:', error)
          return false
        }
      } catch (e) {
        console.warn('Supabase delete failed');
      }
    }
    
    return true
  }

  /**
   * Get templates by category
   */
  static getTemplatesByCategory(category: string): Template[] {
    return TEMPLATE_LIBRARY.filter((t) => t.category === category)
  }

  /**
   * Get template by ID
   */
  static getTemplate(id: string): Template | undefined {
    return TEMPLATE_LIBRARY.find((t) => t.id === id)
  }

  /**
   * Apply template to canvas
   */
  /**
   * Apply template to canvas
   */
  static async applyTemplate(canvas: Canvas, template: Template) {
    canvas.clear()
    
    // Set dimensions
    canvas.setDimensions({ width: template.width, height: template.height })
    
    // Prepare objects for Fabric's loadFromJSON
    const objects = template.layers.map(layer => {
      const props = layer.properties || {};
      return {
        ...props,
        // Inject custom properties
        id: layer.id,
        name: layer.name,
        // Handle locking
        selectable: !layer.locked,
        evented: !layer.locked,
        lockMovementX: layer.locked,
        lockMovementY: layer.locked,
        lockRotation: layer.locked,
        lockScalingX: layer.locked,
        lockScalingY: layer.locked,
        // Custom flags
        isPlaceholder: layer.isPlaceholder || false,
        // Ensure type is present
        type: layer.type === 'shape' ? props.type || 'rect' : layer.type,
      }
    });

    // Load entire canvas state
    const canvasJSON = {
      version: "5.3.0", // or whatever version you are targeting
      objects: objects,
      background: template.category === 'background' ? template.layers[0]?.properties?.fill : undefined 
    };

    try {
      await canvas.loadFromJSON(canvasJSON);
      canvas.renderAll();
      console.log("Template applied successfully");
    } catch (error) {
      console.error("Error applying template with loadFromJSON:", error);
      
      // Fallback: Manual creation (simplified)
      for (const objDef of objects) {
         try {
             // Basic implementation for fallback
             // Real implementation would need full factory
         } catch(e) { console.error(e) }
      }
    }
  }

  /**
   * Duplicate template
   */
  static duplicateTemplate(templateId: string): Template | undefined {
    const original = this.getTemplate(templateId)
    if (!original) return undefined

    const duplicated: Template = {
      ...original,
      id: `template-${Date.now()}`,
      name: `${original.name} (Copy)`,
      layers: original.layers.map((layer) => ({
        ...layer,
        id: `${layer.id}-${Date.now()}`,
      })),
    }

    return duplicated
  }

  /**
   * Reset template to original state
   */
  static resetTemplate(templateId: string): Template | undefined {
    return this.getTemplate(templateId)
  }

  /**
   * Create custom template from canvas
   */
  static createTemplateFromCanvas(
    canvas: Canvas,
    name: string,
    category: string
  ): Template {
    const layers: TemplateLayer[] = []

    canvas.getObjects().forEach((obj, index) => {
      const layer: TemplateLayer = {
        id: `layer-${index}`,
        type: (obj.type as any) || 'shape',
        name: (obj as any).name || `Layer ${index}`,
        locked: !obj.selectable,
        properties: obj.toJSON(),
      }
      layers.push(layer)
    })

    return {
      id: `template-${Date.now()}`,
      name,
      description: `Custom template: ${name}`,
      width: canvas.width || 1080,
      height: canvas.height || 1080,
      category,
      layers,
    }
  }
}
