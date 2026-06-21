'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Profile = {
  id?: string
  client_name: string
  // Business
  industry: string
  location: string
  founded: string
  key_services: string
  service_area: string
  // Q&A — Voice
  one_sentence: string
  tagline: string
  known_for: string
  customer_say: string
  brand_voice: string
  tone_words: string[]
  avoid_words: string[]
  // Q&A — Audience
  target_audience: string
  ideal_customer: string
  customer_problem: string
  // Q&A — Differentiation
  what_makes_different: string
  topics_to_avoid: string
  social_proof: string
  awards: string
  // CTA
  cta_style: string
  cta_phone: string
  cta_website: string
  // Content
  content_pillars: string[]
  extra_context: string
  // Competitor
  competitor_notes: string
  competitor_examples: string
}

const EMPTY: Profile = {
  client_name: '', industry: '', location: '', founded: '', key_services: '', service_area: '',
  one_sentence: '', tagline: '', known_for: '', customer_say: '', brand_voice: '',
  tone_words: [], avoid_words: [],
  target_audience: '', ideal_customer: '', customer_problem: '',
  what_makes_different: '', topics_to_avoid: '', social_proof: '', awards: '',
  cta_style: '', cta_phone: '', cta_website: '',
  content_pillars: [], extra_context: '',
  competitor_notes: '', competitor_examples: '',
}

const PILLARS = ['Story', 'Value', 'Culture', 'Fans', 'Current Events', 'Support', 'Goals']

export default function BrandProfilePage() {
  const params = useParams()
  const clientName = decodeURIComponent(params.client as string)
  const [profile, setProfile] = useState<Profile>({ ...EMPTY, client_name: clientName })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const ink = '#1C1917', muted = '#78716C', rule = '#E7E5E4'

  useEffect(() => { loadProfile() }, [clientName])

  async function loadProfile() {
    setLoading(true)
    const { data } = await supabase
      .from('social_brand_profiles')
      .select('*')
      .eq('client_name', clientName)
      .single()
    if (data) setProfile({ ...EMPTY, ...data })
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const row = { ...profile, updated_at: new Date().toISOString() }
    if (profile.id) {
      await supabase.from('social_brand_profiles').update(row).eq('id', profile.id)
    } else {
      const { data } = await supabase.from('social_brand_profiles').insert(row).select().single()
      if (data) setProfile(p => ({ ...p, id: (data as any).id }))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const u = useCallback((field: keyof Profile, value: any) => setProfile(p => ({ ...p, [field]: value })), [])

  // Q is inlined below to avoid re-mount on state change
  const Q = ({ q, field, placeholder, rows, hint }: {
    q: string; field: keyof Profile; placeholder?: string; rows?: number; hint?: string
  }) => {
    const val = (profile[field] as string) ?? ''
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => u(field, e.target.value)
    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: ink, display: 'block', marginBottom: hint ? 2 : 6 }}>{q}</label>
        {hint && <p style={{ fontSize: 12, color: muted, margin: '0 0 6px' }}>{hint}</p>}
        {rows ? (
          <textarea value={val} onChange={handleChange} placeholder={placeholder} rows={rows}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: `1px solid ${rule}`, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }} />
        ) : (
          <input value={val} onChange={handleChange} placeholder={placeholder}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: `1px solid ${rule}`, fontSize: 13, boxSizing: 'border-box' }} />
        )}
      </div>
    )
  }

  function TagInput({ label, field, placeholder }: { label: string; field: 'tone_words' | 'avoid_words'; placeholder?: string }) {
    const [input, setInput] = useState('')
    const value = (profile[field] as string[]) ?? []

    function add() {
      const t = input.trim()
      if (t && !value.includes(t)) u(field, [...value, t])
      setInput('')
    }

    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: ink, display: 'block', marginBottom: 6 }}>{label}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', borderRadius: 6, border: `1px solid ${rule}`, background: 'white', minHeight: 42, alignItems: 'center' }}>
          {value.map(v => (
            <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, background: '#F5F5F4', fontSize: 12, color: ink }}>
              {v}
              <button onClick={() => u(field, value.filter(x => x !== v))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: muted, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
            onBlur={add}
            placeholder={value.length === 0 ? placeholder : ''}
            style={{ border: 'none', outline: 'none', fontSize: 13, minWidth: 120, flex: 1, padding: '2px' }} />
        </div>
        <p style={{ fontSize: 11, color: muted, margin: '4px 0 0' }}>Press Enter or comma after each word</p>
      </div>
    )
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px', paddingBottom: 10, borderBottom: `2px solid ${rule}`, color: ink }}>{title}</h3>
        {children}
      </section>
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: muted }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', color: ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${rule}`, position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard/social" style={{ color: muted, textDecoration: 'none', fontSize: 13 }}>← Social Hub</Link>
            <span style={{ color: rule }}>/</span>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted }}>Brand Profile</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{clientName}</div>
            </div>
          </div>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: saved ? '#047857' : ink, color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ padding: '14px 18px', background: '#EDF4FB', borderRadius: 8, marginBottom: 32, fontSize: 13, color: '#185FA5' }}>
          ✦ Claude uses this profile to generate captions that sound like {clientName}. Fill in as much as you can — the more context, the better the drafts.
        </div>

        <Section title="Business basics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Q q="Industry / niche" field="industry" placeholder="e.g. Residential & Commercial Roofing" />
            <Q q="Location / Cities served" field="location" placeholder="e.g. Burr Ridge, IL · Hinsdale, IL · Western Springs, IL" rows={2} />
            <Q q="Service area" field="service_area" placeholder="e.g. Will County and surrounding suburbs" />
            <Q q="Founded" field="founded" placeholder="e.g. 2012" />
          </div>
          <Q q="Key services (list them)" field="key_services" placeholder="e.g. Roofing, siding, gutters, windows, gutter guards" />
        </Section>

        <Section title="Brand voice Q&A">
          <Q q="How would you describe this business in one sentence?" field="one_sentence"
            placeholder="e.g. A veteran-owned roofing company serving the south suburbs with honest work and real accountability." />
          <Q q="What's the tagline or slogan (if any)?" field="tagline"
            placeholder="e.g. Quality you can count on" />
          <Q q="What is this business known for in their area?" field="known_for"
            hint="Think reputation, not services. What do people say when they refer them?"
            placeholder="e.g. Always showing up on time. Clean job sites. The owner is on every job." rows={2} />
          <Q q="What do their best customers say about them?" field="customer_say"
            hint="Think Google reviews, testimonials, word-of-mouth phrases."
            placeholder="e.g. 'They came back to fix a small issue months later, no charge.' 'Best communication I've had with a contractor.'" rows={3} />
          <Q q="Describe the brand voice" field="brand_voice"
            hint="How should captions sound? Formal or casual? Technical or simple? Bold or understated?"
            placeholder="e.g. Confident but not arrogant. Speaks to contractors as peers. Educational without being preachy." rows={3} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TagInput label="Words that fit this brand's tone" field="tone_words" placeholder="trustworthy, local, quality…" />
            <TagInput label="Words / phrases to NEVER use" field="avoid_words" placeholder="cheap, deal, best price…" />
          </div>
        </Section>

        <Section title="Audience Q&A">
          <Q q="Who is the target audience?" field="target_audience"
            placeholder="e.g. Homeowners aged 35-60 in Will County who own their home and take pride in it" />
          <Q q="Describe the ideal customer" field="ideal_customer"
            placeholder="e.g. A homeowner who researches before hiring, values quality over price, and wants someone they can trust to not cut corners" rows={2} />
          <Q q="What problem are they trying to solve?" field="customer_problem"
            placeholder="e.g. Their roof is leaking or showing wear. They've been burned by a bad contractor before and are nervous about hiring again." rows={2} />
        </Section>

        <Section title="Differentiation Q&A">
          <Q q="What makes this business different from competitors?" field="what_makes_different"
            hint="Be specific. Not just 'quality work' — what actually sets them apart?"
            placeholder="e.g. Veteran-owned. Owner on every job. No subcontractors. 5-year workmanship warranty beyond manufacturer." rows={3} />
          <Q q="Social proof (reviews, certifications, awards)" field="social_proof"
            placeholder="e.g. 4.9 stars on Google with 200+ reviews. GAF Master Elite certified. 2023 Angi Super Service Award." rows={2} />
          <Q q="Awards or recognition" field="awards"
            placeholder="e.g. Best of Houzz 2024. BBB Accredited. Local Chamber of Commerce member." />
          <Q q="Topics or content areas to avoid" field="topics_to_avoid"
            placeholder="e.g. Never mention specific pricing. Avoid competitor comparisons. No political content." rows={2} />
        </Section>

        <Section title="Call to action">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Q q="Preferred CTA" field="cta_style" placeholder="e.g. Call for a free estimate" />
            <Q q="Phone number" field="cta_phone" placeholder="e.g. (708) 555-1234" />
            <Q q="Website" field="cta_website" placeholder="e.g. example.com" />
          </div>
        </Section>

        <Section title="Content pillars">
          <p style={{ fontSize: 13, color: muted, margin: '0 0 12px' }}>Which content pillars apply to this client?</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PILLARS.map(p => {
              const active = (profile.content_pillars ?? []).includes(p)
              return (
                <button key={p} onClick={() => u('content_pillars', active
                  ? profile.content_pillars.filter(x => x !== p)
                  : [...(profile.content_pillars ?? []), p])}
                  style={{
                    padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${active ? ink : rule}`,
                    background: active ? ink : 'white', color: active ? 'white' : muted,
                  }}>{p}</button>
              )
            })}
          </div>
        </Section>

        <Section title="Competitor reference">
          <Q q="Who are the main competitors and how is this client different?" field="competitor_notes"
            placeholder="e.g. Main competitors: ABC Roofing, XYZ Exteriors. They run heavy discount promotions. We differentiate on quality and accountability, not price." rows={3} />
          <Q q="Paste competitor social media posts here (for Claude to use as contrast/inspiration)" field="competitor_examples"
            hint="Claude will NOT copy these — it uses them to understand what to do differently."
            placeholder="Paste 1-3 real competitor posts here…" rows={6} />
        </Section>

        <Section title="Extra context">
          <Q q="Anything else Claude should know about this client?" field="extra_context"
            hint="Recent news, upcoming launches, seasonal focus, owner personality, anything that would help write better captions."
            placeholder="e.g. The owner just got back from a roofing trade show. They're launching a new gutter guard product in August. The owner's name is Mike and he likes being mentioned." rows={4} />
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, borderTop: `1px solid ${rule}` }}>
          <button onClick={save} disabled={saving}
            style={{ padding: '10px 28px', borderRadius: 6, border: 'none', background: saved ? '#047857' : ink, color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
          </button>
        </div>
      </main>
    </div>
  )
}
