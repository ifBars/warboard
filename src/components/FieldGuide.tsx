import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";

const entries = [
  {
    title: "Why can I not join the playtest or find a server?",
    category: "Playtest access",
    body: "The Closed Beta 02 announcement describes invite waves and testing of server browsing, login queues and VOIP. Check the official news and your community dashboard for access and service updates. WARBOARD does not query live servers or verify your account's access.",
    url: "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1842212951313938",
    source: "Official announcement · September 1, 2026",
  },
  {
    title: "My artillery rounds keep missing",
    category: "Fire support",
    body: "Check the selected map, weapon and both coordinates. Use one ranging shot before a salvo. A flat-ground table cannot account for a tilted vehicle or a target on a different elevation. Observe the miss, then enter over/short and left/right in Fire support.",
    url: "https://github.com/apollyon-sys/wardogs-calculator/blob/main/docs/terrain.md",
    source: "Apollyon · limitations",
  },
  {
    title: "How do I call a target to a gunner?",
    category: "Squad coordination",
    body: "Agree on the map and target name. Pass X/Y coordinates and ask the gunner to read them back. WARBOARD keeps the gun in place while you switch saved targets. Copy a squad callout for chat; this app does not synchronize positions or rooms.",
    url: "https://www.reddit.com/r/WarDogs/comments/1w5z505/wardogs_artillery_app_with_coop/",
    source: "Player discussion · gunner/spotter workflow",
  },
  {
    title: "My mortar has no ammunition",
    category: "Logistics",
    body: "Players report that emplaced mortars use the FOB's ammo resource. Check the base's resource stock, then coordinate a supply delivery. A pallet and a crate use different delivery workflows; check the in-game prompts when unloading.",
    url: "https://www.reddit.com/r/WarDogs/comments/1vw2d6v/someone_explain_in_detail_how_to_use_mortars_and/",
    source: "Community report · check current build",
  },
  {
    title: "What should a supply run carry?",
    category: "Logistics",
    body: "Ask the FOB crew which resource is low before leaving. Ammo, building, fuel and mechanical resources serve different needs. Mark the destination, a usable approach and a fallback route on the board. Check the drop is received before starting another trip.",
    url: "https://www.reddit.com/r/WarDogs/comments/1w6eheh/bobs_and_logi_unite_lets_discuss_fobs_and_their/",
    source: "Player discussion · resource priorities",
  },
  {
    title: "I keep losing expensive loadouts",
    category: "Economy",
    body: "Plan what you can afford to replace, not just what you can buy once. Reserve cash for ammunition, medical items and transport. Teamplay actions such as revives, transport and spotting also earn cash. Check current vendor prices before relying on an older loadout guide.",
    url: "https://metaforge.app/wardogs/wardogs-beginners-guide",
    source: "MetaForge · beginner guide",
  },
  {
    title: "My magazines or ammo do not fit",
    category: "Infantry",
    body: "Check both the magazine and ammunition compatibility with your weapon. Loose ammunition can refill compatible magazines, while backpack space limits what you can carry. Verify your kit at HQ before departing.",
    url: "https://metaforge.app/wardogs/wardogs-beginners-guide",
    source: "MetaForge · ammunition and inventory",
  },
  {
    title: "Where should we put a FOB?",
    category: "Planning",
    body: "Plan access for supply vehicles, cover for the crew and a route toward the objective. Mark the site and approach before spending supplies. Confirm the actual placement and build rules in-game; a map drawing cannot establish whether a location is valid.",
    url: "https://www.reddit.com/r/WarDogs/comments/1vwxp95/what_is_a_fob_and_how_does_it_work_a_fob_faq_for/",
    source: "Community FOB FAQ",
  },
];
export default function FieldGuide() {
  const [query, setQuery] = useState("");
  const results = entries.filter((e) =>
    `${e.title} ${e.body} ${e.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="field-guide">
      <div className="section-heading">
        <h2>Find a topic</h2>
        <span className="source-tag">Sep 5, 2026</span>
      </div>
      <p>
        Quick answers for the playtest. Community findings can change between
        builds.
      </p>
      <label className="guide-search">
        <Search size={16} />
        <input
          aria-label="Search field guide"
          placeholder="Ammo, FOB, coordinates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {results.map((e) => (
        <details className="guide-entry" key={e.title}>
          <summary>
            <span>{e.category}</span>
            {e.title}
          </summary>
          <p>{e.body}</p>
          <a
            href={e.url}
            target="_blank"
            rel="noreferrer"
            title="Open guide source"
          >
            {e.source}
            <ArrowUpRight size={13} />
          </a>
        </details>
      ))}
      {!results.length && (
        <p>No matching guide. Try “ammo”, “FOB” or “target”.</p>
      )}
      <div className="guide-links">
        <h2>Companion tools & updates</h2>
        <a
          href="https://store.steampowered.com/news/app/1867240"
          target="_blank"
          rel="noreferrer"
        >
          Official playtest news
          <ArrowUpRight size={14} />
        </a>
        <a
          href="https://wardogs-artillery.com/"
          target="_blank"
          rel="noreferrer"
        >
          Apollyon artillery & terrain
          <ArrowUpRight size={14} />
        </a>
        <a
          href="https://metaforge.app/wardogs"
          target="_blank"
          rel="noreferrer"
        >
          MetaForge equipment & loadouts
          <ArrowUpRight size={14} />
        </a>
        <a href="https://wardogshub.gg/map/" target="_blank" rel="noreferrer">
          Wardogs Hub map reference
          <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
