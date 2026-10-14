// Esquema permitido para /api/db. Solo estas tablas y columnas se pueden consultar.
export type ColType = 'text' | 'int' | 'float' | 'bool' | 'uuid' | 'date' | 'time' | 'timestamptz'

export interface TableDef {
  columns: Record<string, ColType>
  pk: string[]
  /** columna FK -> tabla referenciada (para embeds tipo alias:fk(cols)) */
  fks?: Record<string, string>
  /** columnas usadas como clave de conflicto en upsert */
  conflict?: string[]
}

const ts = { created_at: 'timestamptz', updated_at: 'timestamptz' } as const

export const TABLES: Record<string, TableDef> = {
  profiles: {
    columns: { id: 'text', email: 'text', display_name: 'text', is_active: 'bool', ...ts },
    pk: ['id'], conflict: ['id'],
  },
  projects: {
    columns: { id: 'uuid', name: 'text', description: 'text', slug: 'text', logo_url: 'text', access_code: 'text', owner_id: 'text', ...ts },
    pk: ['id'], conflict: ['id'],
  },
  project_members: {
    columns: { project_id: 'uuid', user_id: 'text', role: 'text', joined_at: 'timestamptz' },
    pk: ['project_id', 'user_id'], conflict: ['project_id', 'user_id'],
    fks: { project_id: 'projects' },
  },
  songs: {
    columns: {
      id: 'uuid', project_id: 'uuid', title: 'text', bpm: 'int', song_order: 'int', lyrics: 'text', notes: 'text',
      metro_sound: 'text', metro_subdivision: 'int', metro_volume: 'float', metro_beats: 'int', metro_accent: 'bool', ...ts,
    },
    pk: ['id'], conflict: ['id'], fks: { project_id: 'projects' },
  },
  setlists: {
    columns: { id: 'uuid', project_id: 'uuid', name: 'text', event_date: 'date', venue: 'text', notes: 'text', setlist_order: 'int', ...ts },
    pk: ['id'], conflict: ['id'], fks: { project_id: 'projects' },
  },
  setlist_songs: {
    columns: { id: 'uuid', setlist_id: 'uuid', song_id: 'uuid', custom_title: 'text', song_order: 'int', notes: 'text' },
    pk: ['id'], conflict: ['id'], fks: { setlist_id: 'setlists', song_id: 'songs' },
  },
  rehearsals: {
    columns: { id: 'uuid', project_id: 'uuid', title: 'text', rehearsal_date: 'date', notes: 'text', ...ts },
    pk: ['id'], conflict: ['id'], fks: { project_id: 'projects' },
  },
  recordings: {
    columns: { id: 'uuid', rehearsal_id: 'uuid', project_id: 'uuid', title: 'text', audio_url: 'text', duration_seconds: 'int', created_at: 'timestamptz' },
    pk: ['id'], conflict: ['id'], fks: { rehearsal_id: 'rehearsals', project_id: 'projects' },
  },
  gig_dates: {
    columns: {
      id: 'uuid', project_id: 'uuid', title: 'text', date: 'date', end_date: 'date', start_time: 'time', end_time: 'time',
      status: 'text', venue: 'text', notes: 'text', setlist_id: 'uuid', created_at: 'timestamptz',
    },
    pk: ['id'], conflict: ['id'], fks: { project_id: 'projects' },
  },
  gig_attendance: {
    columns: { id: 'uuid', gig_id: 'uuid', user_id: 'text', user_email: 'text', display_name: 'text', status: 'text', created_at: 'timestamptz' },
    pk: ['id'], conflict: ['gig_id', 'user_id'], fks: { gig_id: 'gig_dates' },
  },
}
