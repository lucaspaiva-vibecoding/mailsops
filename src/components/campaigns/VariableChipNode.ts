import { Node, mergeAttributes } from '@tiptap/core'

export interface VariableChipOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableChip: {
      insertVariable: (variableName: string) => ReturnType
    }
  }
}

export const VariableChipNode = Node.create<VariableChipOptions>({
  name: 'variableChip',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      variableName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable'),
        renderHTML: (attributes) => ({
          'data-variable': attributes.variableName,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    // Serialize to raw {{variable}} string for email delivery
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-variable': node.attrs.variableName,
      'class': 'variable-chip',
    }), `{{${node.attrs.variableName}}}`]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'inline-flex items-center bg-indigo-900 text-indigo-200 rounded px-1 text-sm font-mono mx-0.5 select-none'
      dom.contentEditable = 'false'
      dom.setAttribute('data-variable', node.attrs.variableName)
      dom.setAttribute('aria-label', `{{${node.attrs.variableName}}} — personalization variable`)
      dom.textContent = `{{${node.attrs.variableName}}}`
      return { dom }
    }
  },

  addCommands() {
    return {
      insertVariable: (variableName: string) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { variableName },
        })
      },
    }
  },
})
