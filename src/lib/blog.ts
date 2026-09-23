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
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-advertise-your-business-on-trademall",
    title: "How to Advertise Your Business on TradeMall",
    excerpt: "A practical guide to creating your first TradeMall campaign and reaching customers across Africa.",
    category: "Advertising",
    publishedAt: "2026-09-23",
    readTime: "5 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "1. Create your advertiser account",
        paragraphs: [
          "Start by creating a TradeMall account and opening the advertiser workspace. Your dashboard is where you manage campaigns, creatives, budgets and performance.",
        ],
      },
      {
        heading: "2. Create a campaign",
        paragraphs: [
          "Choose a campaign goal, set your budget and select the audience you want to reach. TradeMall supports targeting options such as country, county, city, device, browser, operating system and website category.",
        ],
      },
      {
        heading: "3. Add your creative",
        paragraphs: [
          "Upload the image or creative you want visitors to see. Use a clear message, strong branding and a simple call to action so the advert is easy to understand at a glance.",
        ],
      },
      {
        heading: "4. Choose your budget and targeting",
        paragraphs: [
          "Set the amount you want to spend and refine your audience. More specific targeting can help you focus delivery on the locations and audiences that matter to your business.",
        ],
      },
      {
        heading: "5. Launch and monitor",
        paragraphs: [
          "Once your campaign is approved and funded, TradeMall can serve it across eligible publisher websites. Use the campaign dashboard to follow impressions, clicks, spend and other available performance metrics.",
        ],
      },
    ],
  },
  {
    slug: "how-to-monetize-your-website-with-trademall",
    title: "How to Monetize Your Website with TradeMall",
    excerpt: "Learn how publishers can add a website, create placements and start monetizing their traffic.",
    category: "Publishers",
    publishedAt: "2026-09-23",
    readTime: "6 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "1. Register your website",
        paragraphs: [
          "Create a publisher account and add the website you want to monetize. Your domain must go through TradeMall's website verification and approval process before live ads can be served.",
        ],
      },
      {
        heading: "2. Set up your ad placements",
        paragraphs: [
          "Choose where adverts should appear on your website. Common placements include the top of a page, the top or bottom of an article, a sidebar and mobile sticky placements.",
        ],
      },
      {
        heading: "3. Install the TradeMall publisher script",
        paragraphs: [
          "After your website and placements are ready, install the TradeMall publisher script on your website. The script discovers enabled placements and requests eligible adverts from the TradeMall ad server.",
        ],
      },
      {
        heading: "4. Keep your website compliant",
        paragraphs: [
          "Maintain a working website, publish useful content and follow the publisher policies. Traffic quality and website eligibility affect whether adverts can be served.",
        ],
      },
      {
        heading: "5. Track your earnings",
        paragraphs: [
          "Use the publisher dashboard to review traffic, impressions and earnings. Keep your website traffic consistent and continue improving the quality of your content.",
        ],
      },
    ],
  },
  {
    slug: "how-to-create-your-first-trademall-ad-campaign",
    title: "How to Create Your First TradeMall Ad Campaign",
    excerpt: "A step-by-step walkthrough of the campaign setup process, from the campaign brief to launch.",
    category: "How To",
    publishedAt: "2026-09-23",
    readTime: "4 min read",
    author: "TradeMall",
    sections: [
      {
        heading: "Start with one clear objective",
        paragraphs: [
          "Before creating a campaign, decide what action you want the advert to generate. A focused objective makes it easier to choose the creative, audience and landing page.",
        ],
      },
      {
        heading: "Prepare your advert",
        paragraphs: [
          "Prepare your image or other supported creative format before opening the campaign builder. Make sure the message is readable on mobile screens and that the destination page works.",
        ],
      },
      {
        heading: "Set the campaign parameters",
        paragraphs: [
          "Enter the campaign budget, bid and schedule, then select the targeting options that fit your audience. Review the settings carefully before submitting the campaign for approval.",
        ],
      },
      {
        heading: "Review performance after launch",
        paragraphs: [
          "After delivery begins, use the available analytics to understand impressions, clicks, spend and engagement. Use those observations to improve future campaigns rather than changing everything at once.",
        ],
      },
    ],
  },
];
