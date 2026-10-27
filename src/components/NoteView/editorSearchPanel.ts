import { StateEffect } from '@codemirror/state'
import { EditorView, Panel, runScopeHandlers, ViewUpdate } from '@codemirror/view'
import type { Command } from '@codemirror/view'
import {
  SearchQuery,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  selectMatches,
  replaceNext,
  replaceAll,
  closeSearchPanel,
  openSearchPanel,
} from '@codemirror/search'

const expandReplaceEffect = StateEffect.define<boolean>()

/** Open search panel with the replace row expanded (Ctrl/Cmd+H). */
export const openReplacePanel: Command = (view) => {
  openSearchPanel(view)
  view.dispatch({ effects: expandReplaceEffect.of(true) })
  return true
}

function phrase(view: EditorView, key: string): string {
  return view.state.phrase(key)
}

function elt<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void) | null | undefined> | null,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue
      if (typeof value === 'function') {
        ;(e as unknown as Record<string, unknown>)[name] = value
      } else if (value === true) {
        e.setAttribute(name, '')
      } else {
        e.setAttribute(name, value)
      }
    }
  }
  for (const child of children) {
    e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return e
}

function countMatches(view: EditorView): { total: number; current: number } {
  const query = getSearchQuery(view.state)
  if (!query.valid) return { total: 0, current: 0 }

  const cursor = query.getCursor(view.state)
  const ranges: { from: number; to: number }[] = []
  const max = 9999
  while (ranges.length < max) {
    const next = cursor.next()
    if (next.done) break
    ranges.push(next.value)
  }

  const total = ranges.length
  if (total === 0) return { total: 0, current: 0 }

  const { from, to } = view.state.selection.main
  let current = 0
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i].from === from && ranges[i].to === to) {
      current = i + 1
      break
    }
    if (ranges[i].from >= from) {
      current = i + 1
      break
    }
  }
  if (current === 0) current = 1
  return { total, current }
}

class EditorSearchPanel implements Panel {
  dom: HTMLElement
  private view: EditorView
  private searchField: HTMLInputElement
  private replaceField: HTMLInputElement
  private countEl: HTMLElement
  private replaceRow: HTMLElement
  private toggleReplaceBtn: HTMLButtonElement
  private caseBtn: HTMLButtonElement
  private reBtn: HTMLButtonElement
  private wordBtn: HTMLButtonElement
  private query: SearchQuery
  private replaceExpanded: boolean
  private commit: () => void

  constructor(view: EditorView) {
    this.view = view
    this.query = getSearchQuery(view.state)
    this.replaceExpanded = false
    this.commit = this.commitQuery.bind(this)

    this.searchField = elt('input', {
      type: 'text',
      value: this.query.search,
      placeholder: phrase(view, 'Find'),
      'aria-label': phrase(view, 'Find'),
      class: 'yn-search-input',
      name: 'search',
      form: '',
      'main-field': 'true',
      onchange: this.commit,
      onkeyup: this.commit,
    }) as HTMLInputElement

    this.replaceField = elt('input', {
      type: 'text',
      value: this.query.replace,
      placeholder: phrase(view, 'Replace'),
      'aria-label': phrase(view, 'Replace'),
      class: 'yn-search-input',
      name: 'replace',
      form: '',
      onchange: this.commit,
      onkeyup: this.commit,
    }) as HTMLInputElement

    this.countEl = elt('span', { class: 'yn-search-count' }, '')

    this.caseBtn = this.optionButton('Aa', phrase(view, 'match case'), this.query.caseSensitive)
    this.reBtn = this.optionButton('.*', phrase(view, 'regexp'), this.query.regexp)
    this.wordBtn = this.optionButton('W', phrase(view, 'by word'), this.query.wholeWord)

    this.caseBtn.onclick = () => {
      this.caseBtn.classList.toggle('active')
      this.commit()
    }
    this.reBtn.onclick = () => {
      this.reBtn.classList.toggle('active')
      this.commit()
    }
    this.wordBtn.onclick = () => {
      this.wordBtn.classList.toggle('active')
      this.commit()
    }

    const prevBtn = this.iconButton('↑', phrase(view, 'previous'), () => findPrevious(view))
    const nextBtn = this.iconButton('↓', phrase(view, 'next'), () => findNext(view))
    const allBtn = this.iconButton('☰', phrase(view, 'all'), () => selectMatches(view))

    this.toggleReplaceBtn = this.iconButton(
      '⇄',
      this.replaceExpanded ? phrase(view, 'collapse replace') : phrase(view, 'expand replace'),
      () => this.setReplaceExpanded(!this.replaceExpanded),
    )
    this.toggleReplaceBtn.classList.toggle('active', this.replaceExpanded)

    const closeBtn = elt('button', {
      type: 'button',
      class: 'yn-search-btn yn-search-close',
      name: 'close',
      'aria-label': phrase(view, 'close'),
      title: phrase(view, 'close'),
      onclick: () => closeSearchPanel(view),
    }, '×') as HTMLButtonElement

    const findRow = elt('div', { class: 'yn-search-row' },
      this.searchField,
      this.countEl,
      elt('div', { class: 'yn-search-actions' },
        prevBtn,
        nextBtn,
        allBtn,
      ),
      elt('div', { class: 'yn-search-options' },
        this.caseBtn,
        this.reBtn,
        this.wordBtn,
      ),
      this.toggleReplaceBtn,
      closeBtn,
    )

    const replaceBtn = elt('button', {
      type: 'button',
      class: 'yn-search-text-btn',
      name: 'replace',
      onclick: () => replaceNext(view),
    }, phrase(view, 'replace')) as HTMLButtonElement

    const replaceAllBtn = elt('button', {
      type: 'button',
      class: 'yn-search-text-btn',
      name: 'replaceAll',
      onclick: () => replaceAll(view),
    }, phrase(view, 'replace all')) as HTMLButtonElement

    this.replaceRow = elt('div', { class: 'yn-search-row yn-search-replace-row' },
      this.replaceField,
      elt('div', { class: 'yn-search-actions' },
        replaceBtn,
        replaceAllBtn,
      ),
    )
    if (view.state.readOnly) {
      this.replaceRow.style.display = 'none'
      this.toggleReplaceBtn.style.display = 'none'
    } else {
      this.replaceRow.hidden = !this.replaceExpanded
    }

    this.dom = elt('div', {
      class: 'cm-search yn-search-panel',
      onkeydown: (e: Event) => this.keydown(e as KeyboardEvent),
    }, findRow, this.replaceRow)

    this.refreshCount()
  }

  private optionButton(label: string, title: string, active: boolean): HTMLButtonElement {
    return elt('button', {
      type: 'button',
      class: `yn-search-btn yn-search-option${active ? ' active' : ''}`,
      title,
      'aria-label': title,
      'aria-pressed': active ? 'true' : 'false',
    }, label) as HTMLButtonElement
  }

  private iconButton(label: string, title: string, onclick: () => void): HTMLButtonElement {
    return elt('button', {
      type: 'button',
      class: 'yn-search-btn',
      title,
      'aria-label': title,
      onclick: () => onclick(),
    }, label) as HTMLButtonElement
  }

  private setReplaceExpanded(expanded: boolean) {
    this.replaceExpanded = expanded
    this.replaceRow.hidden = !expanded
    this.toggleReplaceBtn.classList.toggle('active', expanded)
    this.toggleReplaceBtn.title = expanded
      ? phrase(this.view, 'collapse replace')
      : phrase(this.view, 'expand replace')
    this.toggleReplaceBtn.setAttribute('aria-label', this.toggleReplaceBtn.title)
    if (expanded) {
      this.replaceField.focus()
      this.replaceField.select()
    }
  }

  private commitQuery() {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseBtn.classList.contains('active'),
      regexp: this.reBtn.classList.contains('active'),
      wholeWord: this.wordBtn.classList.contains('active'),
      replace: this.replaceField.value,
    })
    if (!query.eq(this.query)) {
      this.query = query
      this.view.dispatch({ effects: setSearchQuery.of(query) })
    }
    this.refreshCount()
  }

  private refreshCount() {
    const { total, current } = countMatches(this.view)
    if (!this.searchField.value) {
      this.countEl.textContent = ''
      this.countEl.classList.remove('empty')
    } else if (total === 0) {
      this.countEl.textContent = '0'
      this.countEl.classList.add('empty')
    } else {
      this.countEl.textContent = `${current} / ${total}`
      this.countEl.classList.remove('empty')
    }

    this.caseBtn.setAttribute('aria-pressed', this.caseBtn.classList.contains('active') ? 'true' : 'false')
    this.reBtn.setAttribute('aria-pressed', this.reBtn.classList.contains('active') ? 'true' : 'false')
    this.wordBtn.setAttribute('aria-pressed', this.wordBtn.classList.contains('active') ? 'true' : 'false')
  }

  private keydown(e: KeyboardEvent) {
    if (runScopeHandlers(this.view, e, 'search-panel')) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && e.target === this.searchField) {
      e.preventDefault()
      ;(e.shiftKey ? findPrevious : findNext)(this.view)
    } else if (e.key === 'Enter' && e.target === this.replaceField) {
      e.preventDefault()
      replaceNext(this.view)
    }
  }

  private setQuery(query: SearchQuery) {
    this.query = query
    this.searchField.value = query.search
    this.replaceField.value = query.replace
    this.caseBtn.classList.toggle('active', query.caseSensitive)
    this.reBtn.classList.toggle('active', query.regexp)
    this.wordBtn.classList.toggle('active', query.wholeWord)
    this.refreshCount()
  }

  mount() {
    this.searchField.select()
  }

  update(update: ViewUpdate) {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(expandReplaceEffect) && effect.value) {
          this.setReplaceExpanded(true)
        }
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value)
        }
      }
    }
    if (update.docChanged || update.selectionSet || update.transactions.some(tr =>
      tr.effects.some(e => e.is(setSearchQuery))
    )) {
      this.refreshCount()
    }
  }

  get top() {
    return false
  }
}

export function createEditorSearchPanel(view: EditorView): Panel {
  return new EditorSearchPanel(view)
}

/** Phrase map for CodeMirror search UI (English keys → localized values). */
export function editorSearchPhrases(t: (source: string) => string): Record<string, string> {
  return {
    Find: t('查找'),
    Replace: t('替换'),
    next: t('下一个'),
    previous: t('上一个'),
    all: t('全选匹配'),
    'match case': t('区分大小写'),
    regexp: t('正则表达式'),
    'by word': t('全词匹配'),
    replace: t('替换'),
    'replace all': t('替换全部'),
    close: t('关闭'),
    'expand replace': t('展开替换'),
    'collapse replace': t('收起替换'),
    'current match': t('当前匹配'),
    'on line': t('位于行'),
    'replaced match on line $': t('已替换第 $ 行的匹配'),
    'replaced $ matches': t('已替换 $ 处匹配'),
  }
}
