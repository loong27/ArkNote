import React, { useState } from 'react'
import { UnlockPage } from './pages/UnlockPage'
import { NotesPage } from './pages/NotesPage'
import { NotePage } from './pages/NotePage'
import { SyncSettingsPage } from './pages/SyncSettingsPage'
import { hasUnlockedVault } from './lib/session'

type Screen =
  | { name: 'unlock' }
  | { name: 'notes' }
  | { name: 'note'; noteId: string; title: string }
  | { name: 'sync'; from: 'unlock' | 'notes' }

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>(
    hasUnlockedVault() ? { name: 'notes' } : { name: 'unlock' },
  )

  if (screen.name === 'sync') {
    return (
      <SyncSettingsPage
        onBack={() => setScreen(screen.from === 'notes' ? { name: 'notes' } : { name: 'unlock' })}
        onSyncLocked={() => setScreen({ name: 'unlock' })}
      />
    )
  }

  if (screen.name === 'unlock') {
    return (
      <UnlockPage
        onUnlocked={() => setScreen({ name: 'notes' })}
        onOpenSync={() => setScreen({ name: 'sync', from: 'unlock' })}
      />
    )
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
      onOpenSync={() => setScreen({ name: 'sync', from: 'notes' })}
    />
  )
}
