import Editor, { type Monaco } from '@monaco-editor/react'

/** Read-only SQL viewer themed to the obsidian/cobalt/lime palette. */
export default function SqlEditor({ sql }: { sql: string }) {
  const lines = sql.split('\n').length
  const height = Math.min(240, Math.max(32, lines * 19 + 16))

  function beforeMount(monaco: Monaco) {
    monaco.editor.defineTheme('querymind-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '416CFF', fontStyle: 'bold' },
        { token: 'string.sql', foreground: 'C1F46D' },
        { token: 'number.sql', foreground: 'C1F46D' },
        { token: 'comment.sql', foreground: '5A6A75' },
        { token: 'identifier.sql', foreground: 'DCE1E6' },
      ],
      colors: {
        'editor.background': '#0D1015',
        'editor.foreground': '#DCE1E6',
        'editor.lineHighlightBackground': '#0D1015',
        'editorLineNumber.foreground': '#25313B',
        'editorCursor.foreground': '#416CFF',
        'editor.selectionBackground': '#416CFF33',
        'scrollbarSlider.background': '#25313B88',
      },
    })
  }

  return (
    <div className="rounded border border-[#25313B] overflow-hidden" style={{ height }}>
      <Editor
        height={height}
        defaultLanguage="sql"
        value={sql}
        theme="querymind-dark"
        beforeMount={beforeMount}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          fontSize: 13,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          padding: { top: 8, bottom: 8 },
          ariaLabel: 'Generated SQL (read-only)',
        }}
      />
    </div>
  )
}
