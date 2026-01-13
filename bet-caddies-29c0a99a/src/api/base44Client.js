// Local data client to replace Base44 SDK
// Uses localStorage for persistence

const STORAGE_KEYS = {
  GOLF_BETS: 'golfBets',
  USER_BETS: 'userBets',
  BETTING_PROVIDERS: 'bettingProviders',
  HIO_CHALLENGES: 'hioChallenges',
  HIO_ENTRIES: 'hioEntries',
  USER: 'user',
  AUTH: 'auth'
};

// Admin user credentials
const ADMIN_CREDENTIALS = {
  email: 'chriscjcrane@gmail.com',
  password: 'RicksWaglers1!',
  user: {
    email: 'chriscjcrane@gmail.com',
    name: 'Chris Crane',
    role: 'admin'
  }
};

// Initial sample data
const initialData = {
  [STORAGE_KEYS.GOLF_BETS]: [
    {
      id: 1,
      selection_name: 'Tiger Woods',
      bet_title: 'Tiger to win Masters',
      confidence_rating: 85,
      ai_analysis_paragraph: 'Strong performance expected based on recent form.',
      affiliate_link_override: null,
      status: 'active',
      course_fit_score: 90,
      form_label: 'Excellent',
      weather_label: 'Clear',
      category: 'eagle'
    },
    {
      id: 2,
      selection_name: 'Rory McIlroy',
      bet_title: 'Rory under par',
      confidence_rating: 78,
      ai_analysis_paragraph: 'Consistent player with good course history.',
      affiliate_link_override: null,
      status: 'active',
      course_fit_score: 85,
      form_label: 'Good',
      weather_label: 'Sunny',
      category: 'birdie'
    },
    {
      id: 3,
      selection_name: 'Jordan Spieth',
      bet_title: 'Spieth to make cut',
      confidence_rating: 82,
      ai_analysis_paragraph: 'Solid performance in majors.',
      affiliate_link_override: null,
      status: 'active',
      course_fit_score: 88,
      form_label: 'Very Good',
      weather_label: 'Overcast',
      category: 'par'
    }
  ],
  [STORAGE_KEYS.BETTING_PROVIDERS]: [
    {
      id: 1,
      name: 'DraftKings',
      slug: 'draftkings',
      logo_url: 'https://example.com/draftkings.png',
      affiliate_base_url: 'https://www.draftkings.com',
      priority: 1,
      enabled: true
    },
    {
      id: 2,
      name: 'FanDuel',
      slug: 'fanduel',
      logo_url: 'https://example.com/fanduel.png',
      affiliate_base_url: 'https://www.fanduel.com',
      priority: 2,
      enabled: true
    }
  ],
  [STORAGE_KEYS.USER_BETS]: [],
  [STORAGE_KEYS.HIO_CHALLENGES]: [
    {
      id: 1,
      status: 'active',
      created_date: new Date().toISOString(),
      title: 'Monthly HIO Challenge',
      description: 'Hit the most holes in one this month!'
    }
  ],
  [STORAGE_KEYS.HIO_ENTRIES]: [],
  [STORAGE_KEYS.USER]: null, // Will be set when logged in
  [STORAGE_KEYS.AUTH]: {
    isLoggedIn: false,
    user: null
  }
};

// Utility functions
function getStorageData(key) {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
    // Initialize with default data if not exists
    const defaultData = initialData[key] || [];
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return initialData[key] || [];
  }
}

function setStorageData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing to localStorage:', e);
  }
}

// Entity classes
class EntityManager {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  filter(filters = {}, sort = '', limit = null) {
    return new Promise((resolve) => {
      try {
        let data = getStorageData(this.storageKey);

        // Apply filters
        if (filters) {
          data = data.filter(item => {
            return Object.entries(filters).every(([key, value]) => item[key] === value);
          });
        }

        // Apply sorting (simple implementation)
        if (sort) {
          const [field, order] = sort.startsWith('-') ? [sort.slice(1), 'desc'] : [sort, 'asc'];
          data.sort((a, b) => {
            if (order === 'desc') {
              return (b[field] || '') > (a[field] || '') ? 1 : -1;
            }
            return (a[field] || '') > (b[field] || '') ? 1 : -1;
          });
        }

        // Apply limit
        if (limit) {
          data = data.slice(0, limit);
        }

        resolve(data);
      } catch (e) {
        console.error('Error in filter:', e);
        resolve([]);
      }
    });
  }

  create(item) {
    return new Promise((resolve) => {
      try {
        const data = getStorageData(this.storageKey);
        const newItem = { ...item, id: Date.now() };
        data.push(newItem);
        setStorageData(this.storageKey, data);
        resolve(newItem);
      } catch (e) {
        console.error('Error in create:', e);
        resolve(null);
      }
    });
  }

  update(id, updates) {
    return new Promise((resolve) => {
      try {
        const data = getStorageData(this.storageKey);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
          data[index] = { ...data[index], ...updates };
          setStorageData(this.storageKey, data);
          resolve(data[index]);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.error('Error in update:', e);
        resolve(null);
      }
    });
  }

  delete(id) {
    return new Promise((resolve) => {
      try {
        const data = getStorageData(this.storageKey);
        const filtered = data.filter(item => item.id !== id);
        setStorageData(this.storageKey, filtered);
        resolve(true);
      } catch (e) {
        console.error('Error in delete:', e);
        resolve(false);
      }
    });
  }
}

// Auth manager
const authManager = {
  login: (email, password) => {
    return new Promise((resolve, reject) => {
      // Check admin credentials
      if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        const authData = {
          isLoggedIn: true,
          user: ADMIN_CREDENTIALS.user
        };
        setStorageData(STORAGE_KEYS.AUTH, authData);
        setStorageData(STORAGE_KEYS.USER, ADMIN_CREDENTIALS.user);
        resolve(ADMIN_CREDENTIALS.user);
      } else {
        reject(new Error('Invalid credentials'));
      }
    });
  },

  logout: () => {
    return new Promise((resolve) => {
      const authData = {
        isLoggedIn: false,
        user: null
      };
      setStorageData(STORAGE_KEYS.AUTH, authData);
      setStorageData(STORAGE_KEYS.USER, null);
      resolve(true);
    });
  },

  me: () => {
    return new Promise((resolve) => {
      const authData = getStorageData(STORAGE_KEYS.AUTH);
      if (authData.isLoggedIn && authData.user) {
        resolve(authData.user);
      } else {
        resolve(null);
      }
    });
  },

  isLoggedIn: () => {
    const authData = getStorageData(STORAGE_KEYS.AUTH);
    return authData.isLoggedIn || false;
  },

  redirectToLogin: () => {
    console.log('Mock: Redirect to login');
    // In a real app, this would redirect to login page
  }
};

// Export the client
export const base44 = {
  auth: authManager,
  entities: {
    GolfBet: new EntityManager(STORAGE_KEYS.GOLF_BETS),
    UserBet: new EntityManager(STORAGE_KEYS.USER_BETS),
    BettingProvider: new EntityManager(STORAGE_KEYS.BETTING_PROVIDERS),
    HIOChallenge: new EntityManager(STORAGE_KEYS.HIO_CHALLENGES),
    HIOEntry: new EntityManager(STORAGE_KEYS.HIO_ENTRIES)
  }
};
