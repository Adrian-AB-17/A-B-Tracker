import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLATFORM_SPECS: Record<string, string> = {
  google_search: `
GOOGLE SEARCH ADS SPECS:
- RSA: 15 headlines (max 30 chars each, include keyword in at least 5), 4 descriptions (max 90 chars each)
- URL paths: 2 paths (max 15 chars each), no spaces
- Ad groups: 1 theme per group, 15-20 tightly related keywords each
- Match types: Exact [keyword], Phrase "keyword", Broad keyword, Negative -keyword
- Pin headlines: Pin H1 = brand/main service, Pin H2 = key differentiator
- Quality Score factors: keyword relevance, ad relevance, landing page experience`,

  google_display: `
GOOGLE DISPLAY ADS SPECS:
- Responsive Display Ad: 5 short headlines (30 chars), 1 long headline (90 chars), 5 descriptions (90 chars)
- Audiences: In-market segments, Custom intent, Affinity, Remarketing, Similar audiences
- Placements: Contextual (content match), Managed placements (specific sites)
- Bidding: Target CPA, Target ROAS, or Maximize conversions`,

  meta: `
META ADS SPECS:
- Primary text: 125 chars optimal (up to 500), first 125 chars shown without "See more"
- Headline: 27 chars (shown in feed), 40 chars max
- Description: 30 chars (optional, shown under headline in some placements)
- CTA buttons: Learn More, Get Quote, Book Now, Contact Us, Sign Up, Subscribe
- Ad formats: Single image, Carousel (2-10 cards), Video, Collection, Lead Gen
- Lead Gen forms: Instant forms with pre-filled user data
- Audiences: Core (interests/behaviors/demographics), Custom (email list, website visitors), Lookalike (1-10% of custom)
- Campaign objectives: Leads, Traffic, Awareness, Engagement, App installs, Conversions`,

  linkedin: `
LINKEDIN ADS SPECS:
- Sponsored Content: Intro text (150 chars optimal, 600 max), Headline (70 chars max), CTA button
- Message Ads: Subject (60 chars), Body (1500 chars), CTA button
- Lead Gen Forms: Pre-filled with LinkedIn profile data
- Targeting: Job title, Job function, Seniority, Industry, Company size, Company name, Skills, Groups
- Bidding: CPC (clicks), CPM (impressions), CPV (video views)
- Best for: B2B lead gen, brand awareness with professional audiences`,

  nextdoor: `
NEXTDOOR ADS SPECS:
- Local Deal ads: Business name, offer, redemption details, geo radius (1-50 miles)
- Sponsored post: 255 chars max, image optional
- Targeting: Neighborhood radius, zip codes, city/metro
- Best for: Hyperlocal service businesses (roofing, HVAC, windows, landscaping)
- Trust signals: Neighborhood Fav badge, reviews, local references`,

  bing: `
MICROSOFT/BING ADS SPECS:
- Same RSA format as Google: 15 headlines (30 chars), 4 descriptions (90 chars)
- Import directly from Google Ads (1-click import available)
- Audience targeting: LinkedIn profile data integration
- Lower CPCs than Google (typically 30-60% cheaper) but lower volume
- Best for: B2B audiences, 35+ demographic, home services`,

  youtube: `
YOUTUBE ADS SPECS:
- Skippable in-stream: First 5 seconds must hook viewer (can't skip until 5s), 15-60s recommended
- Non-skippable: 15-20 seconds max, higher CPM
- Bumper ads: 6 seconds max, non-skippable
- Script structure: Hook (0-5s) → Problem/Agitate (5-15s) → Solution (15-30s) → CTA (last 5s)
- Companion banner: 300x60px, shown alongside video
- Targeting: In-market audiences, Custom intent (YouTube searches), Placements, Topics`,

  lsa: `
GOOGLE LOCAL SERVICES ADS SPECS:
- Pay per lead (not per click)
- Google Guaranteed badge (requires background check + license verification)
- Categories: Set relevant service categories
- Service areas: Zip codes or city radius
- Budget: Weekly budget, Google auto-manages bids
- Ranking factors: Reviews (quantity + rating), responsiveness, proximity
- Optimization: Answer all calls, dispute invalid leads, collect 5-star reviews`,
}

export async function POST(req: NextRequest) {
  const {
    client_id,
    platform,
    campaign_type,
    objective,
    budget_daily,
    budget_monthly,
    geo,
    service_product,
    target_audience_notes,
    campaign_name,
    month,
  } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  // Fetch client info + brand profile
  const [{ data: client }, { data: bp }] = await Promise.all([
    supabase.from('clients').select('name, industry, address').eq('id', client_id).single(),
    supabase.from('social_brand_profiles').select('*').eq('client_name',
      (await supabase.from('clients').select('name').eq('id', client_id).single()).data?.name
    ).single(),
  ])

  // Fetch existing top-performing Meta/Google data for this client
  const { data: existingPerf } = await supabase
    .from('report_data')
    .select('metric, value, month')
    .eq('client_id', client_id)
    .in('metric', ['meta_spend', 'meta_clicks', 'meta_impressions', 'meta_cpl'])
    .order('month', { ascending: false })
    .limit(20)

  const platformSpec = PLATFORM_SPECS[platform] ?? ''

  const clientContext = `
CLIENT: ${client?.name}
Industry: ${client?.industry}
Location/Geo: ${geo || client?.address || 'Not specified'}
Service/Product being promoted: ${service_product}
Campaign objective: ${objective}
Daily budget: ${budget_daily ? `$${budget_daily}` : 'Not set'}
Monthly budget: ${budget_monthly ? `$${budget_monthly}` : 'Not set'}
Target audience notes: ${target_audience_notes || 'None provided'}
${bp ? `
Brand voice: ${bp.brand_voice}
Known for: ${bp.known_for}
What makes them different: ${bp.what_makes_different}
Target audience: ${bp.target_audience}
CTA style: ${bp.cta_style}
Phone: ${bp.cta_phone}
Website: ${bp.cta_website}` : ''}`

  const isSearchPlatform = ['google_search', 'bing'].includes(platform)
  const isGoogleDisplay = platform === 'google_display'
  const isMeta = platform === 'meta'
  const isLinkedIn = platform === 'linkedin'
  const isYouTube = platform === 'youtube'
  const isNextdoor = platform === 'nextdoor'
  const isLSA = platform === 'lsa'

  const prompt = `You are a senior PPC strategist at a digital marketing agency. Build a complete, ready-to-implement campaign for the client below.

${clientContext}

PLATFORM: ${platform.replace(/_/g, ' ').toUpperCase()}
${platformSpec}

Return ONLY valid JSON in this exact structure (no markdown, no explanation):

{
  "campaign_name": "suggested campaign name",
  "campaign_summary": "2-3 sentence strategy rationale",
  ${isSearchPlatform ? `
  "ad_groups": [
    {
      "name": "Ad Group Name",
      "theme": "what this group targets",
      "keywords": [
        { "keyword": "roofing company chicago", "match_type": "exact", "intent": "service", "recommended_bid": 4.50 },
        { "keyword": "roof replacement near me", "match_type": "phrase", "intent": "local", "recommended_bid": 3.75 }
      ],
      "negative_keywords": ["free", "diy", "how to"],
      "ads": [
        {
          "headlines": ["Headline 1 Max 30 Chars", "Headline 2 Max 30 Chars", "Headline 3 Max 30 Chars", "Headline 4", "Headline 5", "Headline 6", "Headline 7", "Headline 8", "Headline 9", "Headline 10", "Headline 11", "Headline 12", "Headline 13", "Headline 14", "Headline 15"],
          "descriptions": ["Description 1 under 90 chars that sells the service clearly", "Description 2 under 90 chars with CTA", "Description 3 under 90 chars", "Description 4 under 90 chars"],
          "path1": "Roofing",
          "path2": "Chicago"
        }
      ]
    }
  ],
  "global_negatives": ["free", "diy", "cheap", "how to", "youtube", "wikipedia"],
  "bid_strategy": "recommended bid strategy and why",
  ` : ''}
  ${isMeta ? `
  "ad_sets": [
    {
      "name": "Ad Set Name",
      "audience": {
        "age_min": 30,
        "age_max": 65,
        "interests": ["home improvement", "homeowners"],
        "behaviors": ["likely to move", "home improvement store visitors"],
        "exclusions": ["renters", "apartment dwellers"],
        "custom_audience": "description of custom audience to build (e.g. website visitors last 30 days)",
        "lookalike": "seed audience for lookalike"
      },
      "ads": [
        {
          "format": "single_image",
          "primary_text": "Ad primary text under 125 chars",
          "headline": "Headline under 27 chars",
          "description": "Under 30 chars",
          "cta": "Get Quote",
          "image_direction": "what the creative should show"
        },
        {
          "format": "carousel",
          "primary_text": "Carousel primary text",
          "cards": [
            { "headline": "Card 1 headline", "description": "Card 1 desc", "image_direction": "what to show" },
            { "headline": "Card 2 headline", "description": "Card 2 desc", "image_direction": "what to show" }
          ],
          "cta": "Learn More"
        }
      ]
    }
  ],
  "campaign_structure_notes": "notes on campaign structure, budget split across ad sets",
  ` : ''}
  ${isLinkedIn ? `
  "ad_sets": [
    {
      "name": "Ad Set Name",
      "audience": {
        "job_titles": ["Purchasing Manager", "Operations Manager"],
        "job_functions": ["Purchasing", "Operations"],
        "seniority": ["Senior", "Manager", "Director"],
        "industries": ["Construction", "Real Estate"],
        "company_size": ["51-200", "201-500"],
        "skills": ["relevant skills"]
      },
      "ads": [
        {
          "format": "sponsored_content",
          "intro_text": "Intro text 150 chars max",
          "headline": "Headline under 70 chars",
          "cta": "Learn More",
          "image_direction": "what creative to use"
        },
        {
          "format": "message_ad",
          "subject": "Subject under 60 chars",
          "body": "Message body under 1500 chars — conversational, value-first",
          "cta": "Download Guide"
        }
      ]
    }
  ],
  ` : ''}
  ${isYouTube ? `
  "ads": [
    {
      "format": "skippable_instream",
      "hook_0_5s": "exact script for first 5 seconds",
      "problem_5_15s": "problem/agitation script",
      "solution_15_30s": "solution script",
      "cta_last_5s": "CTA script",
      "companion_banner_text": "text for 300x60 companion banner",
      "targeting": {
        "in_market": ["segments to target"],
        "custom_intent": ["YouTube search terms to target"],
        "placements": ["specific channels or videos if relevant"]
      }
    }
  ],
  ` : ''}
  ${isNextdoor ? `
  "ads": [
    {
      "format": "sponsored_post",
      "copy": "Post copy under 255 chars — local, trustworthy tone",
      "image_direction": "what creative to show",
      "offer": "specific offer or CTA"
    },
    {
      "format": "local_deal",
      "offer": "deal text",
      "terms": "redemption terms"
    }
  ],
  "geo_targeting": "recommended radius and specific neighborhoods/zips",
  ` : ''}
  ${isLSA ? `
  "lsa_setup": {
    "service_categories": ["list of categories to enable"],
    "service_areas": ["zip codes or cities to target"],
    "weekly_budget_recommendation": 500,
    "budget_rationale": "why this budget",
    "optimization_checklist": ["action items to improve LSA ranking"],
    "review_strategy": "how to get more 5-star reviews"
  },
  ` : ''}
  ${isGoogleDisplay ? `
  "ad_groups": [
    {
      "name": "Ad Group Name",
      "audience": {
        "in_market": ["Google in-market segment names"],
        "custom_intent": ["search terms that define the audience"],
        "remarketing": "remarketing list description",
        "affinity": ["affinity audiences if relevant"]
      },
      "ads": [
        {
          "format": "responsive_display",
          "short_headlines": ["Headline 1 30 chars", "Headline 2", "Headline 3", "Headline 4", "Headline 5"],
          "long_headline": "Long headline under 90 chars",
          "descriptions": ["Description 1 under 90 chars", "Description 2", "Description 3", "Description 4", "Description 5"],
          "image_direction": "what images to use"
        }
      ]
    }
  ],
  ` : ''}
  "optimization_tips": [
    "Specific optimization tip 1 for this campaign",
    "Specific optimization tip 2",
    "Specific optimization tip 3",
    "Specific optimization tip 4",
    "Specific optimization tip 5"
  ],
  "estimated_performance": {
    "cpc_range": "$X - $Y",
    "cpl_range": "$X - $Y",
    "monthly_leads_estimate": "X - Y leads at $Z/day budget",
    "ctr_benchmark": "X%"
  }
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const aiData = await res.json()
  const raw = aiData.content?.[0]?.text ?? '{}'

  let parsed: Record<string, unknown> = {}
  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'AI parse error', raw }, { status: 500 })
  }

  // Save campaign to DB
  const { data: savedCampaign, error: saveError } = await supabase
    .from('ppc_campaigns')
    .insert({
      client_id,
      platform,
      campaign_type,
      objective,
      budget_daily,
      budget_monthly,
      geo,
      service_product,
      target_audience_notes,
      campaign_name: (parsed.campaign_name as string) || campaign_name || `${client?.name} - ${platform}`,
      month,
      status: 'draft',
    })
    .select()
    .single()

  if (saveError || !savedCampaign) {
    return NextResponse.json({ error: 'DB save error', detail: saveError }, { status: 500 })
  }

  const campaignId = savedCampaign.id

  // Save keywords (Google/Bing)
  if (parsed.ad_groups && Array.isArray(parsed.ad_groups)) {
    const keywordRows: Record<string, unknown>[] = []
    const adRows: Record<string, unknown>[] = []

    for (const group of parsed.ad_groups as Record<string, unknown>[]) {
      const groupName = group.name as string
      for (const kw of (group.keywords as Record<string, unknown>[] || [])) {
        keywordRows.push({
          campaign_id: campaignId,
          ad_group: groupName,
          keyword: kw.keyword,
          match_type: kw.match_type,
          is_negative: false,
          recommended_bid: kw.recommended_bid,
          intent: kw.intent,
        })
      }
      for (const neg of (group.negative_keywords as string[] || [])) {
        keywordRows.push({ campaign_id: campaignId, ad_group: groupName, keyword: neg, match_type: 'negative', is_negative: true })
      }
      for (const ad of (group.ads as Record<string, unknown>[] || [])) {
        adRows.push({ campaign_id: campaignId, ad_group: groupName, ad_format: 'rsa', copy_json: ad })
      }
    }

    if (keywordRows.length) await supabase.from('ppc_keywords').insert(keywordRows)
    if (adRows.length) await supabase.from('ppc_ads').insert(adRows)
  }

  // Save Meta/LinkedIn/YouTube/Nextdoor ads
  const adSets = parsed.ad_sets as Record<string, unknown>[] || []
  const directAds = parsed.ads as Record<string, unknown>[] || []

  for (const set of adSets) {
    // Save audience
    if (set.audience) {
      await supabase.from('ppc_audiences').insert({ campaign_id: campaignId, platform, targeting_json: set.audience })
    }
    for (const ad of (set.ads as Record<string, unknown>[] || [])) {
      await supabase.from('ppc_ads').insert({ campaign_id: campaignId, ad_group: set.name as string, ad_format: ad.format as string, copy_json: ad })
    }
  }

  for (const ad of directAds) {
    await supabase.from('ppc_ads').insert({ campaign_id: campaignId, ad_format: ad.format as string, copy_json: ad })
  }

  // Save global negatives if present
  if (parsed.global_negatives && Array.isArray(parsed.global_negatives)) {
    const negRows = (parsed.global_negatives as string[]).map(kw => ({
      campaign_id: campaignId, keyword: kw, match_type: 'negative', is_negative: true, ad_group: '_global'
    }))
    if (negRows.length) await supabase.from('ppc_keywords').insert(negRows)
  }

  return NextResponse.json({ campaign_id: campaignId, campaign: savedCampaign, output: parsed })
}
