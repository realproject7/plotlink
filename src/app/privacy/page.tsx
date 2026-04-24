export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <article className="prose prose-sm max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-muted"><strong>PlotLink &mdash; plotlink.xyz</strong><br />Last updated: April 24, 2026</p>

        <h2>1. Overview</h2>
        <p>PlotLink is an on-chain storytelling protocol. This policy explains what data we collect, what we don&apos;t collect, and how data is handled.</p>

        <h2>2. What We Do NOT Collect</h2>
        <p>PlotLink does not collect, store, or process:</p>
        <ul>
          <li>Email addresses</li>
          <li>Phone numbers</li>
          <li>Passwords</li>
          <li>Names or personal identifiers</li>
          <li>IP addresses (beyond standard server logs)</li>
          <li>Location data</li>
          <li>Cookies for tracking or advertising</li>
        </ul>

        <h2>3. What We Store</h2>

        <h3>Blockchain Data (Public)</h3>
        <p>We index publicly available on-chain data including:</p>
        <ul>
          <li>Wallet addresses (public by nature of blockchain)</li>
          <li>Transaction hashes</li>
          <li>Token balances and activity</li>
          <li>Published story content (stored on IPFS, referenced on-chain)</li>
        </ul>
        <p>This data is already public on the Base blockchain. PlotLink indexes it for display purposes.</p>

        <h3>Farcaster Profile Data</h3>
        <p>If your wallet is linked to a Farcaster account, we cache your public Farcaster profile (username, display name, profile picture) for display purposes. This data is publicly available via the Farcaster protocol.</p>

        <h3>Airdrop Campaign Data</h3>
        <p>If you participate in the PLOT airdrop campaign, we store:</p>
        <ul>
          <li>Your wallet address and earned points</li>
          <li>Referral relationships (which wallet referred which)</li>
          <li>Daily check-in streak data</li>
          <li>Referral codes</li>
        </ul>

        <h3>Story Ratings and Comments</h3>
        <p>If you rate or comment on a story, your wallet address and the rating/comment are stored in our database.</p>

        <h2>4. Local Data (PlotLink OWS)</h2>
        <p>The PlotLink OWS writing tool runs locally on your computer. All data &mdash; stories, drafts, AI conversations, API keys, wallet keys &mdash; is stored locally in <code>~/.plotlink-ows/</code> on your machine. PlotLink does not have access to this data.</p>

        <h2>5. Third-Party Services</h2>
        <p>PlotLink uses the following third-party services:</p>
        <ul>
          <li><strong>Base Network</strong> &mdash; public blockchain (transactions are permanent and public)</li>
          <li><strong>IPFS via Filebase</strong> &mdash; decentralized storage (published content is permanent and public)</li>
          <li><strong>Farcaster / Neynar</strong> &mdash; social identity (public profile data)</li>
          <li><strong>Mint Club</strong> &mdash; bonding curve protocol (token minting and burning)</li>
          <li><strong>Vercel</strong> &mdash; hosting (standard server logs)</li>
        </ul>
        <p>Each service has its own privacy policy.</p>

        <h2>6. Data Retention</h2>
        <ul>
          <li>On-chain data and IPFS content are permanent by design and cannot be deleted</li>
          <li>Database records (ratings, airdrop points, cached profiles) are retained indefinitely</li>
          <li>There is no account deletion process because there are no accounts &mdash; only wallet addresses</li>
        </ul>

        <h2>7. Data Security</h2>
        <ul>
          <li>No sensitive credentials are stored server-side</li>
          <li>Database access is restricted via Supabase Row Level Security</li>
          <li>All API endpoints use HTTPS</li>
        </ul>

        <h2>8. Children</h2>
        <p>PlotLink is not intended for use by anyone under 18 years of age.</p>

        <h2>9. Changes</h2>
        <p>We may update this policy at any time. Changes take effect immediately upon posting.</p>

        <h2>10. Contact</h2>
        <p>For privacy-related questions, open an issue at <a href="https://github.com/realproject7/plotlink" target="_blank" rel="noopener noreferrer">github.com/realproject7/plotlink</a>.</p>
      </article>
    </div>
  );
}
