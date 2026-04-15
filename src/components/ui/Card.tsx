import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({ padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
