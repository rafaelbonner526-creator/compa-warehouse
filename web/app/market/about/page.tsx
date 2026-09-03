import Link from "next/link";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 text-lg font-semibold tx-1">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed tx-2">{children}</p>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed tx-m">{children}</p>;
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

      <div className="mt-6 rounded-xl border callout px-4 py-3 text-xs leading-relaxed callout-strong">
        <strong className="font-semibold callout-strong">The governing rule.</strong> Cycle and regime
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
            <tr className="text-left text-xs uppercase tracking-wide tx-m">
              <th className="pb-2 pr-4 font-medium">Question</th>
              <th className="pb-2 font-medium">Who decides</th>
            </tr>
          </thead>
          <tbody className="tx-2">
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Guaranteed returns (employer match, HSA, high-rate debt)</td>
              <td className="py-2">Beats everything else</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Savings rate and income growth</td>
              <td className="py-2">Felix (human capital)</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Stock/bond split and geography</td>
              <td className="py-2">Cederburg research. Dalio gets no vote</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Concentration across the whole balance sheet</td>
              <td className="py-2">Dalio</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Regime and cycle position</td>
              <td className="py-2">Dalio, read-only</td>
            </tr>
            <tr className="border-t bd-s3">
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
        <strong className="tx-2">level</strong> read asks whether growth is positive and
        whether inflation is hot, using thresholds of 0.5% growth and 2.5% inflation (the Fed&apos;s 2%
        target plus a tolerance band). The{" "}
        <strong className="tx-2">direction</strong> read asks whether each is higher or lower
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
        <strong className="tx-2">Why one box is deliberately empty.</strong> Covering the
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
        Two ceilings are drawn. The <strong className="tx-2">ALTO band</strong> is the
        personal rule: 50-55% of equity in US stocks. The{" "}
        <strong className="tx-2">evidence zone</strong> is 11-55% US, which is the range the
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
        <strong className="tx-2">1. Debt versus income.</strong> Debt has to grow no faster
        than the income servicing it. When it does not, there are only three exits: inflate the debt
        away, default, or have the central bank absorb it. This is the slow engine behind the Big Cycle.
      </P>
      <P>
        <strong className="tx-2">2. Capacity.</strong> How much of the country&apos;s
        productive capacity is actually being used, compared to its own long-run average over about 20
        years of data. Above average means bottlenecks and rising prices. Below means idle workers and
        machines, which is slack and disinflation.
      </P>
      <P>
        <strong className="tx-2">3. The risk-premium stack.</strong> Riskier money must pay
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
        Each is shown as a percentile of its own full history rather than as a raw number,
        because a VIX of 15 or an uncertainty index of 182 means nothing on its own. The percentile
        answers the only question that matters: is this high or not, by its own standards.
      </P>
      <P>
        <strong className="tx-2">The gap between the two kinds is the signal.</strong> When
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
        <strong className="tx-2">Why there is a second panel.</strong> Debt-to-GDP alone
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
        <strong className="tx-2">Attribution.</strong> This is Fred Harrison and Phil
        Anderson&apos;s model, building on Homer Hoyt&apos;s land-value research from the 1930s. It is
        frequently and incorrectly credited to Warren Buffett, who has no cycle model of any kind.
      </P>
      <P>
        <strong className="tx-2">What is measured versus modeled.</strong> The cycle low and
        the years elapsed since are measured from the Case-Shiller national home price index: the model
        finds the minimum in the data rather than being told a date. The 18-year length
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

      <H id="crash-patterns">The four patterns before a crash</H>
      <P>
        Most major crashes rhyme. Four patterns recur, and the honest position is that only two of
        them can be measured. The dashboard quantifies those two and leaves the other two as
        questions, because turning a judgment call into a number would give it a precision it has not
        earned.
      </P>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide tx-m">
              <th className="pb-2 pr-4 font-medium">Pattern</th>
              <th className="pb-2 pr-4 font-medium">Measured?</th>
              <th className="pb-2 font-medium">Where</th>
            </tr>
          </thead>
          <tbody className="tx-2">
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Investor overconfidence</td>
              <td className="py-2 pr-4 tx-good">Yes</td>
              <td className="py-2">CAPE percentile over 144 years</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Debt buildup</td>
              <td className="py-2 pr-4 tx-good">Yes</td>
              <td className="py-2">Credit/GDP level and 5-year change over 151 years</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Regulatory shortcoming</td>
              <td className="py-2 pr-4 tx-warn">No</td>
              <td className="py-2">Judgment. Ask the question below</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Poorly understood innovation</td>
              <td className="py-2 pr-4 tx-warn">No</td>
              <td className="py-2">Judgment. Ask the question below</td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>The four questions to ask yourself, since no dashboard can answer them:</P>
      <ol className="mt-2 space-y-2 text-sm leading-relaxed tx-2">
        <li>
          <strong className="tx-2">1. Overconfidence.</strong> Are people buying because of
          what a thing is worth, or because they expect to flip it to someone else for more tomorrow?
        </li>
        <li>
          <strong className="tx-2">2. Regulation.</strong> Is there a fast-growing market
          with no guard rails at all? Or are rules being slammed onto a market that is not ready for
          them?
        </li>
        <li>
          <strong className="tx-2">3. Innovation.</strong> Is money pouring into a new
          instrument or asset that its own buyers cannot explain? Is anyone saying it is different
          this time?
        </li>
        <li>
          <strong className="tx-2">4. Debt.</strong> Are people buying with money they do
          not have, and is the system leaning on borrowed cash?
        </li>
      </ol>

      <H id="episodes">Five crashes, and which patterns were present</H>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide tx-m">
              <th className="pb-2 pr-4 font-medium">Episode</th>
              <th className="pb-2 pr-4 font-medium">The innovation</th>
              <th className="pb-2 font-medium">Patterns</th>
            </tr>
          </thead>
          <tbody className="tx-2">
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4 whitespace-nowrap">1637 Tulips</td>
              <td className="py-2 pr-4">Futures contracts</td>
              <td className="py-2">Overconfidence, innovation</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4 whitespace-nowrap">1907 Panic</td>
              <td className="py-2 pr-4">Investment trusts</td>
              <td className="py-2">Regulation applied too hard, too late</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4 whitespace-nowrap">1929 Crash</td>
              <td className="py-2 pr-4">Leveraged investment trusts</td>
              <td className="py-2">All four. Regulation barely acted at all</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4 whitespace-nowrap">1987 Black Monday</td>
              <td className="py-2 pr-4">Portfolio insurance</td>
              <td className="py-2">Innovation nobody understood, plus leverage mania</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4 whitespace-nowrap">2008 GFC</td>
              <td className="py-2 pr-4">Mortgage-backed securities, CDOs</td>
              <td className="py-2">All four, with debt as the amplifier</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Small>
        The common thread is not that the assets were worthless. Tulips were genuinely rare, houses
        genuinely useful, portfolio insurance genuinely clever. It is that the price stopped being
        about the thing and started being about the next buyer, usually with borrowed money, inside a
        structure nobody had fully modelled.
      </Small>

      <H id="valuation">Valuation, and why 144 years</H>
      <P>
        CAPE is price divided by ten years of inflation-adjusted earnings, so one exceptional year
        cannot flatter it the way a trailing P/E can. Robert Shiller&apos;s dataset runs monthly from
        1871.
      </P>
      <P>
        The long window is the entire point. Measured against the last 20 years, a CAPE in the
        mid-30s looks moderately expensive, because that window contains the dot-com hangover and the
        post-2009 re-rating. Measured against 144 years it sits above where the market stood before
        the 1929 crash. Same number, opposite conclusion. This is the clearest single argument on the
        page for using all the history that exists.
      </P>
      <Small>
        What it is not: a timing signal. Expensive markets have stayed expensive for years and CAPE
        has a poor record of calling tops. It tells you what you are paying, not what happens next.
        Shiller&apos;s file is revised periodically, so the reading carries its own as-of date.
      </Small>

      <H id="credit">Debt buildup, and why 151 years</H>
      <P>
        The Jordà-Schularick-Taylor Macrohistory Database covers 18 advanced economies annually from
        1870: credit, house prices, public debt, and asset returns. It is the standard academic source
        for questions that need more than one business cycle.
      </P>
      <P>
        Private credit and public debt are shown separately and never summed, because they fail
        differently. The crashes that define generations, 1929 and 2008, were private credit events.
        Sovereign debt crises behave differently and hit through the currency.
      </P>
      <P>
        The 5-year change matters more than the level. A high but stable ratio is an economy that has
        adjusted to its debt. Rapid growth is a boom being financed, and roughly 10 percentage points
        of growth in five years is the threshold above which credit expansions have historically
        preceded banking trouble.
      </P>

      <H id="long-history">Why the long windows differ by section</H>
      <P>
        Different series simply exist for different lengths of time, and the page uses all of each
        rather than truncating everything to the shortest.
      </P>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide tx-m">
              <th className="pb-2 pr-4 font-medium">Section</th>
              <th className="pb-2 pr-4 font-medium">Window</th>
              <th className="pb-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="tx-2">
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Property cycle test</td>
              <td className="py-2 pr-4">1870-2020, 18 countries</td>
              <td className="py-2">JST Macrohistory</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Valuation</td>
              <td className="py-2 pr-4">1871-present, monthly</td>
              <td className="py-2">Shiller</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Credit and public debt</td>
              <td className="py-2 pr-4">1870-2020</td>
              <td className="py-2">JST Macrohistory</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">UK reference series</td>
              <td className="py-2 pr-4">1209-2016 for prices, ~1700 for the rest</td>
              <td className="py-2">Bank of England millennium dataset</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">Regime, equilibriums, indicators</td>
              <td className="py-2 pr-4">2-20 years</td>
              <td className="py-2">FRED, daily</td>
            </tr>
            <tr className="border-t bd-s3">
              <td className="py-2 pr-4">News climate</td>
              <td className="py-2 pr-4">full series: 1985, 1990, 1993 starts</td>
              <td className="py-2">Cannot be extended, indices did not exist</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Small>
        Long-history sources are static research datasets revised once a year at most, so they load on
        their own path rather than the daily FRED refresh, and each reading carries its own as-of
        date. Where a series ends before today, the dashboard says so instead of implying the number
        is current.
      </Small>

      <H id="sources">Sources</H>
      <Small>
        All macro data from FRED (Federal Reserve Bank of St. Louis), refreshed daily. Holdings from
        Monarch. Research: Anarkulova, Cederburg &amp; O&apos;Doherty, &quot;Beyond the Status Quo: A
        Critical Assessment of Lifecycle Investment Advice&quot; (2025). Ray Dalio, economic principles
        and the changing world order. Ben Felix, Diary of a CEO, April 2026. Baker, Bloom &amp; Davis
        for the policy uncertainty indices. Fred Harrison and Phil Anderson for the property cycle. Long history: Robert Shiller (US equities
        from 1871), Jordà, Schularick &amp; Taylor Macrohistory Database (18 countries from 1870), and
        the Bank of England&apos;s "A millennium of macroeconomic data for the UK".
      </Small>
      <div className="mt-8">
        <Link href="/market" className="text-xs text-indigo-400 underline-offset-2 hover:underline">
          ← back to Market
        </Link>
      </div>
    </main>
  );
}
