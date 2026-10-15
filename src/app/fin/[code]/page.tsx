'use client'

import { useParams } from 'next/navigation'
import { FinanceLoader } from '@/components/finance/FinanceLoader'

// Vista pública de solo lectura, compartida con el código de la banda.
export default function PublicFinanzasPage() {
  const { code } = useParams<{ code: string }>()
  return <FinanceLoader query={{ code }} canEdit={false} backHref="/login" backLabel="Compás" />
}
