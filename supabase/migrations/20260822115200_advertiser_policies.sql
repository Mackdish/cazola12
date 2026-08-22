-- Seed the Advertiser Policies page so /policies/advertiser-policies resolves
-- through the existing dynamic policy routing system.

INSERT INTO public.policies (
  id,
  slug,
  category,
  title,
  description,
  sections,
  related_policies,
  is_published,
  last_updated,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'advertiser-policies',
  'advertiser_policies',
  'Advertiser Policies',
  'TradeMall is committed to providing a safe, transparent, and effective advertising marketplace for advertisers and publishers across Africa. These policies define the requirements that advertisements, campaigns, landing pages, targeting practices, and promotional content must meet before and during delivery on the TradeMall network.',
  '[
    {
      "id": "advertising-content",
      "title": "Advertising Content Requirements",
      "content": "Advertisers must ensure that all advertisements are accurate, lawful, transparent, and appropriate for the audiences they target.\n\nAds must not:\n- Contain false, misleading, deceptive, or materially incomplete claims.\n- Misrepresent products, services, prices, discounts, or promotions.\n- Use deceptive buttons, fake system alerts, fake notifications, or misleading interface elements.\n- Contain malicious code, malware, phishing mechanisms, or harmful downloads.\n- Promote illegal products, services, or activities.\n- Infringe copyrights, trademarks, privacy rights, or other intellectual property rights.\n- Use discriminatory or abusive content.\n- Attempt to manipulate users into clicking advertisements."
    },
    {
      "id": "landing-pages",
      "title": "Landing Page Requirements",
      "content": "Landing pages must:\n- Be functional and accessible.\n- Clearly correspond to the advertised product, service, or offer.\n- Provide accurate information about the advertised offer.\n- Not automatically download malicious software.\n- Not use deceptive redirects.\n- Not contain phishing or credential-stealing mechanisms.\n- Not intentionally prevent users from understanding what is being offered.\n- Comply with applicable laws and regulations."
    },
    {
      "id": "prohibited-categories",
      "title": "Prohibited Advertising Categories",
      "content": "TradeMall may reject advertisements promoting or facilitating:\n- Illegal goods or services.\n- Fraudulent schemes.\n- Phishing or credential theft.\n- Malware or malicious software.\n- Counterfeit goods.\n- Weapons or other restricted products where prohibited by law.\n- Adult or sexually explicit content where prohibited by TradeMall policy.\n- Hate, harassment, or extremist content.\n- Deceptive financial schemes.\n- Fake investment opportunities.\n- Get-rich-quick schemes.\n- Content intended to manipulate or defraud users.\n- Any product, service, or activity prohibited by applicable law.\n\nTradeMall may restrict additional categories based on legal, regulatory, safety, advertiser, publisher, or marketplace requirements."
    },
    {
      "id": "creative-requirements",
      "title": "Creative Requirements",
      "content": "Advertisers are responsible for ensuring that uploaded creatives:\n- Match the campaign and landing page.\n- Use accurate branding.\n- Do not impersonate another company, organization, or individual.\n- Do not contain misleading claims.\n- Do not use deceptive visual elements designed to generate accidental clicks.\n- Meet the technical requirements of the selected ad format."
    },
    {
      "id": "targeting-requirements",
      "title": "Targeting Requirements",
      "content": "Advertisers must use targeting features responsibly.\n\nTargeting must not be used to unlawfully discriminate against users or exploit sensitive characteristics.\n\nAdvertisers are responsible for ensuring that their targeting configuration complies with applicable laws and regulations.\n\nTradeMall may restrict targeting options for certain campaigns, categories, locations, or audiences."
    },
    {
      "id": "campaign-review",
      "title": "Campaign Review",
      "content": "TradeMall may review campaigns before or after publication.\n\nA campaign may be:\n- Approved.\n- Rejected.\n- Paused.\n- Restricted.\n- Suspended.\n- Removed.\n\nApproval does not guarantee that a campaign will remain approved if subsequent review identifies a policy violation.\n\nTradeMall may request additional information or documentation before approving certain campaigns."
    },
    {
      "id": "pricing-and-budgets",
      "title": "Pricing and Campaign Budgets",
      "content": "The current minimum campaign budget is KES 500.\n\nThe starting CPC may be KES 5 per click.\n\nThese are starting platform rates and are not guaranteed fixed prices. Actual campaign costs may vary depending on campaign configuration, targeting, available inventory, advertiser demand, competition, placement, and marketplace conditions.\n\nAdvertisers are responsible for reviewing their campaign settings and budgets before launching campaigns."
    },
    {
      "id": "invalid-traffic",
      "title": "Invalid Traffic and Click Fraud",
      "content": "Advertisers must not generate, encourage, purchase, or facilitate artificial advertising activity.\n\nProhibited activity includes:\n- Automated clicks.\n- Bots.\n- Click farms.\n- Paid-to-click traffic intended to manipulate campaign results.\n- Self-clicking.\n- Click exchanges.\n- Forced clicks.\n- Misleading advertisements designed primarily to generate accidental clicks.\n- Manipulation of impressions, clicks, conversions, or other campaign metrics.\n\nTradeMall may filter invalid activity and may reverse or exclude associated charges where appropriate."
    },
    {
      "id": "brand-safety",
      "title": "Brand Safety",
      "content": "Advertisers may have controls to manage eligible placements, categories, or websites.\n\nTradeMall may restrict advertising inventory that presents unacceptable safety, legal, technical, or reputational risks."
    },
    {
      "id": "advertiser-responsibilities",
      "title": "Advertiser Responsibilities",
      "content": "Advertisers are responsible for:\n- The legality of their advertisements.\n- Their products and services.\n- Their claims and offers.\n- Their landing pages.\n- Their creatives.\n- Their targeting.\n- Their intellectual property rights.\n- Compliance with applicable laws and regulations."
    },
    {
      "id": "policy-enforcement",
      "title": "Policy Enforcement",
      "content": "If TradeMall determines that a campaign violates these policies, we may take one or more actions:\n- Reject the advertisement.\n- Pause the campaign.\n- Remove individual creatives.\n- Restrict targeting.\n- Suspend campaign delivery.\n- Restrict account functionality.\n- Suspend or terminate the advertiser account.\n- Reverse or adjust charges associated with invalid activity where appropriate.\n\nTradeMall may take immediate action where necessary to protect users, publishers, advertisers, the platform, or the integrity of the advertising marketplace."
    },
    {
      "id": "appeals-and-support",
      "title": "Appeals and Support",
      "content": "Advertisers who believe an advertisement was incorrectly rejected or restricted may contact TradeMall support through the official support channels.\n\nAppeals should include the campaign or creative information necessary for TradeMall to review the decision."
    },
    {
      "id": "policy-updates",
      "title": "Policy Updates",
      "content": "TradeMall may update these policies from time to time to reflect changes in our services, technology, marketplace requirements, applicable laws, or safety standards.\n\nThe latest version will always be published on this page."
    }
  ]'::jsonb,
  '[]'::text[],
  true,
  '2026-08-22T00:00:00Z',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
