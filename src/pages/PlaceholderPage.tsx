interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
      <p className="text-sm text-gray-500 mt-2">
        {description ?? 'This feature is coming in a future module.'}
      </p>
    </div>
  )
}
