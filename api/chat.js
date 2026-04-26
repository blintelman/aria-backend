const Anthropic = require("@anthropic-ai/sdk");

// ─── CORS helper ────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ─── Aria system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Aria, the AI assistant for AIgentic — an AI systems integration firm that helps mid-market businesses automate customer service, lead capture, and operational workflows.

ABOUT AIGENTIC:
- We build custom AI agents for mid-market businesses (typically 10–500 employees)
- Core solutions: AI customer service agents, automated lead capture, CRM integration (HubSpot, Salesforce), missed-call text-back, voice AI, appointment booking automation, and workflow automation
- Typical clients: professional services (accounting, legal, dental, medical), home services, insurance agencies, real estate, contractors
- Based in Rhode Island, serving New England and nationally
- Contact: info@tryaigentic.com | (401) 422-3460
- Website: tryaigentic.com

YOUR GOAL: Have a warm, natural conversation to understand the prospect's needs, then capture their contact info so the AIgentic team can follow up.

CONVERSATION GUIDE (follow this order naturally, not robotically):
1. Warm greeting — ask what brings them here or what their business does
2. Explore their pain points (missed calls? slow follow-up? staff overwhelmed answering the same questions? leads falling through the cracks?)
3. Understand their current setup (CRM, phone system, team size)
4. Naturally collect: first name, company name, email address, phone number
5. Close by offering to have someone from the team reach out within 24 hours, or book a quick 30-min demo

TONE & STYLE RULES:
- Keep every response SHORT — 1 to 3 sentences maximum. This is a chat widget.
- Be warm, genuinely curious, and conversational. Not salesy. Not formal.
- Ask ONE question at a time. Never stack multiple questions.
- If they ask a specific question about AI or our services, answer it briefly and return to qualifying.
- If they seem hesitant, back off and offer value instead of pushing.

LEAD CAPTURE TRIGGER:
Once you have collected the prospect's name AND email AND (company name OR phone number), append the following tag EXACTLY at the end of your message — do not explain it, the user will not see it:
[LEAD_CAPTURED:{"name":"First Last","email":"email@example.com","company":"Company Name","phone":"5555555555"}]

Rules for the tag:
- Output it ONLY ONCE, the first time you have all required fields
- Use empty string "" for any field you don't yet have
- Do not include it in any other message
- The tag must be valid JSON`;

// ─── Handler ─────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Support both application/json (auto-parsed) and text/plain (no-preflight CORS workaround)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const completion = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    });

    const fullText = completion.content[0].text;

    // Extract lead capture data if present
    let leadData = null;
    const leadMatch = fullText.match(/\[LEAD_CAPTURED:([\s\S]*?)\]/);
    if (leadMatch) {
      try {
        leadData = JSON.parse(leadMatch[1]);
      } catch (e) {
        console.error("Failed to parse lead data:", leadMatch[1]);
      }
    }

    // Strip the tag from the visible response
    const response = fullText.replace(/\[LEAD_CAPTURED:[\s\S]*?\]/, "").trim();

    return res.json({ response, leadData });
  } catch (err) {
    console.error("Aria backend error:", err);
    return res.status(500).json({
      error: "Something went wrong on my end. Please try again or email info@tryaigentic.com",
    });
  }
};
