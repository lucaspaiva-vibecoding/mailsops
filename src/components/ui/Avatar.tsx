interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-indigo-700 flex items-center justify-center font-semibold text-white ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  )
}
