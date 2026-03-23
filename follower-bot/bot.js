/**
 * Zoiris Cleaning Services — Auto-DM Welcome Bot
 * Runs via GitHub Actions on a schedule.
 * Logs into Instagram, detects new followers, sends AI welcome DM.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Config (read from environment / GitHub Secrets) ──────────────────────────
const IG_USERNAME  = process.env.IG_USERNAME  || 'zoiriscleaningservices';
const IG_PASSWORD  = process.env.IG_PASSWORD  || '';
const GEMINI_KEY   = process.env.GEMINI_KEY   || '';
const KNOWN_FILE   = path.join(__dirname, 'known_followers.json');

// ── Welcome message templates (AI picks one, or we use Gemini) ───────────────
const FALLBACK_MESSAGES = [
  `Hi {{name}}! 👋 Thank you so much for following Zoiris Cleaning Services! 💜 We're so happy to have you here. How can we help you today? We offer residential deep cleaning, move-in/move-out, and commercial cleaning in Mobile, AL! 🏠✨ Feel free to DM us anytime for a FREE quote! 📞`,
  `Hey {{name}}! 🌟 Welcome to the Zoiris family! We're Mobile, AL's most trusted cleaning crew 💜🧹 Need a spotless home? DM us for a free estimate — same-week appointments available!`,
  `Hi {{name}}! So excited you followed us! 🎉 At Zoiris Cleaning Services we make your home shine ✨ We serve Mobile AL & surrounding areas. Message us anytime for a FREE quote! 💜🏠`,
];

// ── Load known followers ──────────────────────────────────────────────────────
function loadKnown() {
  try { return JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')); }
  catch { return { followers: [] }; }
}

function saveKnown(data) {
  fs.writeFileSync(KNOWN_FILE, JSON.stringify(data, null, 2));
}

// ── Generate welcome message with Gemini (falls back to template) ─────────────
async function generateWelcome(name) {
  if (!GEMINI_KEY) {
    const tpl = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
    return tpl.replace('{{name}}', name);
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            `Write a short, warm, friendly welcome DM for a new Instagram follower named "${name}".
The message is from Zoiris Cleaning Services, a professional cleaning company in Mobile, Alabama.
Keep it under 3 sentences. Be genuine, not salesy. Mention we offer free quotes.
Return ONLY the message text.`
          }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 150 },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.candidates[0].content.parts[0].text.trim();
    }
  } catch (e) {
    console.warn('Gemini error, using fallback:', e.message);
  }
  const tpl = FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
  return tpl.replace('{{name}}', name);
}

// ── Wait helper ───────────────────────────────────────────────────────────────
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Zoiris Auto-DM Bot starting...');

  if (!IG_PASSWORD) {
    console.error('❌ IG_PASSWORD not set. Add it to GitHub Secrets.');
    process.exit(1);
  }

  const known = loadKnown();
  const knownSet = new Set(known.followers);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  // ── Step 1: Login ────────────────────────────────────────────────────────
  console.log('🔐 Logging into Instagram...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
  await wait(2000);

  await page.fill('input[name="username"]', IG_USERNAME);
  await wait(500);
  await page.fill('input[name="password"]', IG_PASSWORD);
  await wait(500);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await wait(3000);

  // Dismiss "Save login info" popup if present
  const saveBtn = page.locator('button:has-text("Not Now"), button:has-text("Not now")');
  if (await saveBtn.count() > 0) await saveBtn.first().click().catch(() => {});
  await wait(1500);

  // Dismiss "Turn on notifications" popup if present
  const notifBtn = page.locator('button:has-text("Not Now"), button:has-text("Not now")');
  if (await notifBtn.count() > 0) await notifBtn.first().click().catch(() => {});
  await wait(1500);

  // ── Step 2: Get current followers ────────────────────────────────────────
  console.log('📋 Fetching follower list...');
  await page.goto(`https://www.instagram.com/${IG_USERNAME}/followers/`, { waitUntil: 'networkidle' });
  await wait(3000);

  // Click the followers count link to open the modal
  const followersLink = page.locator(`a[href="/${IG_USERNAME}/followers/"]`);
  if (await followersLink.count() > 0) {
    await followersLink.first().click();
    await wait(2000);
  }

  // Scroll through followers modal to load all visible followers
  const followerHandles = [];
  let prevCount = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const items = await page.$$('[role="dialog"] ul li, [role="dialog"] div[role="button"]');
    if (items.length === prevCount && attempt > 2) break;
    prevCount = items.length;
    // Scroll to bottom of modal
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"] [style*="overflow"]');
      if (d) d.scrollTop = d.scrollHeight;
    });
    await wait(1000);
  }

  // Extract follower usernames from the page
  const currentFollowers = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('[role="dialog"] a[href*="/"]'));
    return [...new Set(links
      .map(a => a.getAttribute('href')?.replace(/\//g, '').trim())
      .filter(h => h && h.length > 0 && !h.includes('.')
    ))];
  });

  console.log(`👥 Found ${currentFollowers.length} visible followers`);

  // ── Step 3: Find NEW followers ───────────────────────────────────────────
  const newFollowers = currentFollowers.filter(u => !knownSet.has(u) && u !== IG_USERNAME);
  console.log(`🆕 New followers: ${newFollowers.length}`);

  if (newFollowers.length === 0) {
    console.log('✅ No new followers. All done!');
    // Update known list with any new ones we found
    known.followers = [...new Set([...known.followers, ...currentFollowers])];
    saveKnown(known);
    await browser.close();
    return;
  }

  // ── Step 4: Send DM to each new follower ─────────────────────────────────
  let sent = 0;
  for (const username of newFollowers.slice(0, 10)) { // max 10 DMs per run
    console.log(`💬 Sending DM to @${username}...`);
    try {
      const msg = await generateWelcome(username);

      // Navigate to their profile first then DM
      await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle', timeout: 10000 });
      await wait(2000);

      // Click Message button on their profile
      const msgBtn = page.locator('button:has-text("Message"), div[role="button"]:has-text("Message")');
      if (await msgBtn.count() === 0) {
        console.log(`  ⚠️  No Message button for @${username} — skipping`);
        knownSet.add(username);
        continue;
      }
      await msgBtn.first().click();
      await wait(2000);

      // Type and send the message
      const input = page.locator('div[role="textbox"][aria-label], textarea[placeholder], div[contenteditable="true"]');
      await input.last().fill(msg);
      await wait(500);
      await page.keyboard.press('Enter');
      await wait(1500);

      console.log(`  ✅ DM sent to @${username}: "${msg.substring(0, 60)}..."`);
      knownSet.add(username);
      sent++;

      // Respectful delay between DMs (avoid spam detection)
      await wait(8000 + Math.random() * 5000);
    } catch (e) {
      console.warn(`  ❌ Failed to DM @${username}:`, e.message);
      knownSet.add(username); // Mark as known so we don't retry forever
    }
  }

  // ── Step 5: Save updated known followers ─────────────────────────────────
  known.followers = [...knownSet, ...currentFollowers].filter((v, i, a) => a.indexOf(v) === i);
  saveKnown(known);

  console.log(`\n✅ Done! Sent ${sent} welcome DMs.`);
  await browser.close();
}

main().catch(e => {
  console.error('💥 Bot crashed:', e);
  process.exit(1);
});
