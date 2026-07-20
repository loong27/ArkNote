import React from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchBar: React.FC<Props> = ({ value, onChange, placeholder }) => {
  const { t } = useI18n()
  return (
    <div className="search-bar">
      <div className="search-wrapper">
        <Search size={14} strokeWidth={1.5} className="search-icon" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t('搜索...')}
        />
      </div>
    </div>
  )
}
