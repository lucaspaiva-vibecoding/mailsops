import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const variantClasses = {
  default: 'bg-gray-700 text-gray-200',
  success: 'bg-green-900/50 text-green-400',
  warning: 'bg-yellow-900/50 text-yellow-400',
  danger: 'bg-red-900/50 text-red-400',
  info: 'bg-indigo-900/50 text-indigo-400',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
