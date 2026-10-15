// Practice cases authored for lowercase (not from a casebook). Flagged for human review.
import type { CaseSeed } from "../../../src/lib/types";
import { flattenTree, n } from "../tree";

const I = "interviewer" as const;
const C = "candidate" as const;

export const regionalAirline: CaseSeed = {
  title: "Regional Airline – Shrinking Margins",
  caseType: "Profitability",
  difficulty: 2,
  published: true,
  problemStatement:
    "Your client is a regional airline operating 40 turboprop aircraft across South India. Operating margin fell from 9% to 2% over the last year. The CEO wants to know why and what to do.",
  facts: [
    "Revenue grew 6% year on year; passenger numbers and average fares are both roughly flat-to-up",
    "Total operating cost rose 14% over the same period",
    "Fuel is 38% of operating cost, up from 31% a year ago",
    "Litres consumed per block hour are unchanged; the fleet and network are unchanged",
    "The airline's 18-month fuel hedge expired eleven months ago and was not renewed",
    "Competitors renewed their hedges and have kept fares flat",
  ],
  hints: [
    "Revenue looks healthy, so a profit tree should quickly move to the cost side",
    "Split cost into fixed and variable, then ask which line moved most as a share of total",
    "If consumption is flat but fuel spend is up, look at the price the airline actually pays per litre",
  ],
  recommendations: [
    "Re-establish a rolling fuel hedge covering 50–70% of the next 12–18 months of consumption",
    "Introduce a transparent fuel surcharge on routes where the airline has pricing power",
    "Accelerate fuel-efficiency levers: single-engine taxi, weight reduction, optimized cruise speeds",
  ],
  observations: [
    "Strong candidates confirm revenue is not the problem in two questions and move on",
    "Quantifying the margin bridge (9% to 2%) keeps the analysis anchored to what matters",
  ],
  tree: flattenTree(
    n("Profit", true, [
      n("Revenue", false, [n("Passengers"), n("Average Fare"), n("Ancillary Revenue")]),
      n("Cost", true, [
        n("Fixed Cost", false, [n("Aircraft Leases"), n("Staff")]),
        n("Variable Cost", true, [
          n("Fuel", true, [
            n("Price per Litre", true, [n("Hedge Coverage", true), n("Market Price")]),
            n("Litres Consumed"),
          ]),
          n("Airport & Navigation Charges"),
          n("Maintenance"),
        ]),
      ]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "Our client, a regional airline, saw operating margin fall from 9% to 2% in a year. Why?" },
    { speaker: C, text: "I'd like to split profit into revenue and cost. Has revenue changed over the period?" },
    { speaker: I, text: "Revenue is up 6%. Passengers and fares are flat to slightly up." },
    { speaker: C, text: "Then the decline should sit on the cost side. How has total cost moved, and which line items drove it?" },
    { speaker: I, text: "Operating cost is up 14%. Fuel went from 31% to 38% of cost." },
    { speaker: C, text: "Fuel spend is consumption times price paid. Has the network or fleet changed, which would change consumption?" },
    { speaker: I, text: "No. Litres per block hour are unchanged, and so are fleet and network." },
    { speaker: C, text: "So the effective price per litre rose. Is that the market price, or did something change in how the airline buys fuel, like hedging?" },
    { speaker: I, text: "The 18-month hedge expired eleven months ago and was not renewed. Competitors renewed theirs." },
    { speaker: C, text: "That explains it: we're paying spot prices while competitors pay hedged prices, so we can't raise fares. I'd re-establish a rolling hedge, add a fuel surcharge where we have pricing power, and push operational fuel-efficiency levers." },
    { speaker: I, text: "Good. Please summarize for the CEO." },
  ],
};

export const specialtyChemicals: CaseSeed = {
  title: "Specialty Chemicals – Profit Squeeze",
  caseType: "Profitability",
  difficulty: 3,
  published: true,
  problemStatement:
    "Your client manufactures specialty coatings for the auto and furniture industries. EBITDA fell 30% in two years even though volumes are up. Diagnose the problem and recommend a plan.",
  facts: [
    "Volumes sold are up 8% over two years",
    "Average realized price per tonne is down 11%",
    "The auto segment shifted 40% of its purchases from premium to standard-grade coatings",
    "Standard grade carries a 14% contribution margin vs 32% for premium",
    "Key raw material (titanium dioxide) prices rose 18%; contracts with auto OEMs have no pass-through clause",
    "Furniture segment margins are stable",
  ],
  hints: [
    "When volume is up and profit is down, check both price/mix and unit cost before concluding",
    "Separate the effect of product mix from the effect of like-for-like price changes",
    "Look at which customer segment changed behaviour and whether contracts let you pass costs through",
  ],
  recommendations: [
    "Renegotiate auto contracts to include raw-material indexation clauses",
    "Re-engineer the standard grade to lower titanium dioxide content without losing spec",
    "Launch a mid-tier product to stop premium-to-standard down-trading",
  ],
  observations: [
    "This is a two-driver case: candidates who stop at mix shift miss the cost pass-through problem",
    "A segment cut (auto vs furniture) early isolates the problem quickly",
  ],
  tree: flattenTree(
    n("EBITDA", true, [
      n("Revenue", true, [
        n("Volume"),
        n("Price per Tonne", true, [
          n("Product Mix", true, [n("Premium Grade"), n("Standard Grade", true)]),
          n("Like-for-like Price"),
        ]),
      ]),
      n("Cost", true, [
        n("Raw Materials", true, [n("Titanium Dioxide Price", true), n("Usage per Tonne")]),
        n("Conversion Cost"),
        n("SG&A"),
      ]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "EBITDA at our specialty coatings client is down 30% in two years despite higher volumes. What's going on?" },
    { speaker: C, text: "Volumes are up, so I'll look at price per tonne and unit costs. First, how has average realized price moved?" },
    { speaker: I, text: "Down 11%." },
    { speaker: C, text: "Is that from cutting list prices or from a change in product mix?" },
    { speaker: I, text: "Mostly mix. Auto customers moved 40% of purchases from premium to standard grade." },
    { speaker: C, text: "What are the margins on each grade?" },
    { speaker: I, text: "32% contribution for premium, 14% for standard." },
    { speaker: C, text: "That's a big mix hit. Before concluding, has unit cost moved too? Raw materials are usually most of the cost here." },
    { speaker: I, text: "Titanium dioxide is up 18%, and the auto contracts have no pass-through." },
    { speaker: C, text: "So there are two drivers: auto down-trading and unrecovered raw-material inflation. I'd add indexation clauses, reformulate the standard grade, and offer a mid-tier grade to stem down-trading." },
  ],
};

export const d2cCoffee: CaseSeed = {
  title: "D2C Coffee Brand – Doubling Revenue",
  caseType: "Revenue Growth",
  difficulty: 1,
  published: true,
  problemStatement:
    "Your client is an online direct-to-consumer coffee brand with ₹60 crore annual revenue. The founders want to double revenue in three years. Where should growth come from?",
  facts: [
    "70% of revenue comes from repeat customers; 30% from first-time buyers",
    "Subscription customers order 11 times a year vs 3 times for one-off buyers",
    "Only 15% of repeat customers are on a subscription",
    "Customer acquisition cost has doubled in 18 months on social ads",
    "Average order value is stable at ₹850",
  ],
  hints: [
    "Break revenue into customers × orders per customer × order value",
    "Compare the economics of acquiring new customers with growing existing ones",
    "Look for a segment with much higher purchase frequency and ask how to move more customers into it",
  ],
  recommendations: [
    "Make subscription the default checkout option with a first-order discount",
    "Use reminders and bundles to convert repeat one-off buyers to subscriptions",
    "Shift acquisition spend toward referral programs, which are cheaper than social ads",
  ],
  observations: [
    "A clear revenue equation up front makes the frequency lever obvious",
    "Rising CAC is a signal to prioritise existing customers before new ones",
  ],
  tree: flattenTree(
    n("Revenue Growth", true, [
      n("Existing Customers", true, [
        n("Order Frequency", true, [n("Subscription Conversion", true), n("Re-order Reminders")]),
        n("Order Value"),
      ]),
      n("New Customers", false, [n("Paid Acquisition"), n("Referrals"), n("New Channels")]),
      n("New Products"),
    ]),
  ),
  transcript: [
    { speaker: I, text: "A D2C coffee brand wants to double its ₹60 crore revenue in three years. Where should growth come from?" },
    { speaker: C, text: "Revenue is customers times orders per customer times order value. Can you tell me how revenue splits between new and repeat customers?" },
    { speaker: I, text: "70% repeat, 30% new." },
    { speaker: C, text: "How does purchase frequency vary across repeat customers?" },
    { speaker: I, text: "Subscribers order 11 times a year, one-off buyers about 3. Only 15% of repeat customers subscribe." },
    { speaker: C, text: "That's a big gap. How expensive is it to acquire new customers right now?" },
    { speaker: I, text: "CAC has doubled in 18 months." },
    { speaker: C, text: "Then the cheapest growth lever is converting repeat buyers to subscriptions. Moving even a third of them nearly doubles their frequency. I'd make subscription the default and support it with reminders, bundles and referral-led acquisition." },
    { speaker: I, text: "Great, thank you." },
  ],
};

export const gymPune: CaseSeed = {
  title: "Premium Gym Chain – Entering Pune",
  caseType: "Market Entry",
  difficulty: 1,
  published: true,
  problemStatement:
    "Your client runs 25 premium gyms across Mumbai and Bengaluru. They are considering entering Pune. Should they, and if so, how?",
  facts: [
    "Pune has about 9 lakh households with income above ₹15 lakh a year, growing 9% annually",
    "Premium gym penetration in Pune is 2.5% vs 4% in Mumbai",
    "Two premium competitors operate 11 gyms in Pune, concentrated in two neighbourhoods",
    "A local 6-gym premium chain in Pune is open to acquisition",
    "The client's gyms break even at 900 members; a new site takes 14 months to get there",
  ],
  hints: [
    "Structure around market attractiveness, competition, client capabilities, then entry mode",
    "Compare Pune's penetration with the client's existing cities to size the headroom",
    "If a quick break-even matters, weigh building organically against buying an existing footprint",
  ],
  recommendations: [
    "Enter Pune: the market is large, growing and under-penetrated",
    "Acquire the 6-gym local chain to get immediate scale and members, then rebrand",
    "Add new sites organically in under-served neighbourhoods after the acquisition",
  ],
  observations: [
    "Sizing the gap between Pune and Mumbai penetration makes the opportunity concrete",
    "Entry mode deserves as much time as the go/no-go question",
  ],
  tree: flattenTree(
    n("Enter Pune?", true, [
      n("Market Attractiveness", true, [n("Market Size", true), n("Growth"), n("Penetration Headroom", true)]),
      n("Competition", false, [n("Number of Players"), n("Location Coverage")]),
      n("Client Capabilities", false, [n("Brand"), n("Operating Model")]),
      n("Entry Mode", true, [n("Organic Build"), n("Acquisition", true), n("Franchise")]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "A premium gym chain is considering entering Pune. Should they?" },
    { speaker: C, text: "I'll look at market attractiveness, competition, the client's capabilities, and entry mode. How big is the target market in Pune?" },
    { speaker: I, text: "About 9 lakh high-income households, growing 9% a year. Premium gym penetration is 2.5%, versus 4% in Mumbai." },
    { speaker: C, text: "So there's real headroom. Who competes there today?" },
    { speaker: I, text: "Two premium players with 11 gyms between them, concentrated in two neighbourhoods. A local 6-gym chain is open to being acquired." },
    { speaker: C, text: "How long does a new site take to break even for our client?" },
    { speaker: I, text: "Around 14 months to reach 900 members." },
    { speaker: C, text: "I'd recommend entering, and buying the local chain for immediate scale rather than waiting 14 months per new site. Then expand organically in the under-served neighbourhoods." },
    { speaker: I, text: "Makes sense. Thank you." },
  ],
};

export const evIndonesia: CaseSeed = {
  title: "EV Two-Wheeler Maker – Entering Indonesia",
  caseType: "Market Entry",
  difficulty: 2,
  published: true,
  problemStatement:
    "An Indian electric two-wheeler manufacturer wants to enter Indonesia, the world's third-largest two-wheeler market. Evaluate the opportunity and recommend an entry strategy.",
  facts: [
    "Indonesia sells about 6 million two-wheelers a year; EV share is 2% but government targets 20% by 2030",
    "The government offers a subsidy of about US$400 per EV with 40% local content",
    "Two local EV startups and one Japanese incumbent's EV line hold most EV sales",
    "Battery swapping networks are emerging in Jakarta through a state-backed consortium",
    "The client's scooters cost 15% less than the incumbent's EV at similar range",
  ],
  hints: [
    "Size the EV market today and under the policy target before judging attractiveness",
    "Check what local-content rules mean for the subsidy and the cost advantage",
    "Charging infrastructure can decide which entry model works",
  ],
  recommendations: [
    "Enter with local assembly to meet the 40% content rule and capture the subsidy",
    "Partner with the battery-swapping consortium so models are swap-compatible from launch",
    "Start in Greater Jakarta and expand with the charging network",
  ],
  observations: [
    "Policy-driven markets need the incentive mechanics understood early",
    "Infrastructure partnerships can matter more than product price in EV markets",
  ],
  tree: flattenTree(
    n("Enter Indonesia?", true, [
      n("Market", true, [n("Current EV Volume"), n("Policy-Driven Growth", true, [n("Subsidy Rules", true), n("2030 Target")])]),
      n("Competition", false, [n("Local Startups"), n("Japanese Incumbents")]),
      n("Economics", false, [n("Price Advantage"), n("Import Duties")]),
      n("Entry Model", true, [n("Import CBUs"), n("Local Assembly", true), n("Infrastructure Partnership", true)]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "An Indian EV two-wheeler maker wants to enter Indonesia. Is it a good idea, and how should they enter?" },
    { speaker: C, text: "I'll assess the market, competition, economics and entry model. What does the EV market look like?" },
    { speaker: I, text: "About 6 million two-wheelers a year, 2% electric, with a government target of 20% by 2030." },
    { speaker: C, text: "That's roughly 120k EVs today, possibly over a million by 2030. What incentives exist?" },
    { speaker: I, text: "A subsidy of about US$400 per vehicle, but only with 40% local content." },
    { speaker: C, text: "So importing finished vehicles forfeits the subsidy. How is charging handled?" },
    { speaker: I, text: "A state-backed battery-swapping network is growing in Jakarta." },
    { speaker: C, text: "I'd enter through local assembly to qualify for the subsidy, make the scooters swap-compatible by partnering with the consortium, and launch in Jakarta first." },
    { speaker: I, text: "Good structure. Thank you." },
  ],
};

export const cloudKitchenPricing: CaseSeed = {
  title: "Cloud Kitchen – Pricing a Meal Subscription",
  caseType: "Pricing",
  difficulty: 1,
  published: true,
  problemStatement:
    "A Bengaluru cloud-kitchen brand is launching a weekday lunch subscription (20 meals a month). How should they price it?",
  facts: [
    "Cost to make and deliver one meal is ₹110",
    "The same meal sells for ₹220 à la carte; average customer orders 6 times a month",
    "Survey: target office workers would pay up to ₹3,800 a month for reliable healthy lunches",
    "Two competitors offer 20-meal plans at ₹3,000 and ₹3,600 with smaller menus",
    "Subscribers are expected to skip about 15% of meals",
  ],
  hints: [
    "Consider cost-based, competitor-based and value-based pricing, then reconcile them",
    "Willingness to pay sets the ceiling; cost sets the floor",
    "Skipped meals change the effective cost per subscription",
  ],
  recommendations: [
    "Price the plan at about ₹3,400 per month: under the survey ceiling and the premium competitor",
    "Position on menu variety versus the ₹3,000 competitor",
    "Offer a 10-meal plan to reach customers who don't eat out every weekday",
  ],
  observations: [
    "Triangulating three pricing methods keeps the recommendation defensible",
    "Factoring skipped meals into unit economics is a mark of strong candidates",
  ],
  tree: flattenTree(
    n("Subscription Price", true, [
      n("Cost-Based Floor", false, [n("Meal Cost"), n("Skip Rate")]),
      n("Competitor Benchmarks"),
      n("Value-Based Ceiling", true, [n("Willingness to Pay", true), n("Convenience Value")]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "How should a cloud kitchen price a 20-meal monthly lunch subscription?" },
    { speaker: C, text: "I'll triangulate cost, competition and customer value. What's the cost per meal?" },
    { speaker: I, text: "₹110 to make and deliver. Subscribers skip about 15% of meals." },
    { speaker: C, text: "So the cost floor is about ₹1,900 a month for 17 meals actually eaten. What do competitors charge?" },
    { speaker: I, text: "₹3,000 and ₹3,600 for 20-meal plans with smaller menus." },
    { speaker: C, text: "And what are customers willing to pay?" },
    { speaker: I, text: "Up to ₹3,800 per the survey." },
    { speaker: C, text: "I'd price at around ₹3,400: below the ceiling and the premium rival, and justified by menu variety. That's roughly a 44% margin after skips." },
    { speaker: I, text: "Nice. Thank you." },
  ],
};

export const bakeryAcquisition: CaseSeed = {
  title: "Bakery Chain – Acquiring a Rival",
  caseType: "M&A",
  difficulty: 1,
  published: true,
  problemStatement:
    "Your client, a 60-outlet bakery chain in Delhi NCR, is considering acquiring a 25-outlet competitor for ₹90 crore. Should they?",
  facts: [
    "The target earns ₹9 crore EBITDA a year, flat for three years",
    "Both chains run their own central kitchens; the client's kitchen runs at 55% utilization",
    "Closing the target's kitchen would save about ₹4 crore a year",
    "12 of the target's outlets are within 1 km of a client outlet",
    "Comparable deals have happened at 8–10× EBITDA",
  ],
  hints: [
    "Value the target on its own first, then add synergies",
    "Look for cost synergies the client can actually control",
    "Compare the price asked with standalone value plus realistic synergies",
  ],
  recommendations: [
    "Proceed with the acquisition at up to about ₹100 crore",
    "Consolidate production into the client's central kitchen",
    "Review the 12 overlapping outlets for closure or relocation to limit cannibalization",
  ],
  observations: [
    "Separating standalone value from synergies avoids paying the seller for value the buyer creates",
    "Cannibalization from overlapping outlets is easy to miss",
  ],
  tree: flattenTree(
    n("Acquire the Rival?", true, [
      n("Standalone Value", true, [n("Target EBITDA", true), n("Valuation Multiple")]),
      n("Synergies", true, [n("Cost Synergies", true, [n("Kitchen Consolidation", true), n("Procurement")]), n("Revenue Synergies")]),
      n("Price Paid"),
      n("Risks", false, [n("Cannibalization"), n("Integration")]),
    ]),
  ),
  transcript: [
    { speaker: I, text: "Our bakery client may buy a 25-outlet rival for ₹90 crore. Should they?" },
    { speaker: C, text: "I'll compare the price against standalone value plus synergies, net of risks. What does the target earn?" },
    { speaker: I, text: "₹9 crore EBITDA, flat for three years. Similar deals happen at 8 to 10 times EBITDA." },
    { speaker: C, text: "So standalone value is ₹72 to 90 crore; the price is at the top of that range. Are there synergies?" },
    { speaker: I, text: "The client's central kitchen is at 55% utilization. Closing the target's kitchen saves ₹4 crore a year." },
    { speaker: C, text: "At 8 times that's about ₹32 crore of synergy value. Any risks?" },
    { speaker: I, text: "12 target outlets are within a kilometre of ours." },
    { speaker: C, text: "I'd proceed at up to about ₹100 crore, consolidate production, and review the overlapping outlets for cannibalization." },
    { speaker: I, text: "Good answer. Thank you." },
  ],
};

export const additionalCases: CaseSeed[] = [
  regionalAirline,
  specialtyChemicals,
  d2cCoffee,
  gymPune,
  evIndonesia,
  cloudKitchenPricing,
  bakeryAcquisition,
];
