/** Backend-shaped fixtures shared by app tests (shapes captured from the live API). */
export const categories = [
  {
    id: 'cat-fin',
    parentId: null,
    slug: 'finance-investing',
    name: 'Finance & Investing',
    description: 'Understand markets.',
    isActive: true,
    children: [],
  },
  {
    id: 'cat-create',
    parentId: null,
    slug: 'content-creation',
    name: 'Content Creation',
    description: 'Make videos.',
    isActive: true,
    children: [],
  },
];

export const skill = {
  id: 'skill-ta',
  categoryId: 'cat-fin',
  slug: 'technical-analysis',
  name: 'Technical Analysis',
  description: 'Charts, patterns, indicators and risk management.',
  learnerNotice: 'Sessions are for education only and are not investment advice.',
  isActive: true,
};

export const skill2 = {
  id: 'skill-video',
  categoryId: 'cat-create',
  slug: 'video-editing',
  name: 'Video Editing',
  description: 'Cut, colour and publish.',
  learnerNotice: null,
  isActive: true,
};

export const skillDetail = {
  ...skill,
  category: categories[0],
  topics: [{ id: 'topic-candles', skillId: 'skill-ta', slug: 'candlestick-patterns', name: 'Candlestick Patterns', isActive: true }],
};

export const page = <T>(items: T[]) => ({ items, total: items.length, limit: 12, offset: 0 });

export const tokens = {
  accessToken: 'access-1',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '',
  tokenType: 'Bearer',
};

export const member = {
  id: 'u1',
  email: 'asha@example.com',
  fullName: 'Asha Verma',
  accountType: 'MEMBER',
  staffRole: null,
  status: 'ACTIVE',
  createdAt: '2026-11-01T00:00:00Z',
};

export const staff = { ...member, id: 'admin-1', fullName: 'Platform Admin', accountType: 'STAFF', staffRole: 'ADMIN' };

export const apiError = (code: string, message: string, details: Record<string, unknown> = {}) => ({
  error: { code, message, details, requestId: 'req_test' },
});
