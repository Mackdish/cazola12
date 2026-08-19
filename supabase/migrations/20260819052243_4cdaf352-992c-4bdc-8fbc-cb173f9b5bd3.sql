
-- Public read access to published policies
GRANT SELECT ON public.policies TO anon, authenticated;
GRANT ALL ON public.policies TO service_role;

DROP POLICY IF EXISTS "Published policies are publicly readable" ON public.policies;
CREATE POLICY "Published policies are publicly readable"
ON public.policies FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE UNIQUE INDEX IF NOT EXISTS policies_slug_key ON public.policies (slug);

INSERT INTO public.policies (slug, category, title, description, is_published, last_updated, related_policies, sections) VALUES
('ad-policies','ad_policies','Ad Policies','Creative, landing page and messaging standards every TradeMall ad must meet before it can serve.',true,'2026-08-19','["prohibited-content","advertiser-policies","traffic-quality"]','[
 {"id":"creative-standards","title":"Creative Standards","content":"Ads must be legible, correctly sized for the requested format, and free of broken or distorted assets. Animated creatives should not flash rapidly or simulate system alerts.","requirements":["Use approved sizes: banner, rectangle, mobile banner or responsive","Text must be readable at 100% zoom","No fake buttons, cursors or system dialogs"],"violations":["Misleading close buttons","Auto-playing audio","Deceptive countdown timers"]},
 {"id":"landing-pages","title":"Landing Page Requirements","content":"The destination must match the ad promise, load quickly, and work on mobile and desktop.","requirements":["Working HTTPS destination","Clear business identity and contact details","No forced downloads or redirect chains"],"enforcement":"Ads pointing to broken or mismatched pages are disapproved until corrected."},
 {"id":"claims","title":"Claims and Substantiation","content":"Performance, pricing and health-related claims must be accurate and substantiated on the landing page.","violations":["Guaranteed income claims","Unverified medical outcomes","Hidden fees or conditions"]},
 {"id":"review","title":"Review Process","content":"Every creative is reviewed before it serves. Most reviews complete within one business day. Disapproved creatives include a reason and can be edited and resubmitted.","enforcement":"Repeated submissions of the same disapproved creative may lead to account restrictions."}
]'::jsonb),

('publisher-guidelines','publisher_guidelines','Publisher Guidelines','Website quality, ad placement and user-experience standards for publishers serving TradeMall ads.',true,'2026-08-19','["traffic-quality","publisher-policies","prohibited-content"]','[
 {"id":"site-quality","title":"Website Quality","content":"Sites must offer original, substantive content, clear navigation and a working privacy policy before approval.","requirements":["Original content owned or licensed by you","Functional navigation and no placeholder pages","Published privacy policy and contact page"]},
 {"id":"placement","title":"Ad Placement","content":"Ad zones must be clearly distinguishable from content and must not obstruct navigation.","violations":["Ads placed under a cursor or overlapping buttons","Stacked or hidden zones","More ads than content above the fold"]},
 {"id":"implementation","title":"Implementation","content":"Use the TradeMall tag exactly as generated. Do not alter, proxy, cache or programmatically refresh ad calls.","enforcement":"Modified tags are disabled and impressions from them are not paid."},
 {"id":"verification","title":"Site Verification","content":"Each website must be verified via the provided meta tag, file upload or DNS record before it can serve live ads."}
]'::jsonb),

('traffic-quality','traffic_quality','Invalid Traffic Policy','How TradeMall defines, detects and acts on invalid traffic and click fraud.',true,'2026-08-19','["publisher-guidelines","publisher-policies","compliance"]','[
 {"id":"definition","title":"What Counts as Invalid Traffic","content":"Invalid traffic is any impression or click that does not come from a genuine user with genuine interest.","examples":["Clicks on your own ads","Bots, crawlers and automated scripts","Incentivised or paid-to-click traffic","Traffic from proxies or emulators used to mask origin"]},
 {"id":"detection","title":"Detection","content":"Every request is scored using device, network, behavioural and frequency signals. Suspicious events are flagged, filtered from billing, and surfaced in the Fraud Center.","requirements":["Do not attempt to reverse-engineer or evade detection","Report suspected fraud on your own inventory promptly"]},
 {"id":"adjustments","title":"Billing Adjustments","content":"Filtered traffic is not billed to advertisers and is not paid to publishers. Adjustments may be applied retroactively to earnings already accrued but not yet paid out."},
 {"id":"consequences","title":"Consequences","content":"Accounts generating sustained invalid traffic face graduated enforcement.","violations":["Self-clicking","Traffic exchanges and click farms","Pop-under or forced-load impressions"],"enforcement":"Withheld earnings, ad serving suspension, or permanent termination for deliberate fraud."}
]'::jsonb),

('prohibited-content','prohibited_content','Prohibited Content','Content and business categories that may not be advertised or monetised on TradeMall.',true,'2026-08-19','["ad-policies","publisher-guidelines","compliance"]','[
 {"id":"prohibited","title":"Always Prohibited","content":"These categories are not permitted anywhere on the platform.","violations":["Adult or sexually explicit material","Weapons, explosives and related parts","Illegal drugs and drug paraphernalia","Counterfeit goods","Malware, hacking tools and cracked software","Hate speech, harassment or violent extremism","Child endangerment content"]},
 {"id":"restricted","title":"Restricted Categories","content":"These may be allowed with documentation and where local law permits.","examples":["Gambling and betting","Alcohol and tobacco alternatives","Financial services, loans and crypto","Healthcare, pharmaceuticals and supplements","Political and election advertising"],"requirements":["Valid licence for the target country","Age and geo restrictions applied","Clear disclosure of terms and risks"]},
 {"id":"reporting","title":"Reporting","content":"Users and publishers can report an ad from any placement. Reports are reviewed by the ad safety team and actioned within the enforcement framework below."}
]'::jsonb),

('data-privacy','data_privacy','Data & Privacy Policy','What data TradeMall processes for ad serving and measurement, and the obligations of advertisers and publishers.',true,'2026-08-19','["compliance","prohibited-content"]','[
 {"id":"collected","title":"Data We Process","content":"To serve and measure ads we process request metadata such as IP-derived location (country, county, city), device type, browser, operating system, referring website, and event timestamps.","requirements":["Data is used for ad delivery, fraud prevention, reporting and billing","Aggregated reporting is available to advertisers and publishers"]},
 {"id":"publisher-duties","title":"Publisher Obligations","content":"Publishers must disclose the use of third-party advertising on their site and obtain any consent required in their users\u2019 jurisdictions before loading the TradeMall tag.","requirements":["Maintain an accurate privacy notice","Honour applicable consent signals","Do not send personal data in ad request parameters"]},
 {"id":"advertiser-duties","title":"Advertiser Obligations","content":"Advertisers must not use TradeMall data to build profiles of identifiable individuals or to target sensitive categories such as health status, sexual orientation or religion."},
 {"id":"retention","title":"Retention and Access","content":"Event-level records are retained only as long as needed for billing, fraud investigation and statutory records; reporting is retained in aggregate. Account holders can request access to or deletion of their account data via support."}
]'::jsonb),

('compliance','compliance','Compliance','Legal, regulatory and operational requirements for using the TradeMall platform.',true,'2026-08-19','["data-privacy","advertiser-policies","publisher-policies"]','[
 {"id":"legal","title":"Legal Compliance","content":"All participants must comply with the laws of Kenya and of every country they advertise in or monetise from, including consumer protection, advertising standards and data protection law."},
 {"id":"kyc","title":"Identity and Payment Compliance","content":"TradeMall may request identity, business registration or bank/mobile money verification before enabling payouts or high-value spend.","requirements":["Accurate legal name and contact details","Payout account owned by the account holder","Prompt response to verification requests"]},
 {"id":"sanctions","title":"Sanctions and Restricted Parties","content":"Accounts owned or controlled by sanctioned individuals or entities are prohibited and will be terminated."},
 {"id":"reporting","title":"Legal Requests","content":"We respond to valid legal requests from competent authorities and will notify affected account holders where permitted by law."}
]'::jsonb),

('advertiser-policies','advertiser_policies','Advertiser Policies','Account, campaign, budget and billing rules for advertisers.',true,'2026-08-19','["ad-policies","traffic-quality","compliance"]','[
 {"id":"account","title":"Account Requirements","content":"One account per business entity. Accurate business details are required, and account sharing or resale is not permitted."},
 {"id":"funding","title":"Funding and Billing","content":"Campaigns serve from prepaid wallet balance. Deposits are supported in KES and other supported currencies; spend is deducted as impressions and clicks are validated.","requirements":["Sufficient balance for the campaign to serve","Daily and total budgets set per campaign"],"enforcement":"Campaigns pause automatically when the wallet balance or budget is exhausted."},
 {"id":"refunds","title":"Refunds and Adjustments","content":"Invalid traffic is credited back automatically. Unused wallet balance can be refunded to the original payment method on request, less any provider fees; completed and validated spend is non-refundable."},
 {"id":"conduct","title":"Campaign Conduct","content":"Do not misrepresent your identity, run competitive scraping, or attempt to manipulate auction or reporting systems.","violations":["Cloaking landing pages from review","Automated bidding abuse","Chargebacks on validated spend"]}
]'::jsonb),

('publisher-policies','publisher_policies','Publisher Policies','Eligibility, earnings, payouts and account rules for publishers.',true,'2026-08-19','["publisher-guidelines","traffic-quality","compliance"]','[
 {"id":"eligibility","title":"Eligibility","content":"You must own or have explicit rights to monetise every website you add, and be at least 18 years old or have a legal guardian operating the account."},
 {"id":"earnings","title":"Earnings","content":"Earnings accrue from validated impressions and clicks only. Reporting is updated continuously and finalised after invalid traffic filtering.","requirements":["Only verified websites accrue earnings","Earnings are shown in your account currency"]},
 {"id":"payouts","title":"Payouts","content":"Payouts are issued to the verified payout method on your account once the minimum threshold is met, on the published payout schedule.","requirements":["Minimum payout threshold reached","Payout details verified and matching the account holder"],"enforcement":"Payouts are held pending review where invalid traffic or ownership disputes are detected."},
 {"id":"termination","title":"Account Closure","content":"You may close your account at any time; accrued valid earnings above the threshold are paid on the next cycle. Accounts terminated for fraud forfeit unpaid earnings."}
]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_published = true,
  last_updated = EXCLUDED.last_updated,
  related_policies = EXCLUDED.related_policies,
  sections = EXCLUDED.sections,
  updated_at = now();
