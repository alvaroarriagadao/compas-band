export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          id: string
          project_id: string
          title: string
          bpm: number
          song_order: number
          lyrics: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          bpm?: number
          song_order?: number
          lyrics?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          bpm?: number
          song_order?: number
          lyrics?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'songs_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type Song = Database['public']['Tables']['songs']['Row']
