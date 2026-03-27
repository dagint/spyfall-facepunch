import { el, renderHeader } from '../components.js';
import { navigate } from '../../router.js';
import { LOCATIONS, LOCATION_PACKS } from '../../data/locations.js';
import { iconEye, iconSettings, iconHelpCircle, iconShield, iconLightbulb, iconMapPin } from '../icons.js';

/** Render the "How to Play" rules screen with collapsible location categories. */
export function renderRules(container) {
  renderHeader(container, 'HOW TO PLAY', () => navigate('home'));

  // Group locations by pack
  const byPack = {};
  LOCATIONS.forEach((loc) => {
    if (!byPack[loc.pack]) byPack[loc.pack] = [];
    byPack[loc.pack].push(loc);
  });

  const content = el('div', 'space-y-6 pb-8');
  content.innerHTML = `
    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-cyan-400 shrink-0 mt-0.5">${iconEye(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Overview</h2>
      </div>
      <p class="text-sm text-slate-300 leading-relaxed">
        Spyfall is a social deduction game for <strong>3-8+ players</strong>. Everyone is assigned a secret
        location and a role — except one player, <strong>the Spy</strong>, who doesn't know where they are.
      </p>
      <p class="text-sm text-slate-300 leading-relaxed mt-2">
        Players take turns asking each other questions to figure out who the Spy is, while the Spy tries
        to blend in and deduce the location.
      </p>
    </section>

    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-cyan-400 shrink-0 mt-0.5">${iconSettings(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Setup</h2>
      </div>
      <ol class="text-sm text-slate-300 space-y-2 list-decimal list-inside">
        <li>An admin creates a room and shares the 4-letter code</li>
        <li>Other players join using the code</li>
        <li>The host configures the timer (3-12 minutes) and location pack</li>
        <li>The host starts the game when 3+ players are ready</li>
        <li>Each player secretly sees their role card — or learns they're the Spy</li>
      </ol>
    </section>

    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-cyan-400 shrink-0 mt-0.5">${iconHelpCircle(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Gameplay</h2>
      </div>
      <p class="text-sm text-slate-300 leading-relaxed mb-3">
        Players ask each other questions in turns (verbally, in person or over voice chat).
        Questions should be vague enough to not reveal the location to the spy, but specific enough
        to prove you know where you are.
      </p>
      <div class="bg-slate-700/50 rounded-lg p-4 text-sm">
        <div class="font-semibold text-slate-200 mb-2">Example Questions:</div>
        <ul class="text-slate-400 space-y-1">
          <li>"How did you get here today?"</li>
          <li>"What are you wearing for the occasion?"</li>
          <li>"How long have you been doing this kind of work?"</li>
          <li>"What's the dress code like?"</li>
        </ul>
      </div>
    </section>

    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-cyan-400 shrink-0 mt-0.5">${iconShield(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Winning</h2>
      </div>
      <div class="space-y-3 text-sm text-slate-300">
        <div class="flex gap-3 items-start">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5"></span>
          <div><span class="text-emerald-400 font-bold">Players win if:</span> They vote out the Spy (majority vote), or the Spy guesses the wrong location</div>
        </div>
        <div class="flex gap-3 items-start">
          <span class="inline-block w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1.5"></span>
          <div><span class="text-rose-400 font-bold">Spy wins if:</span> They correctly guess the location, an innocent player gets voted out, or time runs out</div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-amber-400 shrink-0 mt-0.5">${iconLightbulb(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Pro Tips for Security Pros</h2>
      </div>
      <ul class="text-sm text-slate-300 space-y-3">
        <li class="flex gap-3 items-start">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
          <div><strong class="text-amber-400">As a regular player:</strong> Give answers that are specific enough to prove knowledge but vague enough that the Spy can't identify the location. Think "need-to-know basis."</div>
        </li>
        <li class="flex gap-3 items-start">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
          <div><strong class="text-amber-400">As the Spy:</strong> Use your social engineering skills. Mirror others' confidence level. Ask questions that work for multiple locations. Don't be the first to answer in detail.</div>
        </li>
        <li class="flex gap-3 items-start">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
          <div><strong class="text-amber-400">Reading the room:</strong> Watch for micro-expressions, hesitation, and overly generic answers. The same threat detection skills you use in incident response work here.</div>
        </li>
        <li class="flex gap-3 items-start">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5"></span>
          <div><strong class="text-amber-400">Meta-strategy:</strong> Experienced players can cross off impossible locations based on others' answers. Use the location reference grid to narrow it down.</div>
        </li>
      </ul>
    </section>

    <section class="card">
      <div class="flex items-start gap-3 mb-3">
        <span class="text-cyan-400 shrink-0 mt-0.5">${iconMapPin(20)}</span>
        <h2 class="text-lg font-bold text-cyan-400">Locations (${LOCATIONS.length} total)</h2>
      </div>
      <p class="text-sm text-slate-400 mb-4">
        Locations are organized into ${Object.keys(LOCATION_PACKS).length} packs. The host picks which pack to play with, or selects "All Packs."
      </p>
      ${Object.entries(LOCATION_PACKS).map(([packId, packLabel]) => {
        const locs = byPack[packId] || [];
        if (locs.length === 0) return '';
        return `
          <div class="mb-4">
            <button class="pack-toggle flex items-center justify-between w-full text-left cursor-pointer" data-pack="${packId}">
              <span class="text-sm font-semibold text-slate-200 font-mono">${packLabel} <span class="text-slate-500 font-normal">(${locs.length})</span></span>
              <span class="text-xs text-slate-500 pack-arrow" data-pack="${packId}">Show</span>
            </button>
            <div class="pack-list hidden mt-2 grid grid-cols-2 gap-1.5" data-pack="${packId}">
              ${locs.map((loc) => `
                <div class="text-xs px-3 py-1.5 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50">${loc.name}</div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </section>
  `;

  container.appendChild(content);

  // Toggle handlers for pack sections
  content.querySelectorAll('.pack-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const packId = btn.dataset.pack;
      const list = content.querySelector(`.pack-list[data-pack="${packId}"]`);
      const arrow = content.querySelector(`.pack-arrow[data-pack="${packId}"]`);
      if (list) {
        const isHidden = list.classList.contains('hidden');
        list.classList.toggle('hidden');
        if (arrow) arrow.textContent = isHidden ? 'Hide' : 'Show';
      }
    });
  });
}
