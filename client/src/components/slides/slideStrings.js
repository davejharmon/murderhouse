// client/src/components/slides/slideStrings.js
// All static string literals used by slide components, resolved via the catalog.
// Getters are used so each access reads the current localStorage override.
// Overrides are set via the String Sheets dev tool (/strings).

import { getStr } from '@/strings/index.js'

export const SLIDE_STRINGS = {
  fallback: {
    get title()   { return getStr('screen', 'fallback.title') },
    get players() { return getStr('screen', 'fallback.players') },
    get day()     { return getStr('screen', 'fallback.day') },
    get night()   { return getStr('screen', 'fallback.night') },
  },
  death: {
    get eliminated() { return getStr('slides', 'death.suffixEliminated') },
    get coward()     { return getStr('screen', 'death.coward') },
    get mad()        { return getStr('screen', 'death.mad') },
  },
  gallery: {
    get cell() { return getStr('screen', 'gallery.cell') },
  },
  scores: {
    get title() { return getStr('slides', 'misc.scoreboardTitle') },
    get empty() { return getStr('screen', 'scores.empty') },
  },
  heartbeat: {
    get bpm()        { return getStr('screen', 'heartbeat.bpm') },
    get signalLost() { return getStr('screen', 'heartbeat.signalLost') },
    get debug()      { return getStr('screen', 'heartbeat.debug') },
  },
  composition: {
    get unassigned() { return getStr('screen', 'composition.unassigned') },
  },
  roleTip: {
    get cell()    { return getStr('screen', 'roleTip.cell') },
    get independent() { return getStr('slides', 'death.teamNeutral') },
    get circle()      { return getStr('screen', 'roleTip.circle') },
    get passive()     { return getStr('screen', 'roleTip.passive') },
    get singleUse()   { return getStr('screen', 'roleTip.singleUse') },
    get uses()        { return getStr('screen', 'roleTip.uses') },
  },
}
