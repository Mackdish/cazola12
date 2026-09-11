# Publisher SDK Security

The publisher loader renders ad markup inside a closed Shadow DOM when supported. This isolates ad markup and internal styles from normal publisher-page CSS and DOM queries.

The host element remains outside the shadow root and can still be removed or manipulated by the publisher page. Shadow DOM is therefore an isolation mechanism, not a security boundary. Served-ad tokens and server-side validation remain authoritative.

Impression beacons include lightweight display telemetry: document visibility, viewport dimensions, device pixel ratio, platform, language, and mobile capability. The server continues to obtain the full HTTP User-Agent from the impression request rather than duplicating it in the beacon payload.

Older browsers without Shadow DOM support use a light-DOM fallback so ads and impression tracking continue to function.
