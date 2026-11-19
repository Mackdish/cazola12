insert into public.email_templates (slug,name,category,subject,html_body,text_body,is_active,variables)
values
('advertiser-campaign-submitted','Campaign submitted','transactional','Campaign received: {{campaignName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Your campaign is in review</h2><p>Hello,</p><p>We received <strong>{{campaignName}}</strong>. Our team will review it and email you when its status changes.</p><p><a href="https://trademall.co.ke/advertiser/campaigns">View campaigns</a></p><p>— TradeMall</p></div>',
 'We received {{campaignName}} for review. View campaigns at https://trademall.co.ke/advertiser/campaigns',
 true,'["campaignName","campaignId"]'::jsonb),
('advertiser-campaign-approved','Campaign approved','transactional','Your campaign is approved: {{campaignName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Your campaign has been approved</h2><p><strong>{{campaignName}}</strong> passed review. You can now manage its delivery from your dashboard.</p><p><a href="https://trademall.co.ke/advertiser/campaigns">Open campaigns</a></p><p>— TradeMall</p></div>',
 'Your campaign {{campaignName}} has been approved. Manage it at https://trademall.co.ke/advertiser/campaigns',
 true,'["campaignName","campaignId"]'::jsonb),
('advertiser-campaign-rejected','Campaign needs changes','transactional','Action needed for {{campaignName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Your campaign needs changes</h2><p>We could not approve <strong>{{campaignName}}</strong> yet.</p><p><strong>Reviewer feedback:</strong> {{reason}}</p><p><a href="https://trademall.co.ke/advertiser/campaigns">Review campaign</a></p><p>— TradeMall</p></div>',
 'Your campaign {{campaignName}} needs changes. Feedback: {{reason}}. Review it at https://trademall.co.ke/advertiser/campaigns',
 true,'["campaignName","campaignId","reason"]'::jsonb),
('advertiser-wallet-deposit','Wallet deposit confirmed','transactional','TradeMall wallet deposit received',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Wallet funded</h2><p>Your TradeMall wallet has been credited with {{amount}} {{currency}}.</p><p>Available balance: {{balance}} {{currency}}.</p><p><a href="https://trademall.co.ke/advertiser/wallet">View wallet</a></p><p>— TradeMall</p></div>',
 'Your TradeMall wallet was credited with {{amount}} {{currency}}. New balance: {{balance}} {{currency}}.',
 true,'["amount","currency","balance"]'::jsonb),
('publisher-website-created','Website submitted','transactional','Website added to TradeMall: {{websiteName}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Website added</h2><p>{{websiteName}} ({{domain}}) has been added to your publisher account.</p><p>Complete domain verification and submit it for review to continue.</p><p><a href="https://trademall.co.ke/publisher/websites/{{websiteId}}">View website</a></p><p>— TradeMall</p></div>',
 'Website {{websiteName}} ({{domain}}) has been added. Continue at https://trademall.co.ke/publisher/websites/{{websiteId}}',
 true,'["websiteName","domain","websiteId"]'::jsonb),
('publisher-ad-zone-created','Ad zone created','transactional','Your new TradeMall ad zone is ready',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Ad zone created</h2><p>Your ad zone <strong>{{zoneName}}</strong> is ready to configure.</p><p>Make sure the zone is active and install its placement code on your website.</p><p><a href="https://trademall.co.ke/publisher/ad-zones">Manage ad zones</a></p><p>— TradeMall</p></div>',
 'Your ad zone {{zoneName}} has been created. Manage it at https://trademall.co.ke/publisher/ad-zones',
 true,'["zoneName","websiteId","adZoneId"]'::jsonb),
('publisher-payout-requested','Payout request received','transactional','TradeMall payout request received',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Payout request received</h2><p>We received your payout request for {{amount}}.</p><p>We will notify you when the request is reviewed.</p><p><a href="https://trademall.co.ke/publisher/payouts">View payouts</a></p><p>— TradeMall</p></div>',
 'We received your payout request for {{amount}}. View status at https://trademall.co.ke/publisher/payouts',
 true,'["amount","method"]'::jsonb),
('publisher-payout-approved','Payout approved','transactional','Your TradeMall payout has been approved',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Payout approved</h2><p>Your payout request {{payoutId}} has been approved and is being processed.</p><p><a href="https://trademall.co.ke/publisher/payouts">View payouts</a></p><p>— TradeMall</p></div>',
 'Your payout request {{payoutId}} has been approved and is being processed.',
 true,'["payoutId","status"]'::jsonb),
('publisher-payout-rejected','Payout needs attention','transactional','Update on your TradeMall payout request',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Update on your payout</h2><p>Your payout request {{payoutId}} was not approved.</p><p>Reason: {{reason}}</p><p><a href="https://trademall.co.ke/publisher/payouts">Review payout</a></p><p>— TradeMall</p></div>',
 'Your payout request {{payoutId}} was rejected. Reason: {{reason}}.',
 true,'["payoutId","reason","status"]'::jsonb),
('publisher-payout-paid','Payout sent','transactional','Your TradeMall payout has been sent',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Payout sent</h2><p>Your payout request {{payoutId}} has been marked paid.</p><p>Payment reference: {{paymentReference}}</p><p><a href="https://trademall.co.ke/publisher/payouts">View payout history</a></p><p>— TradeMall</p></div>',
 'Your payout request {{payoutId}} has been paid. Reference: {{paymentReference}}',
 true,'["payoutId","paymentReference","status"]'::jsonb)
on conflict (slug) do nothing;

insert into public.email_automations (slug,name,description,audience,trigger_event,category,is_enabled,settings)
values
('advertiser-campaign-submitted','Campaign submission confirmation','Confirm campaign submission to advertiser.','advertiser','advertiser.campaign.submitted','transactional',true,'{}'::jsonb),
('advertiser-campaign-approved','Campaign approval notification','Notify advertiser when campaign is approved.','advertiser','advertiser.campaign.approved','transactional',true,'{}'::jsonb),
('advertiser-campaign-rejected','Campaign rejection notification','Explain the required campaign changes.','advertiser','advertiser.campaign.rejected','transactional',true,'{}'::jsonb),
('advertiser-wallet-deposit','Wallet deposit confirmation','Confirm successful advertiser wallet deposits.','advertiser','advertiser.wallet.deposit_succeeded','transactional',true,'{}'::jsonb),
('publisher-website-created','Website submission confirmation','Confirm website creation and verification next steps.','publisher','publisher.website.created','transactional',true,'{}'::jsonb),
('publisher-ad-zone-created','Ad zone setup guidance','Guide publishers after creating their first ad zone.','publisher','publisher.ad_zone.created','transactional',true,'{}'::jsonb),
('publisher-payout-requested','Payout request confirmation','Confirm that a payout request was received.','publisher','publisher.payout.requested','transactional',true,'{}'::jsonb),
('publisher-payout-approved','Payout approval notice','Notify publisher that a payout was approved.','publisher','publisher.payout.approved','transactional',true,'{}'::jsonb),
('publisher-payout-rejected','Payout rejection notice','Explain why a payout request was rejected.','publisher','publisher.payout.rejected','transactional',true,'{}'::jsonb),
('publisher-payout-paid','Payout completion notice','Notify publisher after a payout is marked paid.','publisher','publisher.payout.paid','transactional',true,'{}'::jsonb)
on conflict (slug) do nothing;

insert into public.email_automation_steps (automation_id,step_order,delay_minutes,template_id,is_enabled)
select a.id, 1, 0, t.id, true
from public.email_automations a
join public.email_templates t on t.slug = case a.slug
  when 'advertiser-campaign-submitted' then 'advertiser-campaign-submitted'
  when 'advertiser-campaign-approved' then 'advertiser-campaign-approved'
  when 'advertiser-campaign-rejected' then 'advertiser-campaign-rejected'
  when 'advertiser-wallet-deposit' then 'advertiser-wallet-deposit'
  when 'publisher-website-created' then 'publisher-website-created'
  when 'publisher-ad-zone-created' then 'publisher-ad-zone-created'
  when 'publisher-payout-requested' then 'publisher-payout-requested'
  when 'publisher-payout-approved' then 'publisher-payout-approved'
  when 'publisher-payout-rejected' then 'publisher-payout-rejected'
  when 'publisher-payout-paid' then 'publisher-payout-paid'
end
where a.slug in (
  'advertiser-campaign-submitted','advertiser-campaign-approved','advertiser-campaign-rejected',
  'advertiser-wallet-deposit','publisher-website-created','publisher-ad-zone-created',
  'publisher-payout-requested','publisher-payout-approved','publisher-payout-rejected','publisher-payout-paid'
)
and not exists (select 1 from public.email_automation_steps s where s.automation_id = a.id and s.step_order = 1);
