import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface LayoutProps {
  children: ReactNode
  title: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  headerActions?: ReactNode
  backTo?: string
}

const maxWidthClasses = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
}

export function Layout({ children, title, maxWidth = 'lg', headerActions, backTo }: LayoutProps) {
  const navigate = useNavigate()

  return (
    <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 py-6`}>
      <header className="flex items-center justify-between mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold m-0">{title}</h1>
        <div className="flex items-center gap-2">
          {headerActions}
          {backTo && (
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Back
            </Button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
