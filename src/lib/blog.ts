import { makeExcerpt } from "@/lib/blog-content";

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readTime: string;
  author: string;
  /** Built-in articles are written as structured sections. */
  sections: BlogSection[];
  /** Articles created in the admin blog editor carry a Markdown body instead. */
  body?: string;
};


export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-advertise-your-business-on-trademall",
    title: "How to Advertise Your Business on TradeMall",
    excerpt:
      "A practical, step-by-step guide to creating your first TradeMall campaign, reaching the right audience and measuring your advertising results.",
    category: "Advertising",
    publishedAt: "2026-09-23",
    readTime: "9 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "Introduction",
        paragraphs: [
          "Online advertising gives businesses a way to put their products and services in front of potential customers while they are browsing websites and looking for information. TradeMall provides an advertising platform where businesses can create campaigns and reach audiences across participating publisher websites.",
          "This guide walks you through the complete process of preparing an advert, creating a campaign, selecting your audience, setting a budget and reviewing performance. The goal is to help a first-time advertiser understand what each part of the campaign setup is intended to achieve."
        ]
      },
      {
        heading: "1. Create your advertiser account",
        paragraphs: [
          "Start by creating a TradeMall account and opening the advertiser workspace. Your dashboard is the central place for managing campaigns, adverts, creatives, budgets and available performance information.",
          "Before launching a campaign, make sure your business information is accurate and that you have access to the website or landing page you intend to promote. A working destination page gives people somewhere useful to go after clicking your advert."
        ],
        bullets: [
          "Use your business or organization details consistently.",
          "Prepare the landing-page URL before creating the campaign.",
          "Have your advertising creative ready in a supported format.",
          "Make sure you have sufficient campaign funds available before launch."
        ]
      },
      {
        heading: "2. Decide what your campaign should achieve",
        paragraphs: [
          "A campaign is easier to build when you start with one clear objective. For example, you may want people to visit a product page, contact your business, learn about a service or make a purchase.",
          "Your objective should influence the advert message, call to action and landing page. If the advert asks someone to buy a product, the landing page should make that next step straightforward."
        ],
        bullets: [
          "Choose one primary action for the campaign.",
          "Match the advert message to the page visitors will reach.",
          "Use a clear call to action such as Learn More, Shop Now or Contact Us.",
          "Avoid putting too many unrelated messages into one creative."
        ]
      },
      {
        heading: "3. Create your campaign",
        paragraphs: [
          "Open the campaign creation area and provide the campaign details requested by TradeMall. Depending on the available campaign settings, you can define the campaign name, budget, bid, schedule, targeting and advertising creative.",
          "Give the campaign a descriptive name so that you can identify it later in your dashboard. For example, a name such as 'September Laptop Promotion - Kakamega' is easier to understand than 'Campaign 1'."
        ]
      },
      {
        heading: "4. Choose your audience and targeting",
        paragraphs: [
          "TradeMall supports audience targeting options designed to help advertisers control where and how their adverts can be delivered. Depending on the campaign and available inventory, targeting can include country, county, city, device, browser, operating system, website category and schedule.",
          "Start with the audience that is genuinely relevant to your offer. A local service provider may want to focus on specific locations, while a business selling online may need a wider geographic audience."
        ],
        bullets: [
          "Country: select the markets you want to reach.",
          "County and city: useful when your business serves particular local areas.",
          "Device: choose whether desktop, tablet or mobile audiences are relevant.",
          "Website category: focus delivery on relevant types of publisher websites.",
          "Schedule: control when your campaign can be served when scheduling is available."
        ]
      },
      {
        heading: "5. Prepare a strong advert",
        paragraphs: [
          "Your creative is the part of the campaign that visitors actually see. Use a clear headline, recognizable branding and a concise message. Make sure important text remains readable on smaller screens.",
          "Your creative should communicate the offer quickly. If you are advertising a laptop, for example, show the product, communicate the key benefit or price where appropriate, identify the seller and provide a clear next action."
        ],
        bullets: [
          "Keep the main message short and easy to scan.",
          "Use a high-quality product or service image.",
          "Make your brand identifiable.",
          "Check the creative on both desktop and mobile-sized screens.",
          "Ensure the destination page matches what the advert promises."
        ]
      },
      {
        heading: "6. Set your budget and campaign schedule",
        paragraphs: [
          "Set a campaign budget that you are comfortable spending and configure the bid and schedule according to your campaign objectives. Your budget determines how much you are prepared to spend, while targeting and bidding settings affect how your available budget can be used.",
          "If you are testing a new offer, starting with a controlled campaign can make it easier to observe results before increasing your spend. Record the period, audience and creative used so that later results can be compared meaningfully."
        ]
      },
      {
        heading: "7. Submit the campaign for approval",
        paragraphs: [
          "After completing the campaign settings, review everything before submitting it. Check the destination URL, creative, targeting, budget and schedule. Campaigns and creatives may need to pass TradeMall's approval requirements before they can be delivered.",
          "If a campaign is not immediately serving, check its status in the dashboard. A campaign may need approval, funding or other configuration before eligible publisher inventory can receive it."
        ]
      },
      {
        heading: "8. Monitor results and improve the campaign",
        paragraphs: [
          "Once your campaign is active, use the available performance information to understand how it is being delivered. Depending on the reporting available to your account, you may see impressions, clicks, spend and other campaign metrics.",
          "Do not change every setting at once. If a campaign is not producing the expected result, review the creative, audience, landing page and budget separately. This makes it easier to understand which change affected the result."
        ],
        bullets: [
          "Review performance regularly.",
          "Compare different creatives when testing is appropriate.",
          "Check that the landing page loads correctly.",
          "Review targeting if delivery is too broad or too narrow.",
          "Keep successful campaign settings documented for future campaigns."
        ]
      },
      {
        heading: "Final checklist before launch",
        paragraphs: [
          "Before submitting a campaign, confirm that the business information, creative, landing page, audience, budget and schedule are all correct. A short review can prevent simple configuration mistakes from affecting delivery."
        ],
        bullets: [
          "Advertiser account completed.",
          "Campaign objective defined.",
          "Creative uploaded and checked.",
          "Landing page tested.",
          "Targeting reviewed.",
          "Budget and bid reviewed.",
          "Campaign schedule reviewed.",
          "Campaign submitted for approval."
        ]
      }
    ]
  },
  {
    slug: "how-to-monetize-your-website-with-trademall",
    title: "How to Monetize Your Website with TradeMall",
    excerpt:
      "A complete guide for publishers who want to register a website, verify their domain, create ad placements and start monetizing eligible traffic.",
    category: "Publishers",
    publishedAt: "2026-09-23",
    readTime: "10 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "Introduction",
        paragraphs: [
          "A website can become more than an information resource: publishers can also use suitable advertising placements to generate revenue from their audience. TradeMall connects advertisers with participating publisher websites and provides tools for managing advertising placements.",
          "This guide explains the publisher journey from registration and website verification through placement setup, script installation and performance monitoring."
        ]
      },
      {
        heading: "1. Create your publisher account",
        paragraphs: [
          "Create a TradeMall account and open the publisher area. This is where you manage your websites, placements and publisher information.",
          "Use accurate website and organization information during registration. Keeping these details consistent helps make your publisher account easier to manage as you add more websites."
        ]
      },
      {
        heading: "2. Add your website",
        paragraphs: [
          "Add the domain you want to monetize to your publisher account. TradeMall uses the registered domain to identify the website when publisher requests are made.",
          "Make sure you enter the correct domain. The domain used by visitors must correspond to the website registered in TradeMall for the placement requests to be recognized."
        ],
        bullets: [
          "Use the real website domain rather than a temporary development URL.",
          "Make sure the website is accessible to visitors.",
          "Check the spelling of the domain before saving it.",
          "Keep your website information up to date."
        ]
      },
      {
        heading: "3. Verify and wait for website approval",
        paragraphs: [
          "A website must complete the applicable verification and approval process before live advertising can be served. Verification establishes that the website can be associated with the publisher account, while approval determines whether the website is eligible for advertising.",
          "If your website is verified but adverts are not serving, check both the verification status and approval status in the publisher dashboard. A verified website still needs to meet the conditions required for live ad serving."
        ]
      },
      {
        heading: "4. Choose where adverts should appear",
        paragraphs: [
          "Ad placement determines where advertising inventory is made available on your website. TradeMall supports placement types such as the top of a page, the top of an article, between article content, a sidebar, the bottom of an article and mobile sticky placements.",
          "Choose locations that fit naturally into your website design. Advertising should remain visible without making the page difficult to read or navigate."
        ],
        bullets: [
          "Top page: a placement near the top of a page.",
          "Article top: a placement near the beginning of article content.",
          "Between paragraphs: a placement within article content.",
          "Sidebar: a placement in a sidebar area on suitable layouts.",
          "Bottom article: a placement after article content.",
          "Mobile sticky: a mobile-focused placement that remains visible according to the implementation."
        ]
      },
      {
        heading: "5. Install the TradeMall publisher script",
        paragraphs: [
          "After your website and placements are configured, install the TradeMall publisher script on the website. The script communicates with the TradeMall ad server, discovers enabled placements and requests eligible adverts.",
          "Follow the installation instructions provided in your publisher dashboard. The script should be loaded on the pages where you want TradeMall placements to operate."
        ],
        bullets: [
          "Install the current TradeMall publisher loader supplied by the platform.",
          "Place it where the publisher installation instructions specify.",
          "Publish the changes to your live website.",
          "Open the live website and confirm that the script can load."
        ]
      },
      {
        heading: "6. Make sure your website can receive adverts",
        paragraphs: [
          "Several conditions can affect live ad delivery. Your website needs to be active and eligible, the registered domain needs to match the requesting website, and the relevant placements need to be enabled.",
          "Advertisers also need eligible campaigns and creatives. This means a publisher can have a correctly installed script and still see limited or no adverts when there is no eligible advertising inventory for a particular request."
        ],
        bullets: [
          "Website is verified and approved.",
          "Website is active.",
          "Placement is enabled.",
          "Publisher script is installed correctly.",
          "The requesting domain matches the registered website.",
          "Eligible advertising inventory is available."
        ]
      },
      {
        heading: "7. Test your placements",
        paragraphs: [
          "After publishing the script, test the website from a normal browser. Check desktop and mobile layouts where applicable and inspect the placement locations you configured.",
          "If an advert does not appear, check the browser console and network requests, then confirm the website, placement and campaign statuses in TradeMall. Testing one placement at a time makes troubleshooting easier."
        ]
      },
      {
        heading: "8. Keep your website compliant",
        paragraphs: [
          "Maintain a working website and publish useful content for your audience. Follow TradeMall's publisher requirements and avoid changes that could make the website unsuitable for advertising.",
          "Traffic quality and website eligibility matter. Publishers should focus on building a genuine audience and providing useful pages rather than attempting to generate artificial advertising activity."
        ]
      },
      {
        heading: "9. Monitor traffic and earnings",
        paragraphs: [
          "Use the publisher dashboard to review available impressions, traffic and earnings information. Regularly checking performance helps you understand which pages and placements are receiving activity.",
          "When making layout changes, observe how those changes affect the user experience and available advertising performance. Keep useful content as the primary purpose of the website."
        ]
      },
      {
        heading: "Publisher launch checklist",
        paragraphs: [
          "Use this checklist when preparing a new website for TradeMall monetization."
        ],
        bullets: [
          "Publisher account created.",
          "Website added.",
          "Domain verification completed.",
          "Website approval completed.",
          "Placements configured.",
          "TradeMall script installed.",
          "Live website tested.",
          "Publisher dashboard checked for activity."
        ]
      }
    ]
  },
  {
    slug: "how-to-create-your-first-trademall-ad-campaign",
    title: "How to Create Your First TradeMall Ad Campaign",
    excerpt:
      "A detailed walkthrough of the campaign setup process, from defining your objective and preparing your creative to launch and performance review.",
    category: "How To",
    publishedAt: "2026-09-23",
    readTime: "9 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "Why start with a clear campaign plan?",
        paragraphs: [
          "Creating an advert is only one part of an advertising campaign. Before opening the campaign builder, decide what you want people to do after seeing the advert and identify the audience you want to reach.",
          "A simple campaign plan helps you make better decisions about the creative, targeting, budget and landing page. It also gives you a reference point when reviewing performance later."
        ]
      },
      {
        heading: "1. Define your campaign objective",
        paragraphs: [
          "Start by defining the main action you want the campaign to generate. Depending on your business, this could be visits to a website, enquiries, product interest, registrations or purchases.",
          "Write the objective in one sentence. For example: 'I want people in Kakamega to visit my laptop product page.' A clear objective makes the rest of the campaign easier to configure."
        ]
      },
      {
        heading: "2. Identify your target audience",
        paragraphs: [
          "Think about who is most likely to need your product or service. Consider their location, device usage, interests represented by relevant website categories and the times when they are most likely to engage.",
          "TradeMall provides targeting options that can include geographic and technical attributes. Use only the targeting that is relevant to your campaign rather than narrowing the audience without a clear reason."
        ],
        bullets: [
          "Where are your customers located?",
          "Does the offer serve a local or wider market?",
          "Are your customers primarily mobile users?",
          "Which website categories are relevant to the offer?",
          "Are there specific times when your campaign should run?"
        ]
      },
      {
        heading: "3. Prepare your creative",
        paragraphs: [
          "Your creative should communicate the offer quickly. Use a strong visual, readable text and a clear call to action. Avoid overcrowding the advert with information that visitors cannot read at a glance.",
          "Before uploading the creative, check its dimensions and format against the requirements of the campaign placement you intend to use. Test the creative on a phone as well as a larger screen."
        ]
      },
      {
        heading: "4. Build the campaign",
        paragraphs: [
          "Open the TradeMall advertiser dashboard and create a new campaign. Give it a useful name, select the applicable campaign settings and add the advert creative.",
          "Enter the budget, bid and schedule required for your campaign. Then configure targeting according to the audience plan you prepared before opening the campaign builder."
        ]
      },
      {
        heading: "5. Choose a useful landing page",
        paragraphs: [
          "The page people reach after clicking your advert should directly support the promise made in the creative. If the advert promotes a particular product, send visitors to that product or a relevant product page instead of an unrelated homepage.",
          "Check the landing page on mobile and desktop. It should load correctly, clearly explain the offer and provide the next action you want visitors to take."
        ],
        bullets: [
          "Make sure the URL is correct.",
          "Check that the page is publicly accessible.",
          "Make sure the advertised product or service is visible.",
          "Keep the next action clear.",
          "Check the page on a mobile device."
        ]
      },
      {
        heading: "6. Review budget, bid and schedule",
        paragraphs: [
          "Review the amount you are prepared to spend and the bid settings before submitting the campaign. Make sure the schedule matches the period in which the offer is available.",
          "If this is your first campaign, document the initial settings. Keeping a record of the original audience, creative, budget and schedule makes it easier to understand later changes in performance."
        ]
      },
      {
        heading: "7. Submit the campaign for approval",
        paragraphs: [
          "Review every field before submitting the campaign. Check the creative, landing page, targeting, budget and schedule. Campaign approval requirements help ensure that campaigns and adverts can be considered for live delivery.",
          "After submission, check the campaign status in your dashboard. If it is waiting for approval or another action, complete the required step before expecting live delivery."
        ]
      },
      {
        heading: "8. Understand campaign delivery",
        paragraphs: [
          "A campaign does not necessarily appear on every publisher website. TradeMall's ad-serving system considers factors such as campaign status, advert approval, creative availability, budget, bid, targeting and the format supported by the publisher placement.",
          "This means that a correctly configured campaign may still receive limited delivery if its targeting is narrow or if there is limited eligible inventory matching the selected criteria."
        ]
      },
      {
        heading: "9. Review performance",
        paragraphs: [
          "Once the campaign is active, review the performance information available in your dashboard. Look at the relationship between impressions, clicks, spend and the action you wanted visitors to take.",
          "Performance data should guide your next test. You might test a different creative, broaden or change targeting, improve the landing page or adjust the budget. Change one major variable at a time when possible so you can learn from the result."
        ]
      },
      {
        heading: "A practical first-campaign checklist",
        paragraphs: [
          "Before launching your first campaign, run through the following checklist."
        ],
        bullets: [
          "I know the primary goal of the campaign.",
          "I know who I want to reach.",
          "My creative is clear and readable.",
          "My landing page works.",
          "My targeting matches my audience.",
          "My budget and bid are reviewed.",
          "My schedule matches the offer period.",
          "I have checked the campaign before submitting it.",
          "I know which metrics I will review after launch."
        ]
      },
      {
        heading: "Conclusion",
        paragraphs: [
          "A successful campaign starts with a clear objective and continues with careful setup, relevant targeting, a useful creative and a landing page that delivers on the advert's promise. Once the campaign is live, use the available data to understand what happened and make measured improvements.",
          "For a first campaign, keep the setup understandable and document what you changed. Over time, this creates a useful record of which audiences, messages and landing pages work for your business."
        ]
      }
    ]
  }
];


export const builtInBlogSlugs: readonly string[] = blogPosts.map((post) => post.slug);

export type DatabaseBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  read_time: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function databaseBlogPostToBlogPost(post: DatabaseBlogPost): BlogPost {
  return {
    slug: post.slug,
    title: post.title,
    // Fall back to the opening paragraph so listings/meta descriptions are never blank.
    excerpt: post.excerpt?.trim() ? post.excerpt : makeExcerpt(post.content),
    category: post.category,
    publishedAt: post.published_at ?? post.created_at,
    readTime: post.read_time,
    author: post.author,
    sections: [],
    body: post.content,
  };
}
