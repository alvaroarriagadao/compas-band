export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string | null
          logo_url: string | null
          access_code: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          slug?: string | null
          logo_url?: string | null
          access_code?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          slug?: string | null
          logo_url?: string | null
          access_code?: string | null
          owner_id?: string | null
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
          metro_sound: string
          metro_subdivision: number
          metro_volume: number
          metro_beats: number
          metro_accent: boolean
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
          metro_sound?: string
          metro_subdivision?: number
          metro_volume?: number
          metro_beats?: number
          metro_accent?: boolean
        }
        Update: {
          title?: string
          bpm?: number
          song_order?: number
          lyrics?: string
          notes?: string
          metro_sound?: string
          metro_subdivision?: number
          metro_volume?: number
          metro_beats?: number
          metro_accent?: boolean
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
      project_members: {
        Row: {
          project_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          role?: string
        }
        Update: { role?: string }
        Relationships: []
      }
      setlists: {
        Row: {
          id: string
          project_id: string
          name: string
          event_date: string | null
          venue: string | null
          notes: string | null
          setlist_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          event_date?: string | null
          venue?: string | null
          notes?: string | null
          setlist_order?: number
        }
        Update: {
          name?: string
          event_date?: string | null
          venue?: string | null
          notes?: string | null
          setlist_order?: number
        }
        Relationships: []
      }
      setlist_songs: {
        Row: {
          id: string
          setlist_id: string
          song_id: string | null
          custom_title: string | null
          song_order: number
          notes: string | null
        }
        Insert: {
          id?: string
          setlist_id: string
          song_id?: string | null
          custom_title?: string | null
          song_order?: number
          notes?: string | null
        }
        Update: {
          song_order?: number
          notes?: string | null
        }
        Relationships: []
      }
    }
      gig_dates: {
        Row: {
          id: string
          project_id: string | null
          title: string
          date: string
          end_date: string | null
          status: string
          venue: string | null
          notes: string | null
          setlist_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          title: string
          date: string
          end_date?: string | null
          status?: string
          venue?: string | null
          notes?: string | null
          setlist_id?: string | null
        }
        Update: {
          project_id?: string | null
          title?: string
          date?: string
          end_date?: string | null
          status?: string
          venue?: string | null
          notes?: string | null
          setlist_id?: string | null
        }
        Relationships: []
      }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type Song = Database['public']['Tables']['songs']['Row']
export type Setlist = Database['public']['Tables']['setlists']['Row']
export type SetlistSong = Database['public']['Tables']['setlist_songs']['Row']
