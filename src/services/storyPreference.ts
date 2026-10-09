export const STORY_KEY = 'think-a-ling-story-v3'
export function hasSeenStory() { try { return localStorage.getItem(STORY_KEY) === 'seen' } catch { return false } }
