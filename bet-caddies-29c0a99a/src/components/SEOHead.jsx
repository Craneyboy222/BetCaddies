import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://betcaddiesapp-production.up.railway.app';

export default function SEOHead({ title, description, path = '/' }) {
  const fullTitle = title
    ? `${title} | BetCaddies`
    : 'BetCaddies — Smart Golf Betting Picks';
  const desc =
    description ||
    'AI-powered golf betting picks across PGA, DPWT, LIV, and KFT tours.';
  const canonical = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
    </Helmet>
  );
}
