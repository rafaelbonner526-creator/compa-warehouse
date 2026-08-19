import Link from "next/link";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 text-lg font-semibold text-zinc-100">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-zinc-400">{children}</p>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-zinc-500">{children}</p>;
}

export default function MarketAbout() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-4">
      <Link href="/market" className="text-xs text-indigo-400 underline-offset-2 hover:underline">
        ← back to Market
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">How the Market tab works</h1>
      <P>
        Every section on the Market tab, what it measures, where the numbers come from, and how much
        weight it deserves. The short version: the allocation sections carry real authority, the cycle
        sections are context, and none of it is a trade instruction.
      </P>

      <div className="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
        <strong className="font-semibold text-amber-200">The governing rule.</strong> Cycle and regime
        reads inform the direction of the pre-committed quarterly rebalance. They never justify a trade
        between rebalances. There is good research showing that the more often people check a
        portfolio, the less risk they take and the lower their long-run returns, so frequent checking
        is itself the risk this page is designed against.
      </div>

      <H id="authority">Which section wins when they disagree</H>
      <P>
        These frameworks do not answer the same question, so blending them produces mush. Authority is
        assigned by domain instead:
      </P>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="pb-2 pr-4 font-medium">Question</th>
              <th className="pb-2 font-medium">Who decides</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Guaranteed returns (employer match, HSA, high-rate debt)</td>
              <td className="py-2">Beats everything else</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Savings rate and income growth</td>
              <td className="py-2">Felix (human capital)</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Stock/bond split and geography</td>
              <td className="py-2">Cederburg research. Dalio gets no vote</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Concentration across the whole balance sheet</td>
              <td className="py-2">Dalio</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Regime and cycle position</td>
              <td className="py-2">Dalio, read-only</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="py-2 pr-4">Process and behavior</td>
              <td className="py-2">Felix</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H id="regime">Where the economy is right now</H>
      <P>
        Two numbers describe an economy well enough to be useful: is output growing, and are prices
        rising. Growth is measured by industrial production year over year, inflation by CPI year over
        year, both from FRED.
      </P>
      <P>
        The page shows these two ways, and they can disagree, which is not a bug. The{" "}
        <strong className="text-zinc-300">level</strong> read asks whether growth is positive and
        whether inflation is hot, using thresholds of 0.5% growth and 2.5% inflation (the Fed&apos;s 2%
        target plus a tolerance band). The{" "}
        <strong className="text-zinc-300">direction</strong> read asks whether each is higher or lower
        than three months ago. Inflation can be high and falling at the same time. All Weather boxes
        are about direction, so the highlighted box can differ from the headline label.
      </P>
      <Small>
        Thresholds live in one place, the warehouse model, and the page reads them rather than
        recomputing them. Any surface that displays a score consuming its own copy of the math is how
        two views of the same portfolio start contradicting each other.
      </Small>

      <H id="all-weather">All Weather coverage</H>
      <P>
        Dalio&apos;s observation is that only four things can happen: growth can rise or fall, and
        inflation can rise or fall. Every asset class has an environment where it shines and one where
        it gets destroyed. If you own something that wins in each of the four, no single surprise can
        wreck you, and you no longer need to predict which one is coming.
      </P>
      <P>
        Percentages are the share of the total portfolio held in assets that historically win in that
        box. They do not add up to 100, on purpose: gold counts in both inflationary boxes because it
        hedges both. International equity counts as equity and not as an inflation hedge, because it
        moves closely with the rest of the equity book. Counting it in two boxes would display
        diversification that does not exist.
      </P>
      <P>
        <strong className="text-zinc-300">Why one box is deliberately empty.</strong> Covering the
        falling-growth, falling-inflation box properly requires long government bonds. The governing
        thesis holds zero bonds, on evidence that at a multi-decade horizon bonds cost roughly 9.4
        percentage points of equivalent savings rate and get hurt badly in exactly the inflationary
        states that also hurt spending power. There is a second reason: Dalio&apos;s All Weather works
        by levering a low-volatility bond sleeve up to equity-like risk, and that leverage is not
        available in a brokerage account or a Roth IRA. Without the leverage, All Weather is just a
        low-return portfolio. So that box is labeled &quot;by choice&quot; rather than flagged as a
        gap, because otherwise the dashboard would nag daily toward a position the thesis explicitly
        rejects.
      </P>

      <H id="bands">US vs International</H>
      <P>
        Two ceilings are drawn. The <strong className="text-zinc-300">ALTO band</strong> is the
        personal rule: 50-55% of equity in US stocks. The{" "}
        <strong className="text-zinc-300">evidence zone</strong> is 11-55% US, which is the range the
        Cederburg, Anarkulova and O&apos;Doherty lifecycle paper measures as costing almost nothing
        relative to their optimum of 33% domestic and 67% international.
      </P>
      <P>
        That paper simulates roughly a million possible lifetimes by resampling long consecutive runs
        of real returns from 39 countries back to 1890. Its result is that the optimal allocation is
        all equity, about a third domestic and two thirds international, at every age, with no glide
        path into bonds. A 60/40 investor needs to save 94% more to reach the same outcome; a
        target-date-fund investor needs 63% more.
      </P>
      <P>
        The ceiling moved from 65% to 55% in August 2026, after reading the paper directly rather than
        secondary coverage of it. Past 55% domestic, the measured cost of the deviation begins to
        climb. Overshoots get corrected by pointing new contributions at international, never by
        selling, because selling triggers tax and transaction costs to fix a drift that contributions
        will fix for free.
      </P>

      <H id="equilibriums">The three equilibriums</H>
      <P>
        Dalio&apos;s check that the machine is in balance. Each one, stretched far enough, forces a
        correction somewhere else.
      </P>
      <P>
        <strong className="text-zinc-300">1. Debt versus income.</strong> Debt has to grow no faster
        than the income servicing it. When it does not, there are only three exits: inflate the debt
        away, default, or have the central bank absorb it. This is the slow engine behind the Big Cycle.
      </P>
      <P>
        <strong className="text-zinc-300">2. Capacity.</strong> How much of the country&apos;s
        productive capacity is actually being used, compared to its own long-run average over about 20
        years of data. Above average means bottlenecks and rising prices. Below means idle workers and
        machines, which is slack and disinflation.
      </P>
      <P>
        <strong className="text-zinc-300">3. The risk-premium stack.</strong> Riskier money must pay
        more than safer money: cash least, government bonds more, corporate credit most. When that
        ladder flattens or inverts, money is being squeezed somewhere and the system is straining.
      </P>
      <Small>
        The equity rung of that stack is not shown, because there is no free earnings-yield series and
        fabricating one would be worse than the honest gap. &quot;Not measured&quot; and &quot;measured
        and fine&quot; are different states and the page keeps them different.
      </Small>

      <H id="news">What the world feels like</H>
      <P>
        This is world news, quantified. Two of the five measures are built by literally counting
        newspaper articles: the Baker, Bloom and Davis Economic Policy Uncertainty indices, one for the
        US and one global. The other three are markets pricing risk directly: the St. Louis Fed
        financial stress index, the VIX, and a smoothed recession probability.
      </P>
      <P>
        Each is shown as a percentile of its own roughly 20-year history rather than as a raw number,
        because a VIX of 15 or an uncertainty index of 182 means nothing on its own. The percentile
        answers the only question that matters: is this high or not, by its own standards.
      </P>
      <P>
        <strong className="text-zinc-300">The gap between the two kinds is the signal.</strong> When
        the newspaper measures run hot while the market measures stay calm, the headlines are loud but
        money is not frightened yet. Markets price what they expect to be paid, not what is upsetting.
        Ben Felix makes this point on the podcast by reading a magazine passage about war, political
        chaos and economic collapse that sounds exactly like today, and is from 1847.
      </P>
      <Small>
        A note on what was deliberately not built: a headline scraper or news-sentiment feed. GDELT was
        evaluated and rejected, partly on rate limits and query cost, but mostly because a stream of
        fresh alarming headlines on a portfolio dashboard is a machine for making you trade. These five
        indices are peer-reviewed, methodologically stable, and slow. The Caldara-Iacoviello
        Geopolitical Risk index would be the best single addition here and is not on FRED, so it is a
        known gap rather than a silent omission.
      </Small>

      <H id="big-cycle">Dalio Big Cycle</H>
      <P>
        The 50-75 year arc of a dominant power. It out-competes rivals, gets the reserve currency,
        borrows heavily against that privilege, and eventually has to print money to service what it
        borrowed. Every reserve currency in recorded history has run some version of this arc: the
        Dutch guilder, the British pound, and so on.
      </P>
      <P>
        The six stages are shown with the current one marked. Stage position is derived from federal
        debt as a share of GDP, using thresholds taken from the existing empire-health-monitor
        definition so there is one stage model rather than two that drift apart.
      </P>
      <P>
        <strong className="text-zinc-300">Why there is a second panel.</strong> Debt-to-GDP alone
        cannot separate &quot;high debt, still the reserve currency, everyone still lends to you&quot;
        from &quot;high debt and the world is backing away.&quot; It is slow and it only goes one
        direction. So the four things Dalio says actually mark the turn into decline are measured
        separately: debt above 130% of GDP, negative real interest rates, foreign investors selling
        Treasuries, and a falling dollar. The panel reports how many are currently met instead of
        showing one confident-looking label.
      </P>
      <P>
        Wars, elections and frightening headlines are deliberately absent from those four criteria.
        They are stage 4 features, not stage 5 evidence. &quot;Peak power, internal conflict rising,
        rival emerging&quot; is the literal description of stage 4. The turn to decline shows up in
        whether the world still lends to you and at what real rate, which is precisely what the four
        criteria measure. The single most reliable tell is real interest rates: if lenders are being
        repaid in money worth less than they lent, debasement is actually happening. If real rates are
        solidly positive and foreigners are still net buyers, it is not, no matter how the news reads.
      </P>
      <Small>
        This is an annual-cadence signal. It moves over years. Checking it quarterly adds nothing and
        invites reacting to noise.
      </Small>

      <H id="property-cycle">18-year property cycle</H>
      <P>
        Land and property have moved in a repeating rhythm of roughly 18 years for about two centuries:
        a long recovery from the last crash, a mid-cycle wobble around year seven or eight, a larger
        and more speculative boom, a mania near the top, then a downturn. The underlying logic is that
        land is fixed in supply, so credit expansion capitalizes into land prices until the debt
        servicing it becomes unsustainable.
      </P>
      <P>
        <strong className="text-zinc-300">Attribution.</strong> This is Fred Harrison and Phil
        Anderson&apos;s model, building on Homer Hoyt&apos;s land-value research from the 1930s. It is
        frequently and incorrectly credited to Warren Buffett, who has no cycle model of any kind.
      </P>
      <P>
        <strong className="text-zinc-300">What is measured versus modeled.</strong> The cycle low and
        the years elapsed since are measured from the Case-Shiller national home price index: the model
        finds the minimum in about 20 years of data rather than being told a date. The 18-year length
        and the phase boundaries are the model&apos;s, not the data&apos;s. A warning appears if the
        located low sits at the edge of the available window, since that would mean the position is an
        artifact of where the data starts rather than a real turning point.
      </P>
      <P>
        Treat this as the weakest signal on the page. There are only a handful of observed cycles, the
        framework is heterodox, and there is no counterfactual. It earns a place as context, not as a
        forecast, and nothing in the investing rules changes because of it.
      </P>

      <H id="indicators">Raw indicators</H>
      <P>
        The underlying FRED series that everything above is computed from, each with its latest value
        and 90-day change. Sparklines cover 180 days, so monthly series show only a handful of points.
      </P>

      <H id="sources">Sources</H>
      <Small>
        All macro data from FRED (Federal Reserve Bank of St. Louis), refreshed daily. Holdings from
        Monarch. Research: Anarkulova, Cederburg &amp; O&apos;Doherty, &quot;Beyond the Status Quo: A
        Critical Assessment of Lifecycle Investment Advice&quot; (2025). Ray Dalio, economic principles
        and the changing world order. Ben Felix, Diary of a CEO, April 2026. Baker, Bloom &amp; Davis
        for the policy uncertainty indices. Fred Harrison and Phil Anderson for the property cycle.
      </Small>
      <div className="mt-8">
        <Link href="/market" className="text-xs text-indigo-400 underline-offset-2 hover:underline">
          ← back to Market
        </Link>
      </div>
    </main>
  );
}
