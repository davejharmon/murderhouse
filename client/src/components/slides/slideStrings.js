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
    get eliminated() { return getStr('screen', 'death.eliminated') },
    get coward()     { return getStr('screen', 'death.coward') },
    get mad()        { return getStr('screen', 'death.mad') },
  },
  gallery: {
    get werewolf() { return getStr('screen', 'gallery.werewolf') },
    get coward()   { return getStr('screen', 'gallery.coward') },
    get mad()      { return getStr('screen', 'gallery.mad') },
  },
  scores: {
    get title() { return getStr('screen', 'scores.title') },
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
    get werewolf()    { return getStr('screen', 'roleTip.werewolf') },
    get independent() { return getStr('screen', 'roleTip.independent') },
    get village()     { return getStr('screen', 'roleTip.village') },
    get passive()     { return getStr('screen', 'roleTip.passive') },
    get singleUse()   { return getStr('screen', 'roleTip.singleUse') },
    get uses()        { return getStr('screen', 'roleTip.uses') },
  },
}
