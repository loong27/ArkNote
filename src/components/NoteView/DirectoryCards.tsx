import React, { useMemo } from 'react'
import { FileText, Folder } from 'lucide-react'
import { format } from 'date-fns'
import { useStore } from '../../store/useStore'
import type { Directory, NoteMetadata } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

const MAX_VISIBLE_TAGS = 3

type FolderEntryCardProps = {
  dir: Directory
  noteCount: number
  onOpen: (dir: Directory) => void
}

export const FolderEntryCard: React.FC<FolderEntryCardProps> = ({
  dir,
  noteCount,
  onOpen,
}) => {
  const { t } = useI18n()

  return (
    <button
      type="button"
      className="directory-card directory-card--folder"
      onClick={() => onOpen(dir)}
    >
      <div className="card-icon" aria-hidden="true">
        <Folder size={22} strokeWidth={1.5} />
      </div>
      <div className="card-info">
        <div className="card-title">{dir.name}</div>
        <div className="card-meta">{t('{count} 篇笔记', { count: noteCount })}</div>
      </div>
    </button>
  )
}

type NoteEntryCardProps = {
  note: NoteMetadata
  onOpen: (noteId: string) => void
}

export const NoteEntryCard: React.FC<NoteEntryCardProps> = ({ note, onOpen }) => {
  const tags = useStore(s => s.tags)

  const visibleTags = useMemo(() => {
    const byId = new Map(tags.map(tag => [tag.id, tag]))
    return note.tags
      .map(id => byId.get(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .slice(0, MAX_VISIBLE_TAGS)
  }, [note.tags, tags])

  const extraTagCount = Math.max(0, note.tags.length - visibleTags.length)

  return (
    <button
      type="button"
      className="directory-card directory-card--note"
      onClick={() => onOpen(note.id)}
    >
      <div className="card-icon" aria-hidden="true">
        <FileText size={18} strokeWidth={1.5} />
      </div>
      <div className="card-info">
        <div className="card-title">{note.title}</div>
        {visibleTags.length > 0 && (
          <div className="card-tags">
            {visibleTags.map(tag => (
              <span key={tag.id} className="card-tag" title={tag.name}>
                <span
                  className="card-tag-dot"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
                <span className="card-tag-name">{tag.name}</span>
              </span>
            ))}
            {extraTagCount > 0 && (
              <span className="card-tag card-tag--more">+{extraTagCount}</span>
            )}
          </div>
        )}
        <div className="card-meta">
          {format(new Date(note.updatedAt), 'yyyy-MM-dd HH:mm')}
        </div>
      </div>
    </button>
  )
}
