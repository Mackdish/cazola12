# Publisher automatic placement

Phase 3 makes the publisher experience location-first while keeping the existing ad-zone API compatible.

## Publisher flow

1. Verify and get the website approved.
2. Open **Placements** for the website.
3. Activate locations such as Top of page, Top of article, Between paragraphs, Sidebar, Bottom of article, or Mobile sticky.
4. Add the TradeMall loader script once to the website.
5. The SDK discovers the approved website from the browser `Origin` and requests only its enabled placement zone keys.
6. The SDK creates the matching ad slots in the page and serves each slot through the existing public ad auction endpoint.

## Automatic placement heuristics

The SDK deliberately uses conservative DOM selectors:

- Top of page: first body element.
- Top of article: first `article`, `main`, or `[role="main"]` container.
- Between paragraphs: after the third paragraph in the main content container.
- Sidebar: first `aside` on desktop.
- Bottom of article: end of the main content container.
- Mobile sticky: fixed bottom slot on viewports below 768px.

These are heuristics, not a promise that every website has the same markup. A later integration layer can add CMS-specific selectors and WordPress/Shopify adapters.

## Security model

The placement discovery endpoint is public because it is called by publisher pages, but it does not accept an arbitrary website ID. It requires a browser `Origin`, normalizes the hostname, and returns placements only when that hostname matches a verified and approved registered website. Only enabled placements with active underlying ad zones are returned.

The public placement endpoint returns zone keys, not campaign, advertiser, budget, bid, or wallet information.

## Backward compatibility

Existing manual `[data-trademall-zone]` containers continue to work. The automatic placement layer simply creates equivalent containers for enabled semantic placements.
