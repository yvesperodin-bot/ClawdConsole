'use strict';

/**
 * Canonical topic + question definitions.
 *
 * This is the ONE source of truth. The server validates submissions against it
 * and builds the PDF from it, and it is injected into index.html at request
 * time so the browser renders the same text without a second round trip.
 *
 * To change wording or add a topic, edit only this file.
 */
const TOPICS = [
  {
    id: 'teamwork',
    name: 'Teamwork & Improvement',
    description: 'What worked and what we can improve.',
    questions: [
      'What did we do well together today?',
      'What got in our way that we could handle differently?',
      "What's one change we'll try tomorrow, and who will own it?",
    ],
  },
  {
    id: 'communication',
    name: 'Communication & Support',
    description: 'Observations, cooperation, and support needed.',
    questions: [
      'What did you notice today that the rest of us might have missed?',
      'Where could we have helped each other sooner?',
      'What help or decision do we need before we start tomorrow?',
    ],
  },
  {
    id: 'planning',
    name: 'Planning & Learning',
    description: 'How the day unfolded and what we learned.',
    questions: [
      'Where did today go differently from what we planned?',
      'What did we learn from how we handled it?',
      'What should we do differently next time?',
    ],
  },
  {
    id: 'recognition',
    name: 'Recognition & Follow-Through',
    description: 'Contributions, open items, and commitments.',
    questions: [
      "Who made someone else's job easier today, and how?",
      "What's still open that we need to pick up tomorrow?",
      'What did we agree to follow up on earlier this week, and where does it stand?',
    ],
  },
];

const REFLECTION_PROMPT =
  'Reflect on today’s work and teamwork. Use specific examples, recognize ' +
  'contributions, and identify anything that needs follow-through.';

function getTopic(id) {
  return TOPICS.find((t) => t.id === id) || null;
}

module.exports = { TOPICS, REFLECTION_PROMPT, getTopic };
