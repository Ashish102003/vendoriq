import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { ComingSoon } from '../components/common/ComingSoon'

function getModuleName(raw: string | undefined): string {
  if (!raw) return 'Selected Module'
  try {
    return decodeURIComponent(raw)
  } catch {
    return 'Selected Module'
  }
}

export function ComingSoonPage() {
  const { module } = useParams<{ module: string }>()
  const moduleName = getModuleName(module)

  return (
    <AppLayout title={moduleName}>
      <ComingSoon moduleName={moduleName} />
    </AppLayout>
  )
}