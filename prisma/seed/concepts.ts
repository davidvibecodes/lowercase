// Learn-track content authored for lowercase. Flagged for human review.
import type { ConceptSeed, QuestionInput } from "../../src/lib/types";

const q = (
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
  extra: { kind?: "concept" | "application"; scenario?: string } = {},
): QuestionInput => ({
  kind: extra.kind ?? "concept",
  prompt,
  scenario: extra.scenario ?? null,
  explanation,
  options: options.map((text, i) => ({ text, isCorrect: i === correctIndex })),
});

const CASE_TYPE_OPTIONS = ["Profitability", "Revenue Growth", "Market Entry", "Pricing", "M&A"];

export const conceptSeeds: ConceptSeed[] = [
  {
    slug: "profit-equation",
    title: "Profit = Revenue − Cost",
    summary: "The backbone of every profitability case.",
    icon: "calculator",
    published: true,
    explainers: [
      {
        title: "The profit equation",
        body: "Every profitability case starts here:\n\n**Profit = Revenue − Cost**\n\nIf profit falls, either revenue fell, cost rose, or both. Your first job is to find out **which side moved**.",
      },
      {
        title: "Breaking down revenue",
        body: "Revenue = **Volume × Price**\n\nGo one level deeper when you can:\n\n- Volume = customers × purchases per customer\n- Price = list price adjusted for discounts and **product mix**\n\nAlso split revenue by **stream** (product line, segment, geography) to locate the problem.",
      },
      {
        title: "Breaking down cost",
        body: "Cost = **Fixed cost + Variable cost**\n\n| Type | Changes with volume? | Examples |\n|---|---|---|\n| Fixed | No | Rent, salaries, leases |\n| Variable | Yes | Raw materials, fuel, packaging |\n\nVariable cost = units × cost per unit.",
      },
      {
        title: "How to use it in a case",
        body: "1. Ask whether revenue or cost changed, and **by how much**\n2. Drill into the side that moved\n3. Segment (product, region, customer) until the problem is isolated\n4. Ask **why** it happened before recommending",
      },
    ],
    questions: [
      q("A company's profit fell while its costs stayed exactly the same. What must be true?", ["Revenue fell", "Revenue rose", "Variable costs fell", "Fixed costs rose"], 0, "With costs unchanged, Profit = Revenue − Cost can only fall if revenue fell."),
      q("Which of these is typically a variable cost for a bakery?", ["Shop rent", "Flour", "Manager's salary", "Equipment lease"], 1, "Flour usage rises with the number of loaves baked, so it is a variable cost. Rent, salaries and leases stay fixed in the short run."),
      q("Revenue rose 10% but profit fell. What is the most useful next question?", ["What happened to costs?", "How many employees are there?", "What is the company's mission?", "Who are the shareholders?"], 0, "If revenue rose and profit fell, costs must have grown faster. Ask about cost next."),
      q("A retailer sells the same units at the same list price, but revenue fell because more customers buy the cheaper model. What is this called?", ["Product mix shift", "Fixed cost leverage", "Economies of scale", "Price elasticity"], 0, "A shift toward lower-priced products lowers average realized price even when list prices don't change. That is a mix effect."),
    ],
  },
  {
    slug: "porters-five-forces",
    title: "Porter's 5 Forces",
    summary: "Judge how attractive an industry is.",
    icon: "shield",
    published: true,
    explainers: [
      {
        title: "Why five forces?",
        body: "Porter's 5 Forces explains **how profitable an industry can be**. The stronger the forces, the harder it is to earn high margins.",
      },
      {
        title: "The five forces",
        body: "1. **Rivalry** among existing competitors\n2. **Threat of new entrants**\n3. **Threat of substitutes**\n4. **Bargaining power of suppliers**\n5. **Bargaining power of buyers**",
      },
      {
        title: "Reading the forces",
        body: "- High entry barriers (scale, licences, brand) mean a **low threat of entrants**\n- Few suppliers of a critical input means **high supplier power**\n- Buyers who are concentrated or can switch cheaply have **high buyer power**\n\nUse it in **market entry** and **industry attractiveness** questions.",
      },
    ],
    questions: [
      q("Only two companies in the world make a critical chip your client needs. Which force is strongest?", ["Supplier power", "Buyer power", "Threat of substitutes", "Threat of new entrants"], 0, "Few suppliers of a critical input means suppliers can dictate prices and terms: high supplier power."),
      q("Video calls reduce demand for business air travel. Which force does this illustrate?", ["Threat of substitutes", "Rivalry", "Supplier power", "Threat of new entrants"], 0, "A different product meeting the same need (meeting someone) is a substitute."),
      q("An industry needs a government licence and ₹5,000 crore of plants to start. What does this imply?", ["Low threat of new entrants", "High threat of new entrants", "High buyer power", "Low rivalry"], 0, "Licences and huge capital requirements are entry barriers, which lower the threat of new entrants."),
      q("A supermarket chain buys 40% of a snack maker's output. What does this create?", ["High buyer power", "High supplier power", "Low rivalry", "High threat of substitutes"], 0, "A concentrated buyer taking a large share of output can negotiate hard: high buyer power."),
    ],
  },
  {
    slug: "vrio",
    title: "VRIO",
    summary: "Test whether a resource gives a lasting edge.",
    icon: "gem",
    published: true,
    explainers: [
      {
        title: "What VRIO tests",
        body: "VRIO asks whether a resource or capability gives a **sustained competitive advantage**.\n\n- **V**aluable\n- **R**are\n- **I**nimitable (costly to imitate)\n- **O**rganized to capture value",
      },
      {
        title: "Walking the ladder",
        body: "| Passes | Result |\n|---|---|\n| Not valuable | Competitive disadvantage |\n| V only | Parity |\n| V + R | Temporary advantage |\n| V + R + I | Unused advantage, unless organized |\n| V + R + I + O | Sustained advantage |",
      },
      {
        title: "Using VRIO in cases",
        body: "Use it when asked whether a capability can defend the client's position, or when judging an acquisition target's **real** strengths.",
      },
    ],
    questions: [
      q("A resource is valuable and rare, but competitors can copy it within a year. What does it give?", ["Temporary competitive advantage", "Sustained competitive advantage", "Competitive parity", "Competitive disadvantage"], 0, "It passes V and R but fails I, so the advantage lasts only until rivals imitate it."),
      q("What does the 'O' in VRIO stand for?", ["Organized to capture value", "Original", "Optimized cost", "Outsourced"], 0, "O asks whether the firm's processes and structure let it actually exploit the resource."),
      q("Every competitor has the same cloud software licence. What does the licence give?", ["Competitive parity", "Sustained advantage", "Temporary advantage", "Unused advantage"], 0, "It is valuable but not rare, so it only keeps the firm level with rivals."),
      q("A firm owns a 50-year-old secret recipe that customers love, protected by trade secrecy, and builds its marketing around it. What does it have?", ["Sustained competitive advantage", "Temporary advantage", "Competitive parity", "Competitive disadvantage"], 0, "It is valuable, rare, hard to imitate (secret) and the firm is organized to use it, so it passes all four tests."),
    ],
  },
  {
    slug: "4ps-3cs",
    title: "4Ps & 3Cs-1P",
    summary: "Frameworks for marketing and first questions.",
    icon: "layers",
    published: true,
    explainers: [
      {
        title: "The marketing 4Ps",
        body: "- **Product**: what you sell\n- **Price**: what you charge\n- **Place**: where and how customers buy\n- **Promotion**: how customers hear about it\n\nUse the 4Ps for go-to-market and sales-decline questions.",
      },
      {
        title: "3Cs-1P for first questions",
        body: "At the start of a case, scan the situation with **3C-1P**:\n\n- **Company**: the client's capabilities and economics\n- **Customers**: segments, needs, behaviour\n- **Competitors**: who they are and what changed\n- **Product**: what is offered and how it compares",
      },
      {
        title: "Why it matters",
        body: "In the Mumbai diagnostic case, asking about **competitors** early would have surfaced the online teleconsultation platform much sooner. Use 3C-1P to find what changed outside the client, not just inside it.",
      },
    ],
    questions: [
      q("A brand moves its products from kiranas to quick-commerce apps. Which P changed?", ["Place", "Price", "Product", "Promotion"], 0, "Place covers distribution channels: where and how customers buy."),
      q("In 3C-1P, which C covers the client's own cost structure and capabilities?", ["Company", "Customers", "Competitors", "Channels"], 0, "Company covers the client itself: capabilities, assets and economics."),
      q("Sales fell after a rival launched a cheaper copy of your product. Which part of 3C-1P would surface this fastest?", ["Competitors", "Company", "Customers", "Product"], 0, "A rival's move is a competitor change, so asking about competitors finds it fastest."),
      q("A cosmetics brand runs influencer campaigns on Instagram. Which P is this?", ["Promotion", "Place", "Price", "Product"], 0, "Advertising and influencer marketing are how customers hear about the product: Promotion."),
    ],
  },
  {
    slug: "case-type-identification",
    title: "Case Type Identification",
    summary: "Read a prompt and name the case type.",
    icon: "search",
    published: true,
    explainers: [
      {
        title: "Why identify the case type?",
        body: "Naming the case type in the first minute tells you **which structure to use**. Listen for the business question behind the prompt.",
      },
      {
        title: "The five common types",
        body: "| Type | Typical question |\n|---|---|\n| Profitability | Why did profit fall? |\n| Revenue Growth | How do we grow sales? |\n| Market Entry | Should we enter a new market? |\n| Pricing | What should we charge? |\n| M&A | Should we acquire or merge? |",
      },
      {
        title: "Watch for traps",
        body: "\"Revenue is down\" with costs flat is still a **profitability** problem if the question is about profit. \"Grow revenue\" with no decline is **revenue growth**. Read the **objective**, not just the symptom.",
      },
    ],
    questions: [
      q("What type of case is this?", CASE_TYPE_OPTIONS, 0, "Falling profit with the question \"why\" is a profitability case.", { kind: "application", scenario: "A diagnostic chain in Mumbai has seen its profits decline over the last five months and wants you to find out why." }),
      q("What type of case is this?", CASE_TYPE_OPTIONS, 2, "Deciding whether to start operating in a new geography is market entry.", { kind: "application", scenario: "A premium gym chain with gyms in Mumbai and Bengaluru is considering opening in Pune." }),
      q("What type of case is this?", CASE_TYPE_OPTIONS, 3, "Setting the price of a new offering is a pricing case.", { kind: "application", scenario: "A cloud kitchen is launching a monthly lunch subscription and needs to decide how much to charge." }),
      q("What type of case is this?", CASE_TYPE_OPTIONS, 4, "Evaluating the purchase of another company is an M&A case.", { kind: "application", scenario: "A bakery chain has been offered the chance to buy a smaller competitor for ₹90 crore." }),
      q("What type of case is this?", CASE_TYPE_OPTIONS, 1, "The goal is to grow sales with no decline to diagnose, which is revenue growth.", { kind: "application", scenario: "A D2C coffee brand doing well today wants to double its revenue in three years." }),
      q("What type of case is this?", CASE_TYPE_OPTIONS, 0, "Margins shrinking while revenue grows is a profitability problem. The question is about profit, not sales.", { kind: "application", scenario: "A regional airline's revenue grew 6% last year, but its operating margin fell from 9% to 2%. The CEO wants to understand why." }),
    ],
  },
];
