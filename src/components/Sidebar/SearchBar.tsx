import React from 'react'
import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchBar: React.FC<Props> = ({ value, onChange, placeholder = '搜索...' }) => {
  return (
    <div className="search-bar">
      <div className="search-wrapper">
        <Search size={14} strokeWidth={1.5} className="search-icon" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
