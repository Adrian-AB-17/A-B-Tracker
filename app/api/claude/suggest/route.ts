import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { client_name, pillar, content_type, topic, month, competitor_post } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No ANTHROPIC_API_KEY' }, { status: 500 })

  // 1. Brand profile
  const { data: bp } = await supabase
    .from('social_brand_profiles')
    .select('*')
    .eq('client_name', client_name)
    .single()

  // 2. Top posts (last 90 days, best performing)
  const { data: topPosts } = await supabase
    .from('sprout_posts')
    .select('text_content, engagements, post_type')
    .eq('client_name', client_name)
    .not('text_content', 'is', null)
    .gte('published_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('engagements', { ascending: false })
    .limit(5)

  // 3. Zero-engagement posts (what NOT to do)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: zeroEngPosts } = await supabase
    .from('sprout_posts')
    .select('text_content, post_type, engagements, impressions')
    .eq('client_name', client_name)
    .not('text_content', 'is', null)
    .gte('published_at', ninetyDaysAgo)
    .eq('engagements', 0)
    .gt('impressions', 50)
    .order('impressions', { ascending: false })
    .limit(5)

  // 4. Post type performance breakdown
  const { data: allRecentPosts } = await supabase
    .from('sprout_posts')
    .select('post_type, engagements')
    .eq('client_name', client_name)
    .gte('published_at', ninetyDaysAgo)

  const typePerf: Record<string, { total: number; sum: number; zeros: number }> = {}
  for (const p of allRecentPosts ?? []) {
    const t = p.post_type ?? 'unknown'
    if (!typePerf[t]) typePerf[t] = { total: 0, sum: 0, zeros: 0 }
    typePerf[t].total++
    typePerf[t].sum += p.engagements ?? 0
    if ((p.engagements ?? 0) === 0) typePerf[t].zeros++
  }
  const typePerfLines = Object.entries(typePerf)
    .map(([type, d]) => `${type}: avg ${(d.sum / d.total).toFixed(1)} eng, ${d.zeros}/${d.total} zero-eng`)
    .sort((a, b) => {
      const avgA = typePerf[a.split(':')[0]]?.sum / typePerf[a.split(':')[0]]?.total || 0
      const avgB = typePerf[b.split(':')[0]]?.sum / typePerf[b.split(':')[0]]?.total || 0
      return avgB - avgA
    })

  // Approved library captions for same pillar
  const { data: libCaps } = await supabase
    .from('social_captions')
    .select('caption_text, topic')
    .eq('client_name', client_name)
    .eq('pillar', pillar)
    .limit(3)

  const brandSection = bp ? `
BRAND PROFILE FOR ${client_name.toUpperCase()}:
- Industry: ${bp.industry ?? ''}
- Location: ${bp.location ?? ''} | Service area: ${bp.service_area ?? ''}
- In one sentence: ${bp.one_sentence ?? ''}
- Tagline: ${bp.tagline ?? ''}
- Known for: ${bp.known_for ?? ''}
- What customers say: ${bp.customer_say ?? ''}
- Brand voice: ${bp.brand_voice ?? 'Professional and direct'}
- Tone words: ${bp.tone_words?.join(', ') ?? ''}
- NEVER use these words: ${bp.avoid_words?.join(', ') ?? ''}
- Target audience: ${bp.target_audience ?? ''}
- Ideal customer: ${bp.ideal_customer ?? ''}
- Customer problem: ${bp.customer_problem ?? ''}
- What makes them different: ${bp.what_makes_different ?? ''}
- Social proof: ${bp.social_proof ?? ''}
- Awards: ${bp.awards ?? ''}
- Topics to avoid: ${bp.topics_to_avoid ?? ''}
- CTA style: ${bp.cta_style ?? 'Contact us'}
- Phone: ${bp.cta_phone ?? ''}
- Website: ${bp.cta_website ?? ''}
- Extra context: ${bp.extra_context ?? ''}` : `Client: ${client_name}. No brand profile set up yet.`

  const topPostsSection = topPosts?.length ? `
TOP PERFORMING POSTS (highest engagement — mirror this voice and style):
${topPosts.map((p, i) => `${i+1}. [${p.engagements} eng | ${p.post_type}]\n${p.text_content}`).join('\n\n')}` : ''

  const zeroEngSection = zeroEngPosts?.length ? `
ZERO-ENGAGEMENT POSTS — THESE FAILED (got impressions but zero reactions — avoid this style, tone, and approach entirely):
${zeroEngPosts.map((p, i) => `${i+1}. [0 eng | ${p.impressions} impressions | ${p.post_type}]\n${p.text_content}`).join('\n\n')}` : ''

  const typeSection = typePerfLines.length ? `
POST TYPE PERFORMANCE (best to worst avg engagement):
${typePerfLines.join('\n')}` : ''

  const libSection = libCaps?.length ? `
APPROVED CAPTIONS FROM LIBRARY (same pillar — match this voice closely):
${libCaps.map(c => `- ${c.caption_text}`).join('\n\n')}` : ''

  const competitorSection = (competitor_post || bp?.competitor_examples) ? `
COMPETITOR REFERENCE (do NOT copy — use as contrast/inspiration):
${competitor_post || bp?.competitor_examples}` : ''

  const prompt = `You are Emily, writing a social media caption for ${client_name}.

${brandSection}
${topPostsSection}
${zeroEngSection}
${typeSection}
${libSection}
${competitorSection}

POST TO WRITE:
- Type: ${content_type}
- Content pillar: ${pillar}
- Topic: ${topic || `general ${pillar} content for ${client_name}`}
- Month: ${month}

WRITING RULES:
1. Sound like this specific client — use their voice, not generic marketing
2. Posts: 2-4 sentences. Videos: 1-2 lines max. Re-posts: 1 intro sentence + [LINK] placeholder
3. Max 3-4 hashtags — no hashtag stacks
4. No generic filler phrases: "Let us know", "Check us out", "Don't miss out", "We're excited to"
5. Never use any words from the avoid list
6. End with the CTA naturally if appropriate
7. Sound like a real person wrote this
8. NEVER replicate the tone, structure, or approach of the zero-engagement posts listed above — those failed for this audience

Return ONLY: caption text, then a blank line, then "HASHTAGS:" followed by the hashtags on the same line.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const parts = text.split('HASHTAGS:')

  return NextResponse.json({
    caption: parts[0].trim(),
    hashtags: parts[1]?.trim() ?? '',
  })
}
