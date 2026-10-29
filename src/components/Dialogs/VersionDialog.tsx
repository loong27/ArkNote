import React, { useState } from 'react'
import { X, History, Clock, Save, GitCompare } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'

export const VersionDialog: React.FC = () => {
  const { t } = useI18n()
  const {
    versionDialogOpen,
    versionNoteId,
    closeVersionDialog,
    versions,
    isTrashNote,
    flushPendingSaves,
    openNoteWithoutFlush,
  } = useStore()

  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  const [activeTimestamp, setActiveTimestamp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [mode, setMode] = useState<'preview' | 'diff'>('preview')

  const handlePreview = async (timestamp: string) => {
    if (!versionNoteId) return
    setLoading(true)
    setActiveTimestamp(timestamp)
    setMode('preview')
    setDiffContent(null)
    try {
      const content = isTrashNote
        ? await window.electronAPI.trash.getVersion(versionNoteId, timestamp)
        : await window.electronAPI.versions.get(versionNoteId, timestamp)
      setPreviewContent(content)
    } catch (error) {
      console.error('Failed to load version:', error)
    }
    setLoading(false)
  }

  const handleDiff = async (timestamp: string) => {
    if (!versionNoteId || isTrashNote) return
    setLoading(true)
    setActiveTimestamp(timestamp)
    setMode('diff')
    try {
      const result = await window.electronAPI.versions.diff(versionNoteId, timestamp)
      setDiffContent(result.unified)
      setPreviewContent(result.version)
    } catch (error) {
      console.error('Failed to diff version:', error)
    }
    setLoading(false)
  }

  const handleRestore = async () => {
    if (!versionNoteId || !previewContent) return

    setRestoring(true)
    try {
      if (!(await flushPendingSaves())) {
        return
      }
      await window.electronAPI.notes.update(versionNoteId, previewContent)
      await openNoteWithoutFlush(versionNoteId, true)
      closeVersionDialog()
    } catch (error) {
      console.error('Failed to restore version:', error)
    } finally {
      setRestoring(false)
    }
  }

  const formatTimestamp = (ts: string): string => {
    try {
      const parts = ts.split(/[-T]/)
      if (parts.length >= 6) {
        return `${parts[0]}-${parts[1]}-${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}`
      }
      return ts
    } catch {
      return ts
    }
  }

  if (!versionDialogOpen) return null

  const panelContent = mode === 'diff' ? diffContent : previewContent

  return (
    <div className="dialog-overlay" onClick={closeVersionDialog}>
      <div
        className="dialog"
        style={{ width: panelContent ? '860px' : '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h3>
            <History size={18} strokeWidth={1.5} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {t('历史版本')}
          </h3>
          <button className="icon-btn" onClick={() => {
            setPreviewContent(null)
            setDiffContent(null)
            closeVersionDialog()
          }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="dialog-body" style={{ display: 'flex', gap: 16, minHeight: 300 }}>
          <div style={{
            width: panelContent ? '38%' : '100%',
            overflowY: 'auto',
            borderRight: panelContent ? '1px solid var(--border)' : 'none',
            paddingRight: panelContent ? 16 : 0,
          }}>
            {versions.length === 0 ? (
              <div className="empty-state">
                <Clock size={32} strokeWidth={1.5} />
                <p>{t('暂无历史版本')}</p>
                <p style={{ fontSize: '12px' }}>
                  {t('使用 Ctrl+S 手动保存版本，或等待自动保存')}
                </p>
              </div>
            ) : (
              <div className="version-list">
                {versions.map((version) => (
                  <div
                    key={version.timestamp}
                    className="version-item"
                    style={{ outline: activeTimestamp === version.timestamp ? '1px solid var(--accent)' : undefined }}
                  >
                    <div className="version-info" onClick={() => handlePreview(version.timestamp)} style={{ cursor: 'pointer', flex: 1 }}>
                      <div className="version-time">
                        {formatTimestamp(version.timestamp)}
                      </div>
                      <div className="version-type">
                        {version.title}
                      </div>
                    </div>
                    <span className={`version-badge ${version.isManual ? 'manual' : ''}`}>
                      {version.isManual ? t('手动保存') : t('自动保存')}
                    </span>
                    {!isTrashNote && (
                      <button
                        className="icon-btn sm"
                        title={t('对比差异')}
                        onClick={() => void handleDiff(version.timestamp)}
                      >
                        <GitCompare size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {panelContent !== null && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: 8,
                fontWeight: 600,
                display: 'flex',
                gap: 8,
              }}>
                <button className={`btn btn-sm ${mode === 'preview' ? 'btn-primary' : ''}`} onClick={() => setMode('preview')}>
                  {t('版本预览')}
                </button>
                {!isTrashNote && (
                  <button className={`btn btn-sm ${mode === 'diff' ? 'btn-primary' : ''}`} onClick={() => activeTimestamp && void handleDiff(activeTimestamp)}>
                    {t('差异对比')}
                  </button>
                )}
              </div>
              <pre style={{
                background: 'var(--bg-primary)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-secondary)',
                maxHeight: '400px',
                overflow: 'auto',
              }}>
                {loading ? t('加载中...') : panelContent}
              </pre>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={() => {
            setPreviewContent(null)
            setDiffContent(null)
            closeVersionDialog()
          }}>
            {t('关闭')}
          </button>
          {previewContent !== null && !isTrashNote && (
            <button
              className="btn btn-primary"
              onClick={handleRestore}
              disabled={restoring}
            >
              <Save size={14} strokeWidth={1.5} />
              {restoring ? t('恢复中...') : t('恢复此版本')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
