interface CampaignPreviewProps {
  bodyHtml: string
}

const SAMPLE_DATA: Record<string, string> = {
  first_name: 'Alex',
  last_name: 'Smith',
  company: 'Acme Corp',
}

function substituteVariables(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`)
}

export function CampaignPreview({ bodyHtml }: CampaignPreviewProps) {
  const substituted = substituteVariables(bodyHtml)

  if (!bodyHtml || bodyHtml === '<p></p>') {
    return (
      <div className="flex justify-center p-8 bg-gray-950 rounded-lg">
        <p className="text-sm text-gray-400">No content to preview yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center p-8 bg-gray-950 rounded-lg">
      <p className="text-xs text-gray-400 mb-2 text-center">
        Preview with sample data: Alex Smith &middot; Acme Corp
      </p>
      <div
        className="max-w-[600px] w-full bg-white text-gray-900 p-8 rounded-lg shadow-xl prose"
        dangerouslySetInnerHTML={{ __html: substituted }}
      />
    </div>
  )
}
