export const UNIVERSAL_PROMPTS = [
  'What time of day would you typically be there?',
  'How many people are usually around?',
  'What would you be wearing?',
  'Is there food or drink nearby?',
  'What sounds would you hear?',
  'How did you get here today?',
  'What does the air smell like?',
  'Are you indoors or outdoors?',
  'What was the last thing you did before coming here?',
  'Would you bring a bag or backpack?',
  'How long would you typically spend there?',
  'Is this a place you visit regularly?',
  'What temperature is it where you are?',
  'Are children allowed here?',
  'What would happen if you fell asleep here?',
];

export const TECH_PROMPTS = [
  'What kind of screen are you looking at?',
  'Is there a dress code where you are?',
  'How strong is the WiFi?',
  'Would you need a badge to get in?',
  'What operating system is most common here?',
  'How many monitors can you see?',
  'Is there a ping pong table nearby?',
  'What kind of cables are on the floor?',
  'How many fire exits are there?',
  'Is there free coffee?',
  'Would you find a whiteboard here?',
  'How quiet is it on a scale of 1-10?',
  'Are there any blinking lights?',
  'What happens when the power goes out?',
  'Is there a vending machine nearby?',
];

export const CLASSIC_PROMPTS = [
  'What kind of uniform might someone wear here?',
  'Is there music playing?',
  'What would you order here?',
  'Can you see the sky from where you are?',
  'Is this a place you\'d go alone or with others?',
  'What tools or equipment are nearby?',
  'Would a tourist visit this place?',
  'What language would you hear most?',
  'Is there a line or queue to get in?',
  'Could you take a nap here without anyone noticing?',
  'What kind of vehicle brought you here?',
  'Are there security cameras?',
  'What would you complain about here?',
  'Is this place open 24 hours?',
  'What color is the floor?',
];

/**
 * Get random prompts from a pack.
 * @param {'all'|'classic'|'tech'} pack
 * @param {number} count
 * @returns {string[]}
 */
export function getRandomPrompts(pack = 'all', count = 3) {
  let pool;
  if (pack === 'tech') {
    pool = [...UNIVERSAL_PROMPTS, ...TECH_PROMPTS];
  } else if (pack === 'classic') {
    pool = [...UNIVERSAL_PROMPTS, ...CLASSIC_PROMPTS];
  } else {
    pool = [...UNIVERSAL_PROMPTS, ...TECH_PROMPTS, ...CLASSIC_PROMPTS];
  }

  // Fisher-Yates shuffle and take first `count`
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
