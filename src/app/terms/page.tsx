export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <article className="prose prose-sm max-w-none font-prose">
        <h1>Terms of Service</h1>
        <p className="text-muted"><strong>PlotLink &mdash; plotlink.xyz</strong><br />Last updated: April 24, 2026</p>

        <h2>1. Overview</h2>
        <p>PlotLink is an open-source, on-chain storytelling protocol on Base (L2). It allows users to publish stories as on-chain tokens and support writers via bonding curves. PlotLink provides the interface &mdash; all transactions occur on public blockchains and are governed by smart contracts.</p>

        <h2>2. Acceptance</h2>
        <p>By using PlotLink, you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>3. The Service</h2>
        <p>PlotLink provides:</p>
        <ul>
          <li>A web interface for publishing and reading tokenized stories</li>
          <li>Bonding curve token creation via Mint Club V2 (third-party protocol)</li>
          <li>IPFS storage of story content via Filebase (third-party provider)</li>
          <li>An AI writing assistant tool (PlotLink OWS) for local use</li>
          <li>An airdrop campaign with conditional token distribution</li>
        </ul>
        <p>PlotLink does NOT:</p>
        <ul>
          <li>Custody, hold, or control user funds or tokens</li>
          <li>Provide financial, investment, or legal advice</li>
          <li>Guarantee any token value, return, or market outcome</li>
          <li>Control or reverse on-chain transactions</li>
        </ul>

        <h2>4. Wallet-Based Access</h2>
        <p>PlotLink uses wallet-based authentication (e.g., MetaMask, Coinbase Wallet). We do not collect email addresses, phone numbers, passwords, or other personal credentials. Your wallet address is your identity on the platform.</p>

        <h2>5. User Content</h2>
        <p>Stories published through PlotLink are stored on IPFS and referenced on-chain. By publishing, you represent that:</p>
        <ul>
          <li>You own or have the right to publish the content</li>
          <li>The content does not infringe any third-party rights</li>
          <li>The content does not contain illegal material</li>
        </ul>
        <p>Published content is permanent and cannot be deleted from IPFS or the blockchain by PlotLink.</p>

        <h2>6. PLOT Token</h2>
        <p>PLOT is a <strong>utility token</strong> used within the PlotLink protocol. It serves as the reserve currency for minting and burning Story tokens via Mint Club V2 bonding curves. PLOT is not an investment, security, or financial instrument. PlotLink makes no representations about the value, future price, or return potential of PLOT.</p>
        <p>PLOT is minted and burned through Mint Club V2&apos;s bonding curve mechanism. PlotLink does not control the supply, price, or liquidity of PLOT.</p>

        <h2>7. Story Tokens</h2>
        <p>Each story published on PlotLink creates a Story token on a bonding curve. Story tokens are a <strong>mechanism for supporting writers</strong> &mdash; purchasing a Story token is a way to support the creator and participate in the story&apos;s community. Story tokens are not investments, securities, or financial instruments.</p>
        <ul>
          <li>Writers receive royalties (5%) on each mint as a reward for creating content</li>
          <li>Token prices are determined algorithmically by the bonding curve, not by PlotLink</li>
          <li>Story tokens may have no monetary value</li>
          <li>Purchasing a Story token does not create any obligation from the writer or PlotLink</li>
        </ul>

        <h2>8. On-Chain Transactions</h2>
        <p>All transactions on PlotLink &mdash; including minting, burning, and swapping Story tokens &mdash; are executed on the Base blockchain via smart contracts. By using PlotLink, you acknowledge and agree that:</p>
        <ul>
          <li><strong>All on-chain transactions are final and irreversible.</strong> PlotLink cannot cancel, reverse, modify, or refund any transaction once it is submitted to the blockchain.</li>
          <li><strong>PlotLink is not a party to your transactions.</strong> All mints and burns are executed directly between your wallet and the bonding curve smart contract. PlotLink provides the interface only.</li>
          <li><strong>You are solely responsible for your transactions.</strong> This includes verifying amounts, addresses, and gas fees before confirming.</li>
          <li><strong>PlotLink cannot recover lost funds.</strong> If you send tokens to the wrong address, interact with the wrong contract, or lose access to your wallet, PlotLink cannot assist with recovery.</li>
          <li>Token prices are determined by the bonding curve algorithm &mdash; PlotLink does not set, influence, or guarantee prices</li>
          <li>You accept all risks associated with minting and burning tokens, including total loss of funds</li>
          <li>You are responsible for understanding applicable tax obligations in your jurisdiction</li>
        </ul>
        <p>PlotLink earns no fees from token minting or burning. Creation fees are paid to Mint Club.</p>

        <h2>9. Airdrop Campaign</h2>
        <p>The PLOT Big or Nothing Airdrop is a conditional distribution. Participation does not guarantee any token distribution. The airdrop pool may be partially or fully burned based on market conditions. PlotLink makes no guarantees about token value or distribution outcomes. The airdrop is not compensation, income, or a return on investment.</p>

        <h2>10. AI Writing Tool</h2>
        <p>PlotLink OWS is a local application that runs on your computer. It connects to third-party AI providers (Anthropic, OpenAI, etc.) using your own API keys. PlotLink does not process, store, or have access to your AI conversations or API keys.</p>

        <h2>11. Third-Party Services</h2>
        <p>PlotLink integrates with third-party services including but not limited to Mint Club, Filebase (IPFS), Base network, and Farcaster. PlotLink is not responsible for the availability, accuracy, or conduct of these services.</p>

        <h2>12. No Warranty</h2>
        <p>PlotLink is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do not guarantee uninterrupted access, error-free operation, or the accuracy of any displayed data (including prices, market caps, or token metrics).</p>

        <h2>13. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, PlotLink and its contributors shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to loss of funds, tokens, or data.</p>

        <h2>14. Modification</h2>
        <p>We may update these terms at any time. Continued use of PlotLink after changes constitutes acceptance.</p>

        <h2>15. Governing Law</h2>
        <p>These terms are governed by the laws applicable to the user&apos;s jurisdiction. PlotLink does not operate as a registered entity in any specific jurisdiction.</p>

        <h2>16. Contact</h2>
        <p>For questions about these terms, open an issue at <a href="https://github.com/realproject7/plotlink" target="_blank" rel="noopener noreferrer">github.com/realproject7/plotlink</a>.</p>
      </article>
    </div>
  );
}
