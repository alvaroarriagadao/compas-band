'use client'

import { createAuthClient } from '@neondatabase/auth/next'

/** Cliente de Neon Auth para componentes cliente. Habla con /api/auth/* */
export const authClient = createAuthClient()
