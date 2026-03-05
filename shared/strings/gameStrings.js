// client/src/strings/gameStrings.js
// Master catalog of every user-visible string in the game.
// Used by the String Sheets dev tool (/strings) for bulk export/import.
//
// Format per entry: { cat, key, default, tokens?, tags?, desc }
//   cat     — category for filtering (see STRING_CATEGORIES)
//   key     — unique dot-key matching its use in the codebase
//   default — the original hardcoded string
//   tokens  — optional dynamic placeholders present in the string
//   tags    — optional cross-cutting tag overrides (roles/events/items are auto-tagged by prefix)
//   desc    — where/how the string appears

export const STRING_CATALOG = [

  // ── Roles ──────────────────────────────────────────────────────────────────
  // server/definitions/roles.js — name, description, tip, detailedTip

  { cat: 'roles', key: 'villager.name',        default: 'Villager',             desc: 'Role display name' },
  { cat: 'roles', key: 'villager.description', default: 'A simple villager trying to survive.',  desc: 'Role flavor text on reveal slide' },
  { cat: 'roles', key: 'villager.tip',         default: 'Good luck!',           desc: 'Short tip on player terminal (role assignment)' },
  { cat: 'roles', key: 'villager.detailedTip', default: 'You have no special abilities. Good luck!', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'alpha.name',           default: 'Alpha Werewolf',       desc: 'Role display name' },
  { cat: 'roles', key: 'alpha.shortName',      default: 'Alpha',                desc: 'Compact name for space-constrained displays' },
  { cat: 'roles', key: 'alpha.description',    default: 'The pack leader who makes the final kill.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'alpha.detailedTip',    default: 'You are the pack leader. Each night, you choose who the wolves kill.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'werewolf.name',        default: 'Werewolf',             desc: 'Role display name' },
  { cat: 'roles', key: 'werewolf.description', default: 'A member of the pack who hunts for the Alpha.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'werewolf.detailedTip', default: 'You hunt with the pack. Each night, suggest a target — the Alpha makes the final call.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'seer.name',            default: 'Seer',                 desc: 'Role display name' },
  { cat: 'roles', key: 'seer.description',     default: 'Blessed with visions, you can peer into souls.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'seer.tip',             default: 'Investigate each night', desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'seer.detailedTip',     default: 'Each night, investigate one player to learn if they are a werewolf.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'doctor.name',          default: 'Doctor',               desc: 'Role display name' },
  { cat: 'roles', key: 'doctor.description',   default: 'Your medical expertise can save lives.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'doctor.tip',           default: 'Protect someone each night', desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'doctor.detailedTip',   default: 'Each night, choose one player to protect. You cannot choose the same target twice in a row.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'hunter.name',          default: 'Hunter',               desc: 'Role display name' },
  { cat: 'roles', key: 'hunter.description',   default: 'When you die, you take someone with you.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'hunter.tip',           default: 'Revenge shot on death', desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'hunter.detailedTip',   default: 'You have no night action, but when you die — by any cause — you take a revenge shot, killing one player of your choice. This trigger is automatic and cannot be prevented.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'vigilante.name',       default: 'Vigilante',            desc: 'Role display name' },
  { cat: 'roles', key: 'vigilante.description',default: 'You can kill one person during the night. Choose wisely.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'vigilante.tip',        default: 'One kill per game',    desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'vigilante.detailedTip',default: 'Once per game, you may kill a player at night. Use your one shot wisely.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'governor.name',        default: 'Governor',             desc: 'Role display name' },
  { cat: 'roles', key: 'governor.description', default: 'You can pardon someone from elimination after votes are cast.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'governor.tip',         default: 'Pardon the condemned', desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'governor.detailedTip', default: 'After a player is condemned by vote, you may pardon them — canceling the elimination. You have one pardon. Use it wiseley.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'cupid.name',           default: 'Cupid',                desc: 'Role display name' },
  { cat: 'roles', key: 'cupid.description',    default: 'You bind two souls together in love.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'cupid.tip',            default: 'Link two lovers',      desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'cupid.detailedTip',    default: 'At the start of the game, you link two players as lovers. If either dies, the other dies of heartbreak — regardless of team. Choose a pair that helps the village, or create chaos.', desc: 'Full tip on big-screen role slide' },
  { cat: 'roles', key: 'cupid.loverMsg',       default: 'You are in love with {name}. If they die, you die of heartbreak.', tokens: ['{name}'], tags: ['link'], desc: 'Private message sent to each lover on linking' },

  { cat: 'roles', key: 'roleblocker.name',     default: 'Roleblocker',          desc: 'Role display name' },
  { cat: 'roles', key: 'roleblocker.description', default: "You silence the night. Block one player's ability.", desc: 'Role flavor text' },
  { cat: 'roles', key: 'roleblocker.detailedTip', default: "Each night, choose a player to silence. Their night ability fails — and they won't know they were blocked. Neutralize the Doctor, Seer, or Vigilante at critical moments.", desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'poisoner.name',        default: 'Poisoner',             desc: 'Role display name' },
  { cat: 'roles', key: 'poisoner.description', default: "You replace the alpha's kill with a slow-acting poison.", desc: 'Role flavor text' },
  { cat: 'roles', key: 'poisoner.detailedTip', default: "Each night, choose YES to poison the alpha's target instead of killing them outright. They will die at the end of the following night. The doctor can cure them if they act in time.", desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'janitor.name',         default: 'Janitor',              desc: 'Role display name' },
  { cat: 'roles', key: 'janitor.description',  default: "You clean up after the kill. The victim's role stays hidden.", desc: 'Role flavor text' },
  { cat: 'roles', key: 'janitor.detailedTip',  default: "Each night, choose whether to clean up. If you say YES and the Alpha kills, the victim's role stays hidden from everyone until the game ends. Use this to protect your pack from the Seer's deductions.", desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'tanner.name',          default: 'Tanner',               desc: 'Role display name' },
  { cat: 'roles', key: 'tanner.description',   default: 'A simple villager... or so you think.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'tanner.tip',           default: 'Good luck!',           desc: 'Short tip on player terminal (disguised as Villager)' },
  { cat: 'roles', key: 'tanner.detailedTip',   default: 'You appear as a Villager to everyone — even yourself. But the Seer sees you as evil. Win with the village anyway.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'jester.name',          default: 'Jester',               desc: 'Role display name' },
  { cat: 'roles', key: 'jester.description',   default: 'Make them vote you out. Win by being eliminated.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'jester.tip',           default: 'Get voted out to win', desc: 'Short tip on player terminal' },
  { cat: 'roles', key: 'jester.detailedTip',   default: 'You win if the village eliminates you by vote. Death by any other means is a loss. If you win, the game continues without you.', desc: 'Full tip on big-screen role slide' },
  { cat: 'roles', key: 'jester.winMsg',        default: '{name} was the Jester — they win!', tokens: ['{name}'], desc: 'Host log message when Jester wins' },

  { cat: 'roles', key: 'drunk.name',           default: 'Drunk',                desc: 'Role display name' },
  { cat: 'roles', key: 'drunk.description',    default: 'You think you can see the truth — but you are just drunk.', desc: 'Role flavor text' },
  { cat: 'roles', key: 'drunk.tip',            default: 'Investigate each night', desc: 'Short tip on player terminal (disguised as Seer)' },
  { cat: 'roles', key: 'drunk.detailedTip',    default: 'Each night the Drunk picks a target, believing they are investigating. In reality their action is randomly one of: Investigate (accurate result), Kill, Protect, or Roleblock. The three non-investigate actions always show INNOCENT regardless of the target.', desc: 'Full tip on big-screen role slide' },

  { cat: 'roles', key: 'alpha.promoteMsg',     default: '{name} becomes the new Alpha!', tokens: ['{name}'], tags: ['werewolf'], desc: 'Host log when a werewolf is promoted to Alpha on death' },

  // ── Items ──────────────────────────────────────────────────────────────────
  // server/definitions/items.js

  { cat: 'items', key: 'pistol.name',          default: 'Pistol',               desc: 'Item display name' },
  { cat: 'items', key: 'pistol.description',   default: 'A deadly weapon. One shot. Make it count.', desc: 'Item description shown to holder' },

  { cat: 'items', key: 'phone.name',           default: 'Phone',                desc: 'Item display name' },
  { cat: 'items', key: 'phone.description',    default: 'Call the governor for a one-time pardon. Use it wisely.', desc: 'Item description shown to holder' },

  { cat: 'items', key: 'clue.name',            default: 'Clue',                 desc: 'Item display name' },
  { cat: 'items', key: 'clue.description',     default: 'A mysterious lead. Investigate one player to learn their alignment.', desc: 'Item description shown to holder' },

  { cat: 'items', key: 'coward.name',          default: "The Coward's Way Out", desc: 'Item display name' },
  { cat: 'items', key: 'coward.shortName',     default: 'Coward',               desc: 'Compact item name' },
  { cat: 'items', key: 'coward.description',   default: 'You hide from danger. No attacks can reach you — but you cannot act.', desc: 'Item description shown to holder' },

  { cat: 'items', key: 'barricade.name',       default: 'Barricade',            desc: 'Item display name' },
  { cat: 'items', key: 'barricade.description',default: 'A sturdy defense. The next time you would die, the barricade breaks instead.', desc: 'Item description shown to holder' },

  // ── Events ─────────────────────────────────────────────────────────────────
  // server/definitions/events.js — name, description shown to player on their terminal

  { cat: 'events', key: 'vote.name',           default: 'Vote',                 desc: 'Event name in host panel and logs' },
  { cat: 'events', key: 'vote.description',    default: 'Choose who to eliminate.', desc: 'Prompt shown on player terminal during event' },

  { cat: 'events', key: 'kill.name',           default: 'Kill',                 desc: 'Event name' },
  { cat: 'events', key: 'kill.description',    default: 'Choose your victim.',  desc: 'Prompt shown to Alpha on terminal' },

  { cat: 'events', key: 'hunt.name',           default: 'Hunt',                 desc: 'Event name' },
  { cat: 'events', key: 'hunt.description',    default: 'Suggest a target for the Alpha to hunt.', desc: 'Prompt shown to Werewolf on terminal' },

  { cat: 'events', key: 'investigate.name',    default: 'Investigate',          desc: 'Event name' },
  { cat: 'events', key: 'investigate.description', default: 'Choose someone to investigate.', desc: 'Prompt shown to Seer on terminal' },
  { cat: 'events', key: 'investigate.resultEvil',   default: '{name} is EVIL',      tokens: ['{name}'], tags: ['seer'], desc: 'Private result message to Seer — target is werewolf' },
  { cat: 'events', key: 'investigate.resultInnocent', default: '{name} is INNOCENT', tokens: ['{name}'], tags: ['seer'], desc: 'Private result message to Seer — target is innocent' },

  { cat: 'events', key: 'stumble.name',        default: 'Stumble',              desc: 'Event name (Drunk\'s investigate)' },
  { cat: 'events', key: 'stumble.description', default: 'Choose someone to investigate.', desc: 'Prompt shown to Drunk — they think they are a Seer' },

  { cat: 'events', key: 'protect.name',        default: 'Protect',              desc: 'Event name' },
  { cat: 'events', key: 'protect.description', default: 'Choose someone to protect tonight.', desc: 'Prompt shown to Doctor on terminal' },
  { cat: 'events', key: 'protect.privateMsg',  default: 'You are protecting {name} tonight.', tokens: ['{name}'], tags: ['doctor'], desc: 'Private confirmation to Doctor after selection' },

  { cat: 'events', key: 'block.name',          default: 'Block',                desc: 'Event name' },
  { cat: 'events', key: 'block.description',   default: 'Choose a player to block tonight.', desc: 'Prompt shown to Roleblocker on terminal' },

  { cat: 'events', key: 'vigil.name',          default: 'Kill',                 desc: 'Event name (Vigilante kill)' },
  { cat: 'events', key: 'vigil.description',   default: 'Choose someone to eliminate. This is your only shot.', desc: 'Prompt shown to Vigilante on terminal' },

  { cat: 'events', key: 'poison.name',         default: 'Poison',               desc: 'Event name' },
  { cat: 'events', key: 'poison.description',  default: "Use your poison on the alpha's target instead of a direct kill?", desc: 'Prompt shown to Poisoner on terminal' },

  { cat: 'events', key: 'clean.name',          default: 'Clean',                desc: 'Event name' },
  { cat: 'events', key: 'clean.description',   default: 'Clean up after the kill?', desc: 'Prompt shown to Janitor on terminal' },

  { cat: 'events', key: 'shoot.name',          default: 'Shoot',                desc: 'Event name (pistol)' },
  { cat: 'events', key: 'shoot.description',   default: 'Use your pistol to shoot someone.', desc: 'Prompt shown to pistol holder on terminal' },

  { cat: 'events', key: 'suspect.name',        default: 'Suspect',              desc: 'Event name' },
  { cat: 'events', key: 'suspect.description', default: 'Who do you think is a werewolf?', desc: 'Prompt shown to Villager/Hunter/etc on terminal during night' },

  { cat: 'events', key: 'link.name',           default: 'Link',                 desc: 'Event name (Cupid)' },

  { cat: 'events', key: 'customEvent.name',    default: 'Custom Event',         desc: 'Host custom event name' },
  { cat: 'events', key: 'customEvent.description', default: 'Vote for a custom reward.', desc: 'Default description for custom event' },

  { cat: 'events', key: 'hunterRevenge.name',  default: "Hunter's Revenge",     desc: 'Flow event name' },
  { cat: 'events', key: 'hunterRevenge.description', default: 'Choose who to take with you.', desc: 'Prompt shown to Hunter on terminal' },

  { cat: 'events', key: 'governorPardon.name', default: 'Governor Pardon',      desc: 'Flow event name' },
  { cat: 'events', key: 'governorPardon.description', default: 'Will you pardon this player from elimination?', desc: 'Prompt shown to Governor on terminal' },

  // ── Slide strings — phase transitions ──────────────────────────────────────
  // Game.js — gallery slides generated on phase changes

  { cat: 'slides', key: 'phase.day1.title',      default: 'DAY 1',              desc: 'Gallery slide title at game start' },
  { cat: 'slides', key: 'phase.day1.subtitle',   default: 'The game begins.',   desc: 'Gallery slide subtitle at game start' },
  { cat: 'slides', key: 'phase.dayN.title',      default: 'DAY {n}',            tokens: ['{n}'], desc: 'Gallery slide title for Day 2+' },
  { cat: 'slides', key: 'phase.dayN.subtitle',   default: 'The sun rises.',     desc: 'Gallery slide subtitle for Day 2+' },
  { cat: 'slides', key: 'phase.nightN.title',    default: 'NIGHT {n}',          tokens: ['{n}'], desc: 'Gallery slide title for Night' },
  { cat: 'slides', key: 'phase.nightN.subtitle', default: 'Close your eyes... just kidding.', desc: 'Gallery slide subtitle for Night' },
  { cat: 'slides', key: 'phase.lobby.title',     default: 'LOBBY',              desc: 'Gallery slide title when no game is active' },
  { cat: 'slides', key: 'phase.lobby.subtitle',  default: 'Waiting for game to start', desc: 'Gallery slide subtitle in lobby' },
  { cat: 'slides', key: 'phase.timePasses.title',    default: '🌙 TIME PASSES', desc: 'Slide shown between phases' },
  { cat: 'slides', key: 'phase.timePasses.subtitle', default: 'Tensions are rising', desc: 'Subtitle for time-passes transition slide' },

  // ── Slide strings — deaths ─────────────────────────────────────────────────
  // Game.js createDeathSlide() — title per cause

  { cat: 'slides', key: 'death.teamVillager',   default: 'VILLAGER',            desc: 'Team prefix on death slide title (village role)' },
  { cat: 'slides', key: 'death.teamWerewolf',   default: 'WEREWOLF',            desc: 'Team prefix on death slide title (werewolf role)' },
  { cat: 'slides', key: 'death.teamNeutral',    default: 'INDEPENDENT',         desc: 'Team prefix on death slide title (neutral role)' },
  { cat: 'slides', key: 'death.teamUnknown',    default: 'PLAYER',              desc: 'Team prefix on death slide title (cleaned/unknown)' },
  { cat: 'slides', key: 'death.teamJester',    default: 'JESTER',              desc: 'Team prefix on death slide title for Jester role' },
  { cat: 'slides', key: 'death.suffixEliminated', default: 'ELIMINATED',        desc: 'Suffix appended to team name: "{TEAM} ELIMINATED"' },
  { cat: 'slides', key: 'death.suffixKilled',   default: 'KILLED',              desc: 'Suffix appended to team name: "{TEAM} KILLED"' },
  { cat: 'slides', key: 'death.suffixHeartbroken', default: 'HEARTBROKEN',      desc: 'Suffix for heartbreak death: "{TEAM} HEARTBROKEN"' },
  { cat: 'slides', key: 'death.suffixRemoved',  default: 'REMOVED',             desc: 'Suffix for host removal: "{TEAM} REMOVED"' },
  { cat: 'slides', key: 'death.suffixPoisoned', default: 'POISONED',            desc: 'Suffix for poison death: "{TEAM} POISONED"' },
  { cat: 'slides', key: 'death.suffixDead',     default: 'DEAD',                desc: 'Fallback suffix: "{TEAM} DEAD"' },
  { cat: 'slides', key: 'death.subtitleShot',   default: '{name} was shot',     tokens: ['{name}'], desc: 'Death slide subtitle — killed by pistol' },
  { cat: 'slides', key: 'death.subtitleHunter', default: '{name} was killed',   tokens: ['{name}'], desc: 'Death slide subtitle — killed by Hunter revenge' },
  { cat: 'slides', key: 'death.subtitleHeartbreak', default: '{name} died of a broken heart', tokens: ['{name}'], desc: 'Death slide subtitle — heartbreak death' },
  { cat: 'slides', key: 'death.subtitleHost',   default: '{name} was removed by the host', tokens: ['{name}'], desc: 'Death slide subtitle — host removal' },
  { cat: 'slides', key: 'death.subtitlePoison', default: '{name} succumbed to poison', tokens: ['{name}'], desc: 'Death slide subtitle — poison death' },
  { cat: 'slides', key: 'death.cowardTitle',    default: 'HAS TAKEN THE COWARD\'S WAY OUT', tags: ['coward'], desc: 'Subtitle on coward slide (title is player name)' },

  // ── Slide strings — vote ───────────────────────────────────────────────────

  { cat: 'slides', key: 'vote.slideTitle',       default: 'ELIMINATION VOTE',   tags: ['vote'], desc: 'Gallery slide title when vote starts' },
  { cat: 'slides', key: 'vote.slideSubtitle',    default: 'Choose who to eliminate', tags: ['vote'], desc: 'Gallery slide subtitle when vote starts' },
  { cat: 'slides', key: 'vote.tallyTitle',       default: 'VOTES',              tags: ['vote'], desc: 'Vote tally slide title (clear winner)' },
  { cat: 'slides', key: 'vote.tallyTitleTied',   default: 'VOTES TIED',         tags: ['vote'], desc: 'Vote tally slide title (tie)' },
  { cat: 'slides', key: 'vote.runoffTitle',      default: 'RUNOFF VOTE #{n}',   tokens: ['{n}'], tags: ['vote'], desc: 'Gallery slide title during runoff vote' },
  { cat: 'slides', key: 'vote.subtitleRunoff',   default: 'Tiebreaker vote starting soon', tags: ['vote'], desc: 'Tally slide subtitle before runoff' },
  { cat: 'slides', key: 'vote.subtitleRandom',   default: 'Selecting random frontrunner', tags: ['vote'], desc: 'Tally slide subtitle on random tiebreak' },
  { cat: 'slides', key: 'vote.noElimTitle',      default: 'NO ELIMINATION',     tags: ['vote'], desc: 'Title slide when no votes cast' },
  { cat: 'slides', key: 'vote.noElimSubtitle',   default: 'The village could not decide.', tags: ['vote'], desc: 'Subtitle for no-elimination slide' },
  { cat: 'slides', key: 'vote.customTitle',      default: 'CUSTOM VOTE',        tags: ['customEvent'], desc: 'Gallery slide title for custom event vote' },
  { cat: 'slides', key: 'vote.customResultTitle',default: 'CUSTOM EVENT RESULT', tags: ['customEvent'], desc: 'Player reveal slide title for custom event winner' },
  { cat: 'slides', key: 'vote.noWinnerTitle',    default: 'NO WINNER',          tags: ['customEvent'], desc: 'Slide title when custom event gets no votes' },
  { cat: 'slides', key: 'vote.subtitleSelected',   default: '{name} has been selected', tokens: ['{name}'], tags: ['vote'], desc: 'Vote tally subtitle when a player is condemned/selected' },
  { cat: 'slides', key: 'vote.subtitleNoSelection', default: 'No one was selected',    tags: ['vote'], desc: 'Vote tally subtitle when no selection was made' },
  { cat: 'slides', key: 'vote.subtitleDefault',    default: '{count} candidates received votes', tokens: ['{count}'], tags: ['vote'], desc: 'Vote tally fallback subtitle' },

  // ── Slide strings — victory ────────────────────────────────────────────────

  { cat: 'slides', key: 'victory.villagerName',  default: 'VILLAGERS',          desc: 'Winner name used in "VILLAGERS WIN"' },
  { cat: 'slides', key: 'victory.werewolfName',  default: 'WEREWOLVES',         desc: 'Winner name used in "WEREWOLVES WIN"' },
  { cat: 'slides', key: 'victory.villageSubtitle', default: 'All werewolves have been eliminated.', desc: 'Victory subtitle for village win' },
  { cat: 'slides', key: 'victory.werewolfSubtitle', default: 'The werewolves have taken over.', desc: 'Victory subtitle for werewolf win' },

  // ── Slide strings — flows ──────────────────────────────────────────────────

  { cat: 'slides', key: 'flow.hunterTitle',      default: "HUNTER'S REVENGE",   tags: ['hunter', 'hunterRevenge'], desc: 'Slide title when Hunter dies and picks revenge target' },
  { cat: 'slides', key: 'flow.hunterSubtitle',   default: '{name} is choosing a target with their dying breath...', tokens: ['{name}'], tags: ['hunter', 'hunterRevenge'], desc: 'Subtitle on Hunter revenge slide' },
  { cat: 'slides', key: 'flow.condemnedTitle',   default: 'CONDEMNED',          tags: ['governor', 'governorPardon', 'vote'], desc: 'Slide title shown while waiting for Governor' },
  { cat: 'slides', key: 'flow.condemnedSubtitle',default: 'Calling the governor...', tags: ['governor', 'governorPardon'], desc: 'Subtitle while Governor decides' },
  { cat: 'slides', key: 'flow.pardonedTitle',    default: 'PARDONED',           tags: ['governor', 'governorPardon'], desc: 'Slide title when Governor pardons condemned player' },
  { cat: 'slides', key: 'flow.pardonedSubtitle', default: '{name} was not eliminated', tokens: ['{name}'], tags: ['governor', 'governorPardon'], desc: 'Subtitle when player is pardoned' },
  { cat: 'slides', key: 'flow.noPardonTitle',    default: 'NO PARDON',          tags: ['governor', 'governorPardon'], desc: 'Slide title when Governor does not pardon' },
  { cat: 'slides', key: 'flow.noPardonSubtitle', default: "{name}'s fate is sealed", tokens: ['{name}'], tags: ['governor', 'governorPardon'], desc: 'Subtitle when Governor refuses pardon' },

  // ── Slide strings — misc ───────────────────────────────────────────────────

  { cat: 'slides', key: 'misc.drawTitle',        default: 'DRAW!',              tags: ['shoot', 'pistol'], desc: 'Slide title when player draws the pistol' },
  { cat: 'slides', key: 'misc.drawSubtitle',     default: '{name} is searching for a target...', tokens: ['{name}'], tags: ['shoot', 'pistol'], desc: 'Subtitle while pistol holder picks target' },
  { cat: 'slides', key: 'misc.noShotsTitle',     default: 'NO SHOTS FIRED',     tags: ['shoot', 'pistol'], desc: 'Slide title when pistol holder abstains' },
  { cat: 'slides', key: 'misc.noShotsSubtitle',  default: '{name} is keeping their powder dry... for now.', tokens: ['{name}'], tags: ['shoot', 'pistol'], desc: 'Subtitle when pistol holder does not shoot' },
  { cat: 'slides', key: 'misc.timesUpTitle',     default: "TIME'S UP",          tags: ['timer'], desc: "Slide title when event timer expires" },
  { cat: 'slides', key: 'misc.timesUpSubtitle',  default: "Confirm your selection before it's too late.", tags: ['timer'], desc: 'Subtitle when timer expires' },
  { cat: 'slides', key: 'misc.operatorTitle',    default: 'A MESSAGE FROM BEYOND...', desc: 'Eyebrow label on operator word-reveal slide' },
  { cat: 'slides', key: 'misc.compositionTitle', default: 'ASSIGNED ROLES',     tags: ['phase'], desc: 'Composition slide title shown after role assignment' },
  { cat: 'slides', key: 'misc.roleTipTitle',     default: 'NEW ROLE',           desc: 'Role tip slide title (pushed by host tutorials)' },
  { cat: 'slides', key: 'misc.itemTipTitle',     default: 'ITEM',               desc: 'Item tip slide title (pushed by host tutorials)' },
  { cat: 'slides', key: 'misc.scoreboardTitle',  default: 'SCOREBOARD',         desc: 'Scores slide title when pushed by host' },
  { cat: 'slides', key: 'misc.bpmSpike.title',   default: '{name} CARES TOO MUCH', tokens: ['{name}'], tags: ['heartbeat'], desc: 'Heartbeat spike slide title — player loses vote' },
  { cat: 'slides', key: 'misc.bpmSpike.subtitle',default: 'loses their vote till tomorrow', tags: ['heartbeat'], desc: 'Heartbeat spike slide subtitle' },
  { cat: 'slides', key: 'misc.janitorReveal',    default: 'Good cleanup work',  tags: ['janitor', 'clean'], desc: 'revealText shown on death slide when Janitor cleaned the kill' },

  // ── Slide labels — team/badge text on slides ───────────────────────────────

  { cat: 'screen', key: 'fallback.title',         default: 'MURDERHOUSE',            desc: 'Lobby screen main title' },
  { cat: 'screen', key: 'fallback.players',        default: '{n} players connected',  tokens: ['{n}'], desc: 'Player count line in lobby' },
  { cat: 'screen', key: 'fallback.day',            default: 'DAY',                    desc: 'Day phase label in fallback gallery (e.g. "DAY 2")' },
  { cat: 'screen', key: 'fallback.night',          default: 'NIGHT',                  desc: 'Night phase label in fallback gallery' },
  { cat: 'screen', key: 'gallery.werewolf',        default: 'WEREWOLF',               tags: ['werewolf', 'hunt', 'kill'], desc: 'Anonymous werewolf placeholder in tracker' },
  { cat: 'screen', key: 'gallery.coward',          default: 'COWARD',                 tags: ['coward'], desc: 'Coward badge in player gallery' },
  { cat: 'screen', key: 'gallery.mad',             default: 'MAD',                    tags: ['heartbeat'], desc: 'Mad badge (no-vote) in player gallery' },
  { cat: 'screen', key: 'scores.title',            default: 'SCOREBOARD',             desc: 'Scores slide header title' },
  { cat: 'screen', key: 'scores.empty',            default: 'No scores yet',           desc: 'Scores slide empty state' },
  { cat: 'screen', key: 'death.eliminated',         default: 'ELIMINATED',             desc: 'Fallback title on death slide (when no slide.title set)' },
  { cat: 'screen', key: 'death.coward',             default: 'COWARD',                 tags: ['coward'], desc: 'Badge on coward variant death slide' },
  { cat: 'screen', key: 'death.mad',                default: 'MAD',                    tags: ['heartbeat'], desc: 'No-vote badge on death slide' },
  { cat: 'screen', key: 'heartbeat.bpm',           default: 'BPM',                    tags: ['heartbeat'], desc: 'BPM unit label on heartbeat slide' },
  { cat: 'screen', key: 'heartbeat.signalLost',    default: 'SIGNAL LOST',            tags: ['heartbeat'], desc: 'Overlay text when heartbeat inactive' },
  { cat: 'screen', key: 'heartbeat.debug',         default: 'DEBUG',                  tags: ['heartbeat'], desc: 'Badge on simulated heartbeat' },
  { cat: 'screen', key: 'composition.unassigned',  default: 'Unassigned',             tags: ['phase'], desc: 'Label for unassigned role slots in composition slide' },
  { cat: 'screen', key: 'roleTip.werewolf',        default: 'WEREWOLF',               desc: 'Team badge label for werewolf roles on role tip slide' },
  { cat: 'screen', key: 'roleTip.independent',     default: 'INDEPENDENT',            desc: 'Team badge label for neutral/independent roles' },
  { cat: 'screen', key: 'roleTip.village',         default: 'VILLAGE',                desc: 'Team badge label for village roles' },
  { cat: 'screen', key: 'roleTip.passive',         default: 'PASSIVE',                desc: 'Usage badge for passive items' },
  { cat: 'screen', key: 'roleTip.singleUse',       default: 'SINGLE USE',             desc: 'Usage badge for one-shot items' },
  { cat: 'screen', key: 'roleTip.uses',            default: 'USES',                   desc: 'Usage badge suffix for multi-use items (e.g. "3 USES")' },

  // ── Player feedback (private terminal messages) ───────────────────────────
  // Strings sent back to individual player terminals after events resolve

  { cat: 'feedback', key: 'barricade.broken',   default: 'BARRICADE BROKEN',    tags: ['barricade'], desc: 'Line 2 on player terminal when barricade absorbs an attack' },
  { cat: 'feedback', key: 'barricade.detail',   default: 'You are on your own now', tags: ['barricade'], desc: 'Line 3 on player terminal after barricade breaks' },
  { cat: 'feedback', key: 'prospect.changed',   default: 'TEAM CHANGED',        tags: ['werewolf'], desc: 'Line 2 on player terminal when Prospect item recruits them' },
  { cat: 'feedback', key: 'prospect.detail',    default: 'You were recruited by the wolves', tags: ['werewolf'], desc: 'Line 3 on player terminal after recruitment' },

  // ── Terminal (TinyScreen / ESP32 OLED) ─────────────────────────────────────

  { cat: 'terminal', key: 'connecting',          default: 'CONNECTING',          desc: 'Line 1 before WebSocket connects' },
  { cat: 'terminal', key: 'pleaseWait',          default: 'Please wait',         desc: 'Line 3 while connecting' },

  // ── Player page ────────────────────────────────────────────────────────────

  { cat: 'player', key: 'online',               default: '● ONLINE',             desc: 'Connection badge when connected' },
  { cat: 'player', key: 'offline',              default: '○ OFFLINE',            desc: 'Connection badge when disconnected' },
  { cat: 'player', key: 'buttonYes',            default: 'YES',                  desc: 'Primary confirm button label' },
  { cat: 'player', key: 'buttonNo',             default: 'NO',                   desc: 'Cancel / no button label' },

  // ── Host dashboard ─────────────────────────────────────────────────────────

  { cat: 'host', key: 'startGame',              default: 'Start Game',           desc: 'Button to start the game from lobby' },
  { cat: 'host', key: 'shuffleRoles',           default: 'Shuffle Roles',        desc: 'Button to randomise role assignments' },
  { cat: 'host', key: 'nextPhase',              default: 'Next Phase',           desc: 'Button to advance to next day/night phase' },
  { cat: 'host', key: 'reset',                  default: 'Reset',                desc: 'Button to reset the game' },
  { cat: 'host', key: 'noMessage',              default: 'no message',           desc: 'Operator panel empty state' },
  { cat: 'host', key: 'resetConfirm',           default: 'Reset the game? This cannot be undone.', desc: 'Confirm dialog for game reset' },
  { cat: 'host', key: 'removePlayerConfirm',    default: 'Remove this player?',  desc: 'Confirm dialog when removing a player' },

  // ── Host log messages ──────────────────────────────────────────────────────
  // Game.js addLog() calls visible in the host history panel

  { cat: 'log', key: 'gameStarted',             default: 'Game started — Day 1', desc: 'Log entry when game starts' },
  { cat: 'log', key: 'rolesRandomized',         default: 'Roles randomized',     desc: 'Log entry when roles are shuffled' },
  { cat: 'log', key: 'compositionPushed',       default: 'Composition slide pushed', desc: 'Log entry when composition slide is sent' },
  { cat: 'log', key: 'playerJoined',            default: '{name} joined via {via}', tokens: ['{name}', '{via}'], desc: 'Log entry when player connects' },
  { cat: 'log', key: 'playerLeft',              default: '{name} left',          tokens: ['{name}'], desc: 'Log entry when player disconnects' },
  { cat: 'log', key: 'playerReconnected',       default: '{name} reconnected via {via}', tokens: ['{name}', '{via}'], desc: 'Log entry on reconnect' },
  { cat: 'log', key: 'playerRevived',           default: '{name} revived',       tokens: ['{name}'], desc: 'Log entry when a player is revived' },
  { cat: 'log', key: 'playerRecruited',         default: '{name} was recruited by the werewolves', tokens: ['{name}'], tags: ['werewolf'], desc: 'Log entry when Prospect converts' },
  { cat: 'log', key: 'playerDiedPoison',        default: '{name} died from poison', tokens: ['{name}'], tags: ['poisoner', 'poison'], desc: 'Log entry for poison death' },
  { cat: 'log', key: 'playerDiedHeartbreak',    default: '{name} died of heartbreak', tokens: ['{name}'], tags: ['cupid', 'link'], desc: 'Log entry for heartbreak death' },
  { cat: 'log', key: 'playerSavedPoison',       default: '{name} was saved from poison by the Doctor', tokens: ['{name}'], tags: ['poisoner', 'poison', 'protect', 'doctor'], desc: 'Log when Doctor cures poison' },
  { cat: 'log', key: 'barricadeAbsorbed',       default: "{name}'s barricade absorbed the attack", tokens: ['{name}'], tags: ['barricade'], desc: 'Log when barricade activates' },
  { cat: 'log', key: 'bpmPanicked',             default: '{name} panicked! BPM {bpm} (threshold {threshold}) — vote lost', tokens: ['{name}', '{bpm}', '{threshold}'], tags: ['heartbeat'], desc: 'Log when heartbeat spike costs player their vote' },
  { cat: 'log', key: 'gameOver',                default: 'Game over — {winners} win!', tokens: ['{winners}'], desc: 'Log entry when game ends' },
  { cat: 'log', key: 'nightBegins',             default: 'Night {n} begins',     tokens: ['{n}'], desc: 'Log entry for night start' },
  { cat: 'log', key: 'dayBegins',               default: 'Day {n} begins',       tokens: ['{n}'], desc: 'Log entry for day start' },

  // Connection / session logs
  { cat: 'log', key: 'terminalConnected',       default: '{name} terminal connected', tokens: ['{name}'], desc: 'Log when an ESP32 terminal connects for a player' },
  { cat: 'log', key: 'gameStartError',          default: 'Cannot start: {error}', tokens: ['{error}'], desc: 'Log when game start validation fails' },

  // Preset management logs
  { cat: 'log', key: 'presetUpdated',           default: 'Updated game preset: {name}', tokens: ['{name}'], desc: 'Log when a preset is updated in place' },
  { cat: 'log', key: 'presetSaved',             default: 'Saved game preset: {name}',   tokens: ['{name}'], desc: 'Log when a new preset is created' },
  { cat: 'log', key: 'presetLoaded',            default: 'Loaded game preset: {name}',  tokens: ['{name}'], desc: 'Log when a preset is loaded' },
  { cat: 'log', key: 'presetDeleted',           default: 'Deleted game preset: {name}', tokens: ['{name}'], desc: 'Log when a preset is deleted' },

  // Event lifecycle logs
  { cat: 'log', key: 'eventStarted',            default: '{name} started',      tokens: ['{name}'], desc: 'Log when any event starts' },
  { cat: 'log', key: 'runoffRound',             default: '{name} runoff — Round {round}', tokens: ['{name}', '{round}'], desc: 'Log when a vote runoff round starts' },
  { cat: 'log', key: 'timerStarted',            default: 'Timer started for {count} event(s)', tokens: ['{count}'], desc: 'Log when host starts an event countdown' },
  { cat: 'log', key: 'eventSkipped',            default: '{name} skipped', tokens: ['{name}'], desc: 'Log when host skips a pending event' },
  { cat: 'log', key: 'eventReset',              default: '{name} reset',   tokens: ['{name}'], desc: 'Log when host resets an event to pending' },
  { cat: 'log', key: 'poisonerActing',          default: 'Poisoner is using their poison tonight', desc: 'Log when poisoner acts this night' },
  { cat: 'log', key: 'janitorActing',           default: 'Janitor is cleaning up tonight', desc: 'Log when janitor acts this night' },
  { cat: 'log', key: 'stumbleCompleted',        default: 'Stumble investigation completed', desc: 'Log when drunk stumble-investigates' },
  { cat: 'log', key: 'roleTipPushed',           default: 'Role tip slide pushed: {role}', tokens: ['{role}'], desc: 'Log when host pushes a role tutorial slide' },
  { cat: 'log', key: 'itemTipPushed',           default: 'Item tip slide pushed: {item}', tokens: ['{item}'], desc: 'Log when host pushes an item tutorial slide' },
  { cat: 'log', key: 'customEventStarted',      default: 'Custom event started — {description}', tokens: ['{description}'], tags: ['customEvent'], desc: 'Log when host creates a custom vote' },

  // Vote / runoff logs
  { cat: 'log', key: 'voteEliminated',          default: '{name} was eliminated.', tokens: ['{name}'], tags: ['vote'], desc: 'Log when vote removes a player' },
  { cat: 'log', key: 'voteNoElimination',       default: 'No one was eliminated.', tags: ['vote'], desc: 'Log when vote ends with no consensus' },
  { cat: 'log', key: 'voteRunoffStarted',       default: '{event} tied. Starting runoff with {count} candidates.', tokens: ['{event}', '{count}'], tags: ['vote'], desc: 'Log when a vote tie triggers a runoff round' },
  { cat: 'log', key: 'voteRandomSelected',      default: 'After multiple runoffs, {name} was randomly selected for elimination.', tokens: ['{name}'], tags: ['vote'], desc: 'Log when runoff ties are broken randomly' },

  // Night action resolution logs
  { cat: 'log', key: 'killedByWolves',          default: '{name} was killed by werewolves', tokens: ['{name}'], tags: ['kill', 'alpha', 'werewolf'], desc: 'Log when alpha kill succeeds' },
  { cat: 'log', key: 'killProtected',           default: '{name} was protected', tokens: ['{name}'], tags: ['kill', 'protect', 'doctor'], desc: 'Log when alpha kill is blocked by doctor' },
  { cat: 'log', key: 'poisonedPlayer',          default: '{name} was poisoned', tokens: ['{name}'], tags: ['poisoner', 'poison'], desc: 'Log when poisoner applies delayed kill' },
  { cat: 'log', key: 'vigilanteShoots',         default: '{name} shot {target}', tokens: ['{name}', '{target}'], tags: ['vigil', 'vigilante'], desc: 'Log when vigilante uses their kill' },
  { cat: 'log', key: 'vigilanteProtected',      default: '{name} was protected', tokens: ['{name}'], tags: ['vigil', 'vigilante', 'protect', 'doctor'], desc: 'Log when vigilante kill is blocked by doctor' },
  { cat: 'log', key: 'shooterShoots',           default: '{name} shot {target}', tokens: ['{name}', '{target}'], tags: ['shoot', 'pistol'], desc: 'Log when pistol holder fires' },
  { cat: 'log', key: 'shooterAbstains',         default: '{name} chose not to shoot', tokens: ['{name}'], tags: ['shoot', 'pistol'], desc: 'Log when pistol holder abstains' },
  { cat: 'log', key: 'doctorProtected',         default: '{doctor} protected {target}', tokens: ['{doctor}', '{target}'], tags: ['protect', 'doctor'], desc: 'Log when doctor chooses a target' },
  { cat: 'log', key: 'roleblockerBlocked',      default: '{blocker} blocked {target}',  tokens: ['{blocker}', '{target}'], tags: ['block', 'roleblocker'], desc: 'Log when roleblocker silences a player' },
  { cat: 'log', key: 'seerInvestigated',        default: '{seer} learned {target} is {result}', tokens: ['{seer}', '{target}', '{result}'], tags: ['investigate', 'seer'], desc: 'Log when seer investigates (host-visible)' },
  { cat: 'log', key: 'drunkRolled',             default: '🥴 {name} (Drunk) rolled: {action} → {target}', tokens: ['{name}', '{action}', '{target}'], tags: ['stumble', 'drunk'], desc: 'Log for drunk\'s random night action' },
  { cat: 'log', key: 'hunterSuspected',         default: '{name} suspects {target}', tokens: ['{name}', '{target}'], tags: ['suspect', 'hunter'], desc: 'Log when hunter/villager records a suspicion' },
  { cat: 'log', key: 'werewolfSuggested',       default: '{name} suggested {target}', tokens: ['{name}', '{target}'], tags: ['hunt', 'werewolf'], desc: 'Log when a werewolf suggests a kill target' },

  // Custom event resolution logs
  { cat: 'log', key: 'customReward',            default: '{name} received {reward}!',    tokens: ['{name}', '{reward}'], tags: ['customEvent'], desc: 'Log when custom vote winner gets an item' },
  { cat: 'log', key: 'customRoleChange',        default: '{name} became {role}!',        tokens: ['{name}', '{role}'],   tags: ['customEvent'], desc: 'Log when custom vote changes winner\'s role' },
  { cat: 'log', key: 'customRevived',           default: '{name} was resurrected!',      tokens: ['{name}'], tags: ['customEvent'], desc: 'Log when custom vote revives a dead player' },
  { cat: 'log', key: 'customNoVotes',           default: 'No votes were cast.',          tags: ['customEvent'], desc: 'Log when custom vote gets no responses' },

  // Host-action logs (server/handlers/index.js)
  { cat: 'log', key: 'roleChanged',             default: '{name} role changed: {old} → {new}', tokens: ['{name}', '{old}', '{new}'], desc: 'Log when host manually changes a player\'s role' },
  { cat: 'log', key: 'killedByHost',            default: '{name} killed by host',        tokens: ['{name}'], desc: 'Log when host manually kills a player' },
  { cat: 'log', key: 'itemRemoved',             default: '{name} lost {item}',           tokens: ['{name}', '{item}'], desc: 'Log when host removes an item from a player' },
  { cat: 'log', key: 'itemGiven',               default: '{name} received {item}',       tokens: ['{name}', '{item}'], desc: 'Log when host gives an item to a player' },

  // Role passive death logs
  { cat: 'log', key: 'alphaPromoted',           default: '{name} becomes the new Alpha!', tokens: ['{name}'], tags: ['alpha', 'werewolf'], desc: 'Log when a werewolf is promoted to Alpha on Alpha death' },
  { cat: 'log', key: 'jesterWins',              default: '{name} was the Jester — they win!', tokens: ['{name}'], desc: 'Log when Jester gets eliminated (wins)' },

  // Flow logs (HunterRevengeFlow, GovernorPardonFlow)
  { cat: 'log', key: 'hunterRevenge',            default: '{name} gets a revenge shot',   tokens: ['{name}'], tags: ['hunter', 'hunterRevenge'], desc: 'Log when hunter dies and revenge flow starts' },
  { cat: 'log', key: 'hunterRevengeKill',        default: '{hunter} took {victim} down with them', tokens: ['{hunter}', '{victim}'], tags: ['hunter', 'hunterRevenge'], desc: 'Log when hunter revenge kill lands' },
  { cat: 'log', key: 'hunterDisconnected',       default: '{name} disconnected — revenge cancelled', tokens: ['{name}'], tags: ['hunter', 'hunterRevenge'], desc: 'Log when hunter disconnects with no targets' },
  { cat: 'log', key: 'hunterAutoResolved',      default: '{name} disconnected — revenge auto-resolved', tokens: ['{name}'], tags: ['hunter', 'hunterRevenge'], desc: 'Log when hunter disconnects and revenge auto-fires' },
  { cat: 'log', key: 'governorDecision',        default: '{name} awaits the Governor\'s decision', tokens: ['{name}'], tags: ['governor', 'governorPardon'], desc: 'Log while governor pardon flow is pending' },
  { cat: 'log', key: 'governorDisconnected',    default: '{name} disconnected — pardon cancelled', tokens: ['{name}'], tags: ['governor', 'governorPardon'], desc: 'Log when governor disconnects during pardon flow' },
  { cat: 'log', key: 'pardoned',                default: '{governor} pardoned {victim}',  tokens: ['{governor}', '{victim}'], tags: ['governor', 'governorPardon'], desc: 'Log when governor grants a pardon' },
  { cat: 'log', key: 'notPardoned',             default: '{governor} condemned {victim}', tokens: ['{governor}', '{victim}'], tags: ['governor', 'governorPardon'], desc: 'Log when governor denies a pardon' },

  // ── Host dashboard UI labels ────────────────────────────────────────────────

  { cat: 'host', key: 'tabControls',            default: 'Controls',             desc: 'Mobile nav tab — game controls' },
  { cat: 'host', key: 'tabPlayers',             default: 'Players',              desc: 'Mobile nav tab — player overview' },
  { cat: 'host', key: 'tabLog',                 default: 'Log',                  desc: 'Mobile nav tab — game history log' },
  { cat: 'host', key: 'phaseLobby',             default: 'LOBBY',                desc: 'Phase label shown in header during lobby' },
  { cat: 'host', key: 'phaseGameOver',          default: 'GAME OVER',            desc: 'Phase label shown in header after game ends' },
  { cat: 'host', key: 'btnTutorials',           default: '👤 Tutorials',         desc: 'Button to open tutorials/role tip modal' },
  { cat: 'host', key: 'btnScoreboard',          default: '🏆 Scoreboard',        desc: 'Button to push scoreboard slide' },
  { cat: 'host', key: 'btnHeartbeatMode',       default: '❤️ HB Mode',           desc: 'Button to toggle heartbeat mode on/off' },
  { cat: 'host', key: 'btnHeartbeats',          default: '👤 Heartbeats',        desc: 'Button to push heartbeat slide' },

  // ── Landing page ────────────────────────────────────────────────────────────

  { cat: 'landing', key: 'title',               default: 'MURDERHOUSE',          desc: 'Main title on the landing page' },
  { cat: 'landing', key: 'tagline',             default: 'A social deduction game', desc: 'Subtitle tagline on landing page' },
  { cat: 'landing', key: 'connected',           default: '● Connected',          desc: 'Server connection status — connected' },
  { cat: 'landing', key: 'connecting',          default: '○ Connecting...',      desc: 'Server connection status — connecting' },
  { cat: 'landing', key: 'joined',              default: 'Joined',               desc: 'Label on player slot when taken' },
]

export const STRING_CATEGORIES = [
  { id: 'roles',    label: 'Roles'    },
  { id: 'items',    label: 'Items'    },
  { id: 'events',   label: 'Events'   },
  { id: 'slides',   label: 'Slides'   },
  { id: 'screen',   label: 'Screen'   },
  { id: 'feedback', label: 'Feedback' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'player',   label: 'Player'   },
  { id: 'host',     label: 'Host'     },
  { id: 'log',      label: 'Log'      },
  { id: 'landing',  label: 'Landing'  },
]

// ── Tag taxonomy ────────────────────────────────────────────────────────────
// Used by String Sheets for cross-category filtering.
// Entries in roles/events/items categories are auto-tagged by key prefix at display time.
// Cross-cutting entries carry inline `tags: [...]` on the entry itself.

export const TAG_GROUPS = [
  {
    id: 'roles', label: 'Roles',
    tags: [
      { id: 'villager',    label: 'Villager'    },
      { id: 'alpha',       label: 'Alpha'       },
      { id: 'werewolf',    label: 'Werewolf'    },
      { id: 'seer',        label: 'Seer'        },
      { id: 'doctor',      label: 'Doctor'      },
      { id: 'hunter',      label: 'Hunter'      },
      { id: 'vigilante',   label: 'Vigilante'   },
      { id: 'governor',    label: 'Governor'    },
      { id: 'cupid',       label: 'Cupid'       },
      { id: 'roleblocker', label: 'Roleblocker' },
      { id: 'poisoner',    label: 'Poisoner'    },
      { id: 'janitor',     label: 'Janitor'     },
      { id: 'tanner',      label: 'Tanner'      },
      { id: 'jester',      label: 'Jester'      },
      { id: 'drunk',       label: 'Drunk'       },
    ],
  },
  {
    id: 'events', label: 'Events',
    tags: [
      { id: 'vote',           label: 'Vote'           },
      { id: 'kill',           label: 'Kill'           },
      { id: 'hunt',           label: 'Hunt'           },
      { id: 'investigate',    label: 'Investigate'    },
      { id: 'protect',        label: 'Protect'        },
      { id: 'block',          label: 'Block'          },
      { id: 'vigil',          label: 'Vigilante Kill' },
      { id: 'suspect',        label: 'Suspect'        },
      { id: 'stumble',        label: 'Stumble'        },
      { id: 'poison',         label: 'Poison'         },
      { id: 'clean',          label: 'Clean'          },
      { id: 'shoot',          label: 'Shoot'          },
      { id: 'link',           label: 'Link'           },
      { id: 'customEvent',    label: 'Custom Event'   },
      { id: 'hunterRevenge',  label: "Hunter's Revenge" },
      { id: 'governorPardon', label: 'Governor Pardon' },
    ],
  },
  {
    id: 'items', label: 'Items',
    tags: [
      { id: 'pistol',    label: 'Pistol'    },
      { id: 'phone',     label: 'Phone'     },
      { id: 'clue',      label: 'Clue'      },
      { id: 'barricade', label: 'Barricade' },
      { id: 'coward',    label: 'Coward'    },
    ],
  },
]

