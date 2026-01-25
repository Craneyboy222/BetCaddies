import React from 'react'
import { Button } from '@/components/ui/button'

const defaultToArray = (value) => (Array.isArray(value) ? value : [])

const renderHero = (data = {}) => (
  <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8">
    {data.eyebrow && <div className="text-xs uppercase tracking-wide text-emerald-400 mb-2">{data.eyebrow}</div>}
    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{data.title || 'Untitled Hero'}</h1>
    {data.subtitle && <p className="text-slate-400 text-lg max-w-3xl">{data.subtitle}</p>}
    {data.imageUrl && (
      <div className="mt-6 rounded-xl overflow-hidden border border-slate-800/60">
        <img src={data.imageUrl} alt={data.title || 'Hero'} className="w-full h-auto" />
      </div>
    )}
    {data.ctaText && data.ctaUrl && (
      <div className="mt-6">
        <Button className="bg-emerald-500 hover:bg-emerald-600" asChild>
          <a href={data.ctaUrl}>{data.ctaText}</a>
        </Button>
      </div>
    )}
  </section>
)

const renderBanner = (data = {}) => {
  const tone = data.tone || 'info'
  const toneMap = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  }
  const content = data.imageUrl ? (
    <div className="w-full">
      <img
        src={data.imageUrl}
        alt={data.imageAlt || 'Banner'}
        className="w-full h-auto rounded-lg"
      />
    </div>
  ) : (
    <div className="flex items-center justify-between gap-4">
      <span>{data.text || 'Banner text'}</span>
      {data.url && (
        <span className="text-xs underline">Learn more</span>
      )}
    </div>
  )

  return data.url ? (
    <a href={data.url} className={`block border rounded-xl p-4 ${toneMap[tone] || toneMap.info}`}>
      {content}
    </a>
  ) : (
    <section className={`border rounded-xl p-4 ${toneMap[tone] || toneMap.info}`}>
      {content}
    </section>
  )
}

const renderText = (data = {}) => (
  <section className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6">
    {data.title && <h2 className="text-2xl font-bold text-white mb-3">{data.title}</h2>}
    {data.body && <p className="text-slate-300 leading-relaxed whitespace-pre-line">{data.body}</p>}
  </section>
)

const renderImage = (data = {}) => (
  <section className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6">
    {data.url ? (
      <div className="space-y-3">
        <img src={data.url} alt={data.alt || 'Image'} className="w-full h-auto rounded-xl" />
        {data.caption && <p className="text-sm text-slate-400">{data.caption}</p>}
      </div>
    ) : (
      <p className="text-slate-400">Image URL not set.</p>
    )}
  </section>
)

const renderCta = (data = {}) => (
  <section className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-8">
    {data.title && <h2 className="text-2xl font-bold text-white mb-2">{data.title}</h2>}
    {data.text && <p className="text-slate-300 mb-4">{data.text}</p>}
    {data.buttonText && data.buttonUrl && (
      <Button className="bg-emerald-500 hover:bg-emerald-600" asChild>
        <a href={data.buttonUrl}>{data.buttonText}</a>
      </Button>
    )}
  </section>
)

const renderFeatureGrid = (data = {}) => {
  const items = defaultToArray(data.items)
  return (
    <section className="space-y-4">
      {data.title && <h2 className="text-2xl font-bold text-white">{data.title}</h2>}
      <div className="grid md:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="text-slate-400">No features yet.</div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="font-semibold text-white mb-1">{item.title || item.name || 'Feature'}</div>
              <div className="text-sm text-slate-400">{item.body || item.description || ''}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

const renderFaq = (data = {}) => {
  const items = defaultToArray(data.items)
  return (
    <section className="space-y-4">
      {data.title && <h2 className="text-2xl font-bold text-white">{data.title}</h2>}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-slate-400">No FAQs yet.</div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
              <div className="font-medium text-white">{item.q || item.question || 'Question'}</div>
              <div className="text-sm text-slate-400 mt-2">{item.a || item.answer || ''}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

const renderForm = (data = {}) => (
  <section className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 space-y-4">
    {data.title && <h2 className="text-2xl font-bold text-white">{data.title}</h2>}
    {data.subtitle && <p className="text-slate-400">{data.subtitle}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" placeholder="Name" />
      <input className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" placeholder="Email" />
    </div>
    <Button className="bg-emerald-500 hover:bg-emerald-600">{data.buttonText || 'Submit'}</Button>
    {data.disclaimer && <p className="text-xs text-slate-500">{data.disclaimer}</p>}
  </section>
)

const BLOCK_RENDERERS = {
  hero: renderHero,
  banner: renderBanner,
  text: renderText,
  image: renderImage,
  cta: renderCta,
  feature_grid: renderFeatureGrid,
  faq: renderFaq,
  form: renderForm
}

export default function CmsBlocks({ blocks, includeTypes, excludeTypes } = {}) {
  const normalized = defaultToArray(blocks).filter((block) => {
    if (!block || !block.type) return false
    if (includeTypes && !includeTypes.includes(block.type)) return false
    if (excludeTypes && excludeTypes.includes(block.type)) return false
    return true
  })

  if (normalized.length === 0) return null

  return (
    <div className="space-y-10">
      {normalized.map((block, idx) => {
        const renderer = BLOCK_RENDERERS[block.type]
        if (!renderer) return null
        return (
          <div key={`${block.type}-${idx}`}>
            {renderer(block.data || {})}
          </div>
        )
      })}
    </div>
  )
}
