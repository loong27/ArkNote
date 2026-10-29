import React, { useState } from 'react'
import { UnlockPage } from './pages/UnlockPage'
import { NotesPage } from './pages/NotesPage'
import { NotePage } from './pages/NotePage'
import { hasUnlockedVault } from './lib/session'

type Screen =
  | { name: 'unlock' }
  | { name: 'notes' }
  | { name: 'note'; noteId: string; title: string }

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>(
    hasUnlockedVault() ? { name: 'notes' } : { name: 'unlock' },
  )

  if (screen.name === 'unlock') {
    return <UnlockPage onUnlocked={() => setScreen({ name: 'notes' })} />
  }

  if (screen.name === 'note') {
    return (
      <NotePage
        noteId={screen.noteId}
        title={screen.title}
        onBack={() => setScreen({ name: 'notes' })}
      />
    )
  }

  return (
    <NotesPage
      onOpenNote={(noteId, title) => setScreen({ name: 'note', noteId, title })}
      onLock={() => setScreen({ name: 'unlock' })}
    />
  )
}
