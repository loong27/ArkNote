import React from 'react'
import { useStore } from './store/useStore'
import { PasswordDialog } from './components/PasswordDialog'
import { Layout } from './components/Layout'
import { TitleBar } from './components/TitleBar'
import { UpdateNotice } from './components/UpdateNotice'

const App: React.FC = () => {
  const isLocked = useStore(s => s.isLocked)

  return (
    <div className="app-root">
      <TitleBar />
      {isLocked ? <PasswordDialog /> : <Layout />}
      <UpdateNotice />
    </div>
  )
}

export default App
