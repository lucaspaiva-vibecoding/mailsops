import { useState } from 'react'
import { Editor } from '@tiptap/react'
import { Bold, Italic, Heading1, Heading2, List, Link2, Image } from 'lucide-react'
import { VariableDropdown } from './VariableDropdown'

interface CampaignEditorToolbarProps {
  editor: Editor
}

function ToolbarButton({ active, onClick, children, ariaLabel }: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`w-8 h-8 p-0 inline-flex items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-gray-700 text-gray-100'
          : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-gray-700 mx-1" />
}

export function CampaignEditorToolbar({ editor }: CampaignEditorToolbarProps) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const handleInsertLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
      setLinkUrl('')
      setLinkPopoverOpen(false)
    }
  }

  const handleInsertImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run()
      setImageUrl('')
      setImagePopoverOpen(false)
    }
  }

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleInsertLink() }
    if (e.key === 'Escape') { setLinkPopoverOpen(false); editor.commands.focus() }
  }

  const handleImageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleInsertImage() }
    if (e.key === 'Escape') { setImagePopoverOpen(false); editor.commands.focus() }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1 p-2 bg-gray-800 border-b border-gray-700">
      <ToolbarButton
        ariaLabel="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        ariaLabel="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        ariaLabel="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        ariaLabel="Insert link"
        active={editor.isActive('link')}
        onClick={() => { setLinkPopoverOpen(!linkPopoverOpen); setImagePopoverOpen(false) }}
      >
        <Link2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Insert image"
        active={false}
        onClick={() => { setImagePopoverOpen(!imagePopoverOpen); setLinkPopoverOpen(false) }}
      >
        <Image size={16} />
      </ToolbarButton>

      <Divider />

      <VariableDropdown editor={editor} />

      {/* Link popover */}
      {linkPopoverOpen && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 z-20 flex gap-2 items-center">
          <input
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            className="bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            type="button"
            onClick={handleInsertLink}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            Insert link
          </button>
        </div>
      )}

      {/* Image popover */}
      {imagePopoverOpen && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 z-20 flex gap-2 items-center">
          <input
            type="url"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={handleImageKeyDown}
            className="bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <button
            type="button"
            onClick={handleInsertImage}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            Insert image
          </button>
        </div>
      )}
    </div>
  )
}
