import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionOptions } from '@tiptap/suggestion'
import { VARIABLES } from './VariableDropdown'

type VariableItem = typeof VARIABLES[number]

export interface VariableSlashCommandOptions {
  suggestion: Partial<SuggestionOptions<VariableItem, VariableItem>>
}

export const VariableSlashCommand = Extension.create<VariableSlashCommandOptions>({
  name: 'variableSlashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          // Delete the '/' trigger text and insert the variable chip
          editor.chain().focus().deleteRange(range).insertVariable(props.value).run()
        },
        items: ({ query }: { query: string }) => {
          return VARIABLES.filter((v) =>
            v.label.toLowerCase().includes(query.toLowerCase()) ||
            v.value.toLowerCase().includes(query.toLowerCase())
          )
        },
        render: () => {
          let popup: HTMLDivElement | null = null
          let selectedIndex = 0
          let items: VariableItem[] = []

          const updateSelection = () => {
            if (!popup) return
            const buttons = popup.querySelectorAll('button')
            buttons.forEach((btn, i) => {
              if (i === selectedIndex) {
                btn.classList.add('bg-gray-700')
              } else {
                btn.classList.remove('bg-gray-700')
              }
            })
          }

          return {
            onStart: (props) => {
              items = props.items as VariableItem[]
              selectedIndex = 0

              popup = document.createElement('div')
              popup.className = 'bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-50 min-w-[180px]'
              popup.style.position = 'fixed'

              items.forEach((item, index) => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = 'flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left'
                btn.textContent = item.label
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  props.command(item)
                })
                btn.addEventListener('mouseenter', () => {
                  selectedIndex = index
                  updateSelection()
                })
                popup!.appendChild(btn)
              })

              updateSelection()

              // Position popup near the cursor using clientRect
              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  popup.style.left = `${rect.left}px`
                  popup.style.top = `${rect.bottom + 4}px`
                }
              }
              document.body.appendChild(popup)
            },

            onUpdate: (props) => {
              items = props.items as VariableItem[]
              selectedIndex = 0

              if (!popup) return

              // Rebuild popup contents
              popup.innerHTML = ''
              items.forEach((item, index) => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = 'flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left'
                btn.textContent = item.label
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  props.command(item)
                })
                btn.addEventListener('mouseenter', () => {
                  selectedIndex = index
                  updateSelection()
                })
                popup!.appendChild(btn)
              })

              updateSelection()

              // Reposition
              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect) {
                  popup.style.left = `${rect.left}px`
                  popup.style.top = `${rect.bottom + 4}px`
                }
              }
            },

            onKeyDown: (props) => {
              if (props.event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length
                updateSelection()
                return true
              }
              if (props.event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length
                updateSelection()
                return true
              }
              if (props.event.key === 'Enter') {
                if (items[selectedIndex]) {
                  props.command(items[selectedIndex])
                }
                return true
              }
              if (props.event.key === 'Escape') {
                if (popup) {
                  popup.remove()
                  popup = null
                }
                return true
              }
              return false
            },

            onExit: () => {
              if (popup) {
                popup.remove()
                popup = null
              }
            },
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      } as SuggestionOptions<VariableItem, VariableItem>),
    ]
  },
})
